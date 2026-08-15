import { AuthTokenEntity } from 'src/modules/auth/auth-token.entity'
import { VerificationTokenEntity } from 'src/modules/auth/verification-token.entity'
import { OrganizationEntity } from 'src/modules/organization/organization.entity'
import { OrganizationUserEntity } from 'src/modules/organization/organization_user.entity'
import { ReservedSubDomainEntity } from 'src/modules/organization/reserved-sub-domain.entity'
import { UserEntity } from 'src/modules/user/user.entity'

export const entities: Function[] = [
  AuthTokenEntity,
  OrganizationEntity,
  OrganizationUserEntity,
  ReservedSubDomainEntity,
  UserEntity,
  VerificationTokenEntity
]

export {
  AuthTokenEntity,
  OrganizationEntity,
  OrganizationUserEntity,
  ReservedSubDomainEntity,
  UserEntity,
  VerificationTokenEntity
}

// Dev-only guard — never auto-sync in the request flow.
export const syncDBEntities = async () => {
  // await dataSource.synchronize()
}
