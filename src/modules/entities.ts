import { AppQueueEntity } from 'src/modules/app-queue/app-queue.entity'
import { AuthTokenEntity } from 'src/modules/auth/auth-token.entity'
import { VerificationTokenEntity } from 'src/modules/auth/verification-token.entity'
import { EmailRecipientEntity } from 'src/modules/email-recipient/email-recipient.entity'
import { EmailAnalyticEntity } from 'src/modules/email-tracking/email-analytic.entity'
import { EmailTrackingEventEntity } from 'src/modules/email-tracking/email-tracking-event.entity'
import { TrackedLinkEntity } from 'src/modules/email-tracking/tracked-link.entity'
import { EmailEntity } from 'src/modules/email/email.entity'
import { OrganizationEntity } from 'src/modules/organization/organization.entity'
import { OrganizationUserEntity } from 'src/modules/organization/organization_user.entity'
import { ReservedSubDomainEntity } from 'src/modules/organization/reserved-sub-domain.entity'
import { UserEntity } from 'src/modules/user/user.entity'

export const entities: Function[] = [
  AppQueueEntity,
  AuthTokenEntity,
  EmailAnalyticEntity,
  EmailEntity,
  EmailRecipientEntity,
  EmailTrackingEventEntity,
  OrganizationEntity,
  OrganizationUserEntity,
  ReservedSubDomainEntity,
  TrackedLinkEntity,
  UserEntity,
  VerificationTokenEntity
]

export {
  AppQueueEntity,
  AuthTokenEntity,
  EmailAnalyticEntity,
  EmailEntity,
  EmailRecipientEntity,
  EmailTrackingEventEntity,
  OrganizationEntity,
  OrganizationUserEntity,
  ReservedSubDomainEntity,
  TrackedLinkEntity,
  UserEntity,
  VerificationTokenEntity
}

// Dev-only guard — never auto-sync in the request flow.
export const syncDBEntities = async () => {
  // await dataSource.synchronize()
}
