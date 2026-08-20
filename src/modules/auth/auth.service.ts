import * as authLib from '@openlytic/auth'
import type { EntityManager } from 'typeorm'
import { In } from 'typeorm'

import { validateEmail, validateUUID } from 'src/modules/common/common.helper'
import { OrganizationEntity, OrganizationStatus } from 'src/modules/organization/organization.entity'
import { OrganizationUserEntity, OrganizationUserStatus } from 'src/modules/organization/organization_user.entity'
import { UserEntity, UserStatus } from 'src/modules/user/user.entity'
import { getRepository } from 'src/utils/database'
import CustomError from 'src/utils/error'
import { toHttpError } from 'src/utils/http-status'

export interface AuthUser {
  user_id?: string
  contact_id?: string
  org_id?: string
  org_brand_id?: string
  roles?: string[]
  [key: string]: unknown
}

const runAuth = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn()
  } catch (err) {
    throw toHttpError(err)
  }
}

const getAUser = async (options: Record<string, unknown>, transaction?: EntityManager) =>
  (await authLib.getRepository('user', transaction).findOne({ where: options })) as UserEntity | null

const getAUserByEmail = async (email: string, transaction?: EntityManager) => {
  const user = await getAUser({ email }, transaction)
  if (!user?.id) throw new CustomError(404, 'USER_IS_NOT_FOUND')
  return user
}

const getAUserByContext = async (user?: AuthUser, transaction?: EntityManager) => {
  if (!user?.user_id) throw new CustomError(401, 'INVALID_TOKEN')
  const currentUser = await getAUser({ id: user.user_id }, transaction)
  if (!currentUser?.id) throw new CustomError(404, 'USER_IS_NOT_FOUND')
  return currentUser
}

const sanitizeUser = (user: UserEntity) => {
  const { password, old_passwords, ...rest } = user
  return rest
}

const getDefaultRoles = (): string[] => ['user']

export interface OrganizationMembershipData {
  org_id: string
  name: string
  sub_domain: string
  role: string
}

const getOrganizationMembershipsForUser = async (
  userId: string,
  transaction?: EntityManager
): Promise<OrganizationMembershipData[]> => {
  const orgUsers = await getRepository(OrganizationUserEntity, transaction).find({
    where: { user_id: userId, status: OrganizationUserStatus.ACTIVE }
  })
  if (!orgUsers.length) return []
  const organizations = await getRepository(OrganizationEntity, transaction).find({
    where: { id: In(orgUsers.map((item) => item.org_id)), status: OrganizationStatus.ACTIVE }
  })
  return organizations.map((organization) => ({
    org_id: organization.id,
    name: organization.name,
    sub_domain: organization.sub_domain,
    role: organization.created_by === userId ? 'admin' : 'manager'
  }))
}

const getOrgMembershipRoles = async (
  orgId: string | undefined,
  userId: string,
  transaction?: EntityManager
): Promise<{ roles: string[]; org_id?: string }> => {
  if (!orgId) {
    return { roles: getDefaultRoles() }
  }

  if (!validateUUID(orgId)) {
    throw new CustomError(400, 'INVALID_ORGANIZATION')
  }

  const organization = await getRepository(OrganizationEntity, transaction).findOne({ where: { id: orgId } })
  if (!organization?.id) {
    throw new CustomError(400, 'INVALID_ORGANIZATION')
  }

  const orgUser = await getRepository(OrganizationUserEntity, transaction).findOne({
    where: { org_id: orgId, user_id: userId }
  })
  if (!orgUser?.id) {
    throw new CustomError(401, 'UNREGISTERED_USER_OF_THE_ORG')
  }
  if (orgUser.status !== OrganizationUserStatus.ACTIVE) {
    throw new CustomError(400, 'INACTIVE_ORGANIZATION_USER')
  }

  const roles = organization.created_by === userId ? ['admin', 'manager'] : ['manager']

  return { roles, org_id: orgId }
}

const createUserIfMissing = async (email: string, transaction?: EntityManager) => {
  const user = await getAUser({ email }, transaction)
  if (user?.id) return user
  return (await authLib
    .getRepository('user', transaction)
    .save(authLib.getRepository('user', transaction).create({ email, status: UserStatus.INVITED }))) as UserEntity
}

const updateUser = async (id: string, data: Partial<UserEntity>, transaction?: EntityManager) => {
  await authLib.getRepository('user', transaction).update(id, data)
}

export interface PreRegisterParams {
  email: string
  first_name?: string
  last_name?: string
}

export const preRegisterAnUser = async (
  params: PreRegisterParams = {} as PreRegisterParams,
  transaction?: EntityManager
) =>
  runAuth(async () => {
    const email = (params?.email || '').toLowerCase()
    if (!validateEmail(email)) throw new CustomError(400, 'INVALID_EMAIL')

    const user = await createUserIfMissing(email, transaction)
    if (user?.password) throw new CustomError(400, 'USER_IS_ALREADY_REGISTERED')
    if (user?.status === 'unverified' || user?.status === 'active') {
      throw new CustomError(400, 'USER_IS_ALREADY_VERIFIED')
    }

    const updatingData: Partial<UserEntity> = {}
    if (params?.first_name) updatingData.first_name = params.first_name
    if (params?.last_name) updatingData.last_name = params.last_name
    if (Object.keys(updatingData).length > 0) await updateUser(user.id, updatingData, transaction)
    await updateUser(user.id, { status: UserStatus.UNVERIFIED }, transaction)
    await authLib.resendUserVerificationEmail({ email }, transaction)

    return {
      is_unregistered_user: true,
      user: { ...sanitizeUser(user), ...updatingData, status: UserStatus.UNVERIFIED }
    }
  })

export interface RegisterPasswordParams {
  user_id: string
  password: string
  is_verification_required: boolean
}

export const registerPassword = async (
  params: RegisterPasswordParams = {} as RegisterPasswordParams,
  transaction?: EntityManager
) =>
  runAuth(async () => {
    if (!authLib.checkPasswordPolicy(params?.password)) {
      throw new CustomError(400, 'PASSWORD_DID_NOT_CONFORM_OUR_POLICY')
    }
    const user = await getAUserByContext({ user_id: params?.user_id }, transaction)
    if (user?.password) throw new CustomError(400, 'USER_IS_ALREADY_REGISTERED')
    return authLib.registerPassword(params, transaction)
  })

export interface SignUpParams {
  email: string
  password: string
  first_name?: string
  last_name?: string
  is_verification_required?: boolean
}

export const signUp = async (params: SignUpParams = {} as SignUpParams, transaction?: EntityManager) =>
  runAuth(async () => {
    const email = (params?.email || '').toLowerCase()
    if (!validateEmail(email)) throw new CustomError(400, 'INVALID_EMAIL')
    if (!authLib.checkPasswordPolicy(params?.password)) {
      throw new CustomError(400, 'PASSWORD_DID_NOT_CONFORM_OUR_POLICY')
    }

    const user = await createUserIfMissing(email, transaction)
    if (user?.password) throw new CustomError(400, 'USER_IS_ALREADY_REGISTERED')

    const updatingData: Partial<UserEntity> = {}
    if (params?.first_name) updatingData.first_name = params.first_name
    if (params?.last_name) updatingData.last_name = params.last_name
    if (Object.keys(updatingData).length > 0) await updateUser(user.id, updatingData, transaction)

    const registered = await authLib.registerPassword(
      {
        user_id: user.id,
        password: params.password,
        is_verification_required: params?.is_verification_required !== false
      },
      transaction
    )

    return { ...sanitizeUser({ ...registered, ...updatingData } as UserEntity) }
  })

export interface VerifyUserEmailParams {
  user_id: string
  token: string
}

export const verifyUserEmail = async (
  params: VerifyUserEmailParams = {} as VerifyUserEmailParams,
  transaction?: EntityManager
) => runAuth(() => authLib.verifyUserEmail(params, transaction))

export type ResendUserVerificationEmailParams = {
  email: string
}

export const resendUserVerificationEmail = async (
  params: ResendUserVerificationEmailParams = {} as ResendUserVerificationEmailParams,
  transaction?: EntityManager
) => runAuth(() => authLib.resendUserVerificationEmail(params, transaction))

export interface LoginParams {
  email: string
  password: string
  org_id?: string
  org_brand_id?: string
}

export const loginAnUser = async (params: LoginParams = {} as LoginParams, transaction?: EntityManager) =>
  runAuth(async () => {
    const email = (params?.email || '').toLowerCase()
    if (!validateEmail(email)) throw new CustomError(400, 'INVALID_EMAIL')

    const user = await getAUserByEmail(email, transaction)
    const membership = await getOrgMembershipRoles(params?.org_id, user.id, transaction)
    const custom_claims: { roles: string[]; org_brand_id?: string; org_id?: string; [key: string]: unknown } = {
      roles: membership.roles
    }
    if (membership.org_id) custom_claims.org_id = membership.org_id
    if (params?.org_brand_id) custom_claims.org_brand_id = params.org_brand_id

    return authLib.loginAUser({ custom_claims, password: params?.password, user_id: user.id }, transaction)
  })

export interface LoginAnApplicationParams {
  app_name: string
  org_id?: string
  org_brand_id?: string
  token: string
}

export const loginAnApplication = async (
  params: LoginAnApplicationParams = {} as LoginAnApplicationParams,
  transaction?: EntityManager
) => runAuth(() => authLib.loginAnApplication(params, transaction))

export interface VerifyTokenParams {
  token: string
  type: string
}

export const verifyToken = async (params: VerifyTokenParams = {} as VerifyTokenParams, transaction?: EntityManager) =>
  runAuth(() => authLib.verifyTokenForUser(params, transaction))

export interface RefreshTokensParams {
  access_token?: string
  refresh_token: string
  org_id?: string
  org_brand_id?: string
}

export const refreshTokens = async (
  params: RefreshTokensParams = {} as RefreshTokensParams,
  transaction?: EntityManager
) =>
  runAuth(async () => {
    const decoded = authLib.decodeJWTToken(params?.refresh_token) || {}
    const userId = (decoded?.user_id as string) || (decoded?.sub as string) || null
    if (!userId) throw new CustomError(401, 'INVALID_TOKEN')

    const decodedAccess = params?.access_token ? authLib.decodeJWTToken(params?.access_token) || {} : {}
    const orgId = params?.org_id || (decodedAccess?.org_id as string | undefined)
    const membership = await getOrgMembershipRoles(orgId, userId, transaction)

    const custom_claims: Record<string, unknown> = { roles: membership.roles, user_id: userId }
    if (membership.org_id) custom_claims.org_id = membership.org_id
    if (decoded?.contact_id) custom_claims.contact_id = decoded.contact_id
    if (params?.org_brand_id) custom_claims.org_brand_id = params.org_brand_id

    return authLib.refreshTokensForUser({ custom_claims, refresh_token: params?.refresh_token }, transaction)
  })

export const createAuthTokens = async (
  params: authLib.CreateAuthTokensParams = {} as authLib.CreateAuthTokensParams,
  transaction?: EntityManager
) => runAuth(() => authLib.createAuthTokensForUser(params, transaction))

export interface LogoutParams {
  token: string
  type: string
}

export const logout = async (params: LogoutParams = {} as LogoutParams, transaction?: EntityManager) =>
  runAuth(() => authLib.logoutAUser(params, transaction))

export const logoutAUserByAdmin = async (
  params: { user_id: string } = {} as { user_id: string },
  transaction?: EntityManager
) => runAuth(() => authLib.logoutAUserByAdmin(params, transaction))

export interface ChangeEmailParams {
  new_email: string
}

export const changeEmailByUser = async (
  params: ChangeEmailParams = {} as ChangeEmailParams,
  user?: AuthUser,
  transaction?: EntityManager
) =>
  runAuth(async () => {
    const userRow = await getAUserByContext(user, transaction)
    const new_email = (params?.new_email || '').toLowerCase()
    if (!validateEmail(new_email)) throw new CustomError(400, 'INVALID_EMAIL')
    return authLib.changeEmailByUser({ email: userRow.email, new_email }, transaction)
  })

export const cancelChangeEmail = async (user?: AuthUser, transaction?: EntityManager) =>
  runAuth(async () => {
    const userRow = await getAUserByContext(user, transaction)
    return authLib.cancelChangeEmailByUser({ email: userRow.email }, transaction)
  })

export interface VerifyChangeEmailParams {
  token: string
}

export const verifyChangeEmail = async (
  params: VerifyChangeEmailParams = {} as VerifyChangeEmailParams,
  user?: AuthUser,
  transaction?: EntityManager
) =>
  runAuth(async () => {
    if (!user?.user_id) throw new CustomError(401, 'INVALID_TOKEN')
    return authLib.verifyChangeEmailByUser({ token: params?.token, user_id: user?.user_id }, transaction)
  })

export interface ChangeEmailByAdminParams {
  email: string
  new_email: string
}

export const changeEmailByAdmin = async (
  params: ChangeEmailByAdminParams = {} as ChangeEmailByAdminParams,
  transaction?: EntityManager
) => runAuth(() => authLib.changeEmailByAdmin(params, transaction))

export interface ChangePasswordParams {
  old_password: string
  new_password: string
}

export const changePasswordByUser = async (
  params: ChangePasswordParams = {} as ChangePasswordParams,
  user?: AuthUser,
  transaction?: EntityManager
) =>
  runAuth(async () => {
    if (!user?.user_id) throw new CustomError(401, 'INVALID_TOKEN')
    return authLib.changePasswordByUser(
      { new_password: params?.new_password, old_password: params?.old_password, user_id: user?.user_id },
      transaction
    )
  })

export const changePasswordByAdmin = async (
  params: { email: string; password: string } = {} as { email: string; password: string },
  transaction?: EntityManager
) => runAuth(() => authLib.changePasswordByAdmin(params, transaction))

export type ForgotPasswordParams = {
  email: string
}

export const forgotPassword = async (
  params: ForgotPasswordParams = {} as ForgotPasswordParams,
  transaction?: EntityManager
) =>
  runAuth(async () => {
    await authLib.forgotPassword(params, transaction)
    return { message: 'OTP_SENT', success: true }
  })

export const retryForgotPassword = async (
  params: ForgotPasswordParams = {} as ForgotPasswordParams,
  transaction?: EntityManager
) =>
  runAuth(async () => {
    await authLib.retryForgotPassword(params, transaction)
    return { message: 'OTP_SENT', success: true }
  })

export interface VerifyForgotPasswordCodeParams {
  email: string
  token: string
}

export const verifyForgotPasswordCode = async (
  params: VerifyForgotPasswordCodeParams = {} as VerifyForgotPasswordCodeParams,
  transaction?: EntityManager
) => runAuth(() => authLib.verifyForgotPasswordCode(params, transaction))

export interface VerifyForgotPasswordParams {
  email: string
  password: string
  token: string
}

export const verifyForgotPassword = async (
  params: VerifyForgotPasswordParams = {} as VerifyForgotPasswordParams,
  transaction?: EntityManager
) => runAuth(() => authLib.verifyForgotPassword(params, transaction))

export interface VerifyUserPasswordParams {
  password: string
}

export const verifyUserPassword = async (
  params: VerifyUserPasswordParams = {} as VerifyUserPasswordParams,
  user?: AuthUser,
  transaction?: EntityManager
) =>
  runAuth(async () => {
    const userRow = await getAUserByContext(user, transaction)
    return authLib.verifyUserPassword({ email: userRow.email, password: params?.password }, transaction)
  })

export const getMeUserForQuery = async (user?: AuthUser, transaction?: EntityManager) =>
  runAuth(async () => {
    const userRow = await getAUserByContext(user, transaction)
    const organizations = await getOrganizationMembershipsForUser(userRow.id, transaction)
    return { ...sanitizeUser(userRow), organizations }
  })
