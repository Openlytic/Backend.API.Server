import type { EntityManager, FindOptionsWhere } from 'typeorm'

import { OrganizationEntity, OrganizationStatus } from 'src/modules/organization/organization.entity'
import {
  createAnOrganizationUser,
  getAnOrganization,
  prepareOrganizationUpdateData,
  validateAndPrepareOrganizationData,
  validateAndPrepareSubDomain,
  type PrepareOrganizationUpdateDataParams,
  type ValidateAndPrepareOrganizationDataParams
} from 'src/modules/organization/organization.helper'
import { OrganizationUserEntity, OrganizationUserStatus } from 'src/modules/organization/organization_user.entity'
import { getRepository } from 'src/utils/database'
import CustomError from 'src/utils/error'

export const createAnOrganization = async (
  data: Partial<OrganizationEntity>,
  transaction?: EntityManager
): Promise<OrganizationEntity> => {
  const repo = getRepository(OrganizationEntity, transaction)
  return repo.save(repo.create(data))
}

export const updateAnOrganization = async (
  options: FindOptionsWhere<OrganizationEntity>,
  data: Partial<OrganizationEntity>,
  transaction?: EntityManager
): Promise<OrganizationEntity> => {
  const organization = await getAnOrganization({ where: options }, transaction)
  if (!organization?.id) {
    throw new CustomError(404, 'ORGANIZATION_NOT_FOUND')
  }

  await getRepository(OrganizationEntity, transaction).update(organization.id, data)

  return getAnOrganization({ where: { id: organization.id } }, transaction) as Promise<OrganizationEntity>
}

export const deleteAnOrganization = async (
  options: FindOptionsWhere<OrganizationEntity>,
  transaction?: EntityManager
): Promise<OrganizationEntity> => {
  const organization = await getAnOrganization({ where: options }, transaction)
  if (!organization?.id) {
    throw new CustomError(404, 'ORGANIZATION_NOT_FOUND')
  }

  await getRepository(OrganizationEntity, transaction).delete(organization.id)

  return organization
}

export interface CreateOrganizationInputData extends ValidateAndPrepareOrganizationDataParams {
  org_name?: string
  owner_id?: string
  sub_domain?: string
  time_zone?: string
  start_with_dummy_data?: boolean
}

export const createAnOrganizationForMutation = async (
  params?: CreateOrganizationInputData,
  user?: Record<string, unknown>,
  transaction?: EntityManager
): Promise<OrganizationEntity> => {
  await validateAndPrepareOrganizationData(params || ({} as CreateOrganizationInputData), user || {}, transaction)

  const organization = await createAnOrganization(
    {
      created_by: params.created_by as string | null,
      name: params.org_name as string,
      sub_domain: params.sub_domain as string
    },
    transaction
  )
  if (!organization?.id) {
    throw new CustomError(500, 'COULD_NOT_CREATE_ORGANIZATION')
  }

  await createAnOrganizationUser(
    {
      org_id: organization.id,
      status: (params.is_active_user
        ? OrganizationUserStatus.ACTIVE
        : OrganizationUserStatus.INVITED) as OrganizationUserEntity['status'],
      user_id: (params.owner_id || (user?.user_id as string | undefined)) as string
    },
    transaction
  )

  return organization
}

export interface UpdateOrganizationMutationParams {
  inputData?: PrepareOrganizationUpdateDataParams
  queryData?: { entity_id?: string }
  [key: string]: unknown
}

export const updateAnOrganizationForMutation = async (
  params?: UpdateOrganizationMutationParams,
  user?: { roles?: string[]; org_id?: string; [key: string]: unknown },
  transaction?: EntityManager
): Promise<OrganizationEntity> => {
  const { inputData = {}, queryData = {} } = params || {}

  if (!user?.roles?.includes('admin') && queryData.entity_id !== user?.org_id) {
    throw new CustomError(401, 'UNAUTHORIZED')
  }

  const organizationInfo = await getAnOrganization({ where: { id: queryData.entity_id } }, transaction)
  if (!organizationInfo?.id) {
    throw new CustomError(404, 'ORGANIZATION_NOT_FOUND')
  }

  const { organizationData } = await prepareOrganizationUpdateData(inputData)

  if (Object.keys(organizationData).length === 0) {
    throw new CustomError(400, 'NOTHING_TO_UPDATE')
  }

  if (organizationData?.sub_domain) {
    organizationData.sub_domain = await validateAndPrepareSubDomain(organizationData.sub_domain as string)
  }

  await getRepository(OrganizationEntity, transaction).update(organizationInfo.id, organizationData)

  return getAnOrganization({ where: { id: organizationInfo.id } }, transaction) as Promise<OrganizationEntity>
}

export const deleteAnOrganizationForMutation = async (
  params?: { org_id?: string },
  transaction?: EntityManager
): Promise<OrganizationEntity> => {
  const organization = await getAnOrganization({ where: { id: params?.org_id || null } }, transaction)
  if (!organization?.id) {
    throw new CustomError(404, 'ORGANIZATION_NOT_FOUND')
  }
  if (organization?.status === OrganizationStatus.DELETING) {
    throw new CustomError(400, 'ORGANIZATION_IS_BEING_DELETED')
  }

  await getRepository(OrganizationEntity, transaction).update(organization.id, { status: OrganizationStatus.DELETING })

  return getAnOrganization({ where: { id: organization.id } }, transaction) as Promise<OrganizationEntity>
}
