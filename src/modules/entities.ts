import { AppQueueEntity } from 'src/modules/app-queue/app-queue.entity'
import { AuthTokenEntity } from 'src/modules/auth/auth-token.entity'
import { VerificationTokenEntity } from 'src/modules/auth/verification-token.entity'
import { EmailRecipientEntity } from 'src/modules/email-recipient/email-recipient.entity'
import { EmailEntity } from 'src/modules/email/email.entity'
import { OrganizationEntity } from 'src/modules/organization/organization.entity'
import { OrganizationUserEntity } from 'src/modules/organization/organization_user.entity'
import { ReservedSubDomainEntity } from 'src/modules/organization/reserved-sub-domain.entity'
import { UserEntity } from 'src/modules/user/user.entity'

export const entities: Function[] = [
  AppQueueEntity,
  AuthTokenEntity,
  EmailEntity,
  EmailRecipientEntity,
  OrganizationEntity,
  OrganizationUserEntity,
  ReservedSubDomainEntity,
  UserEntity,
  VerificationTokenEntity
]

export {
  AppQueueEntity,
  AuthTokenEntity,
  EmailEntity,
  EmailRecipientEntity,
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
