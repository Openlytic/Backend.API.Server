import { AuthTokenEntity } from 'src/modules/auth/auth-token.entity'
import { VerificationTokenEntity } from 'src/modules/auth/verification-token.entity'
import { UserEntity } from 'src/modules/user/user.entity'

export const entities: Function[] = [AuthTokenEntity, UserEntity, VerificationTokenEntity]

export { AuthTokenEntity, UserEntity, VerificationTokenEntity }

// Dev-only guard — mirrors Gain; never auto-sync in the request flow.
export const syncDBEntities = async () => {
  // await dataSource.synchronize()
}
