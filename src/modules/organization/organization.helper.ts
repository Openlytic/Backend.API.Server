import type { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm'
import { ILike, In, Not } from 'typeorm'

import { commonHelper } from 'src/modules/helpers'
import { OrganizationEntity, OrganizationStatus } from 'src/modules/organization/organization.entity'
import { OrganizationUserEntity } from 'src/modules/organization/organization_user.entity'
import { ReservedSubDomainEntity } from 'src/modules/organization/reserved-sub-domain.entity'
import { UserEntity } from 'src/modules/user/user.entity'
import { getRepository } from 'src/utils/database'
import CustomError from 'src/utils/error'

export const getAnOrganization = async (options?: FindOneOptions<OrganizationEntity>, transaction?: EntityManager) =>
  getRepository(OrganizationEntity, transaction).findOne({ ...options })

export const getOrganizations = async (options?: FindManyOptions<OrganizationEntity>, transaction?: EntityManager) =>
  getRepository(OrganizationEntity, transaction).find({ ...options })

export const countOrganizations = async (options?: FindManyOptions<OrganizationEntity>) =>
  getRepository(OrganizationEntity).count({ ...options })

export const validateAndPrepareSubDomain = async (name = '') => {
  const subDomain = commonHelper.slugify(name)

  const reservedSubDomain = await getRepository(ReservedSubDomainEntity).findOne({ where: { sub_domain: subDomain } })
  if (reservedSubDomain?.id) {
    throw new CustomError(400, 'SUB_DOMAIN_IS_RESERVED')
  }

  const existOrganization = await getAnOrganization({ where: { sub_domain: subDomain } })
  if (existOrganization?.id) {
    throw new CustomError(400, 'SUB_DOMAIN_IS_IN_USAGE')
  }

  // Validating the domain
  commonHelper.validateDomain({ sub_domain: subDomain, user_input_domain: name })

  return subDomain
}

export interface ValidateAndPrepareOrganizationDataParams {
  org_name?: string
  owner_id?: string
  sub_domain?: string
  location?: Record<string, unknown>
  created_by?: string
  [key: string]: unknown
}

export const validateAndPrepareOrganizationData = async (
  params: ValidateAndPrepareOrganizationDataParams,
  user: { user_id?: string; role?: string | string[]; roles?: string[]; [key: string]: unknown },
  transaction?: EntityManager
) => {
  const safeUser = user || {}
  const getUserRoles = (): string[] => {
    if (Array.isArray(safeUser?.roles)) return safeUser.roles
    if (Array.isArray(safeUser?.role)) return safeUser.role
    if (typeof safeUser?.role === 'string') return [safeUser.role]
    return []
  }
  const userRoles = getUserRoles()

  if (params.owner_id && !['admin', 'manager', 'translator'].some((role) => userRoles.includes(role))) {
    throw new CustomError(401, 'UNAUTHORIZED')
  }

  params.owner_id = params.owner_id ?? safeUser.user_id

  commonHelper.checkRequiredFields(['location', 'org_name', 'owner_id', 'sub_domain'], params)

  const owner = await getRepository(UserEntity, transaction).findOne({ where: { id: params.owner_id } })
  if (!owner?.id) {
    throw new CustomError(404, 'OWNER_NOT_FOUND')
  }
  params.owner = owner as unknown as Record<string, unknown>

  params.sub_domain = await validateAndPrepareSubDomain(params.sub_domain || '')

  params.created_by = safeUser.user_id
}

export const getAnOrganizationBySubDomain = async (params: { sub_domain?: string } = {}) => {
  commonHelper.checkRequiredFields(['sub_domain'], params)

  const organization = await getAnOrganization({
    where: { status: OrganizationStatus.ACTIVE, sub_domain: params.sub_domain }
  })
  if (!organization?.id) {
    throw new CustomError(404, 'ORGANIZATION_NOT_FOUND')
  }

  return organization
}

export const checkSubDomainAvailability = async (params: { sub_domain?: string } = {}) => {
  commonHelper.checkRequiredFields(['sub_domain'], params)

  return { sub_domain: await validateAndPrepareSubDomain(params.sub_domain || '') }
}

export const getAnOrganizationForQuery = async (
  params: { entity_id?: string } = {},
  user: { org_id?: string; [key: string]: unknown } = {}
) => {
  const organization = await getAnOrganization({ where: { id: params?.entity_id || user?.org_id } })
  if (!organization?.id) {
    throw new CustomError(404, 'ORGANIZATION_NOT_FOUND')
  }

  return organization
}

export const getAnOrganizationUser = async (
  options?: FindOneOptions<OrganizationUserEntity>,
  transaction?: EntityManager
) => getRepository(OrganizationUserEntity, transaction).findOne({ ...options })

export const getOrganizationUsers = async (
  options?: FindManyOptions<OrganizationUserEntity>,
  transaction?: EntityManager
) => getRepository(OrganizationUserEntity, transaction).find({ ...options })

export const createAnOrganizationUser = async (data: Partial<OrganizationUserEntity>, transaction?: EntityManager) => {
  const repo = getRepository(OrganizationUserEntity, transaction)
  return repo.save(repo.create(data))
}

export const getOrganizationsOfAnUser = async (params: { user?: Record<string, unknown> } = {}) => {
  const { user } = params || {}
  const userId = user?.user_id as string | undefined

  const orgUsers = await getOrganizationUsers({
    where: { user_id: userId, status: 'active' as OrganizationUserEntity['status'] }
  })
  const orgIds = [...new Set(orgUsers.map((orgUser) => orgUser.org_id))]

  const organizations = await getOrganizations({
    where: {
      id: orgIds.length ? In(orgIds) : In(['00000000-0000-0000-0000-000000000000']),
      status: 'active' as OrganizationEntity['status']
    }
  })

  return JSON.parse(JSON.stringify(organizations))
}

export interface GetOrganizationsForQueryParams {
  query?: { org_statuses?: OrganizationStatus[]; search_keyword?: string }
  options?: { limit?: number; offset?: number; order?: unknown[] }
}

export const getOrganizationsForQuery = async (
  params?: GetOrganizationsForQueryParams,
  user?: Record<string, unknown>
) => {
  const { query = {}, options = {} } = params || {}
  const { limit, offset } = options || {}

  const where: FindOptionsWhere<OrganizationEntity> = {}
  const { org_statuses: orgStatuses, search_keyword: searchKeyword } = query || {}

  if (Array.isArray(orgStatuses) && orgStatuses.length) {
    where.status = In(orgStatuses as OrganizationStatus[]) as never
  } else {
    where.status = Not(OrganizationStatus.DELETING) as never
  }

  if (searchKeyword) {
    const like = `%${searchKeyword}%`
    where.name = ILike(like)
    where.sub_domain = ILike(like)
  }

  const organizations = await getOrganizations({
    where,
    order: { created_at: 'DESC' },
    take: limit,
    skip: offset
  })
  const filteredRows = await countOrganizations({ where })
  const totalRows = await countOrganizations()

  return { data: organizations, meta_data: { filtered_rows: filteredRows, total_rows: totalRows } }
}

export interface PrepareOrganizationUpdateDataParams {
  location?: Record<string, unknown>
  org_name?: string
  status?: string
  sub_domain?: string
  [key: string]: unknown
}

export const prepareOrganizationUpdateData = async (params?: PrepareOrganizationUpdateDataParams) => {
  const { location, org_name: orgName, status, sub_domain: subDomain } = params || {}

  const organizationData: Record<string, unknown> = {}

  if (orgName) organizationData.name = orgName

  if (status) organizationData.status = status

  if (subDomain) {
    organizationData.sub_domain = await validateAndPrepareSubDomain(subDomain)
  }

  return { locationData: location, organizationData }
}

export const checkAppBrandRemovingFeatureStatus = async (orgId?: string, transaction?: EntityManager) => {
  if (!orgId) {
    throw new CustomError(400, 'ORG_ID_REQUIRED')
  }

  const organization = await getAnOrganization({ where: { id: orgId } }, transaction)
  if (!organization?.id) {
    throw new CustomError(404, 'ORGANIZATION_NOT_FOUND')
  }

  // Openlytic: organization settings are not ported yet — remove_app_branding is unavailable.
  return false
}
