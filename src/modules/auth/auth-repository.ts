import type { AuthEntityName } from '@openlytic/auth'
import { configureRepositoryAccessor } from '@openlytic/auth'
import type { EntityManager, Repository } from 'typeorm'

import { AuthTokenEntity } from 'src/modules/auth/auth-token.entity'
import { VerificationTokenEntity } from 'src/modules/auth/verification-token.entity'
import { UserEntity } from 'src/modules/user/user.entity'
import { dataSource } from 'src/utils/database'

const entityAccessorMap: Record<AuthEntityName, Function> = {
  auth_token: AuthTokenEntity,
  user: UserEntity,
  verification_token: VerificationTokenEntity
}

export const configureAuthRepositories = (): void => {
  configureRepositoryAccessor((name, transaction?: EntityManager) => {
    const entity = entityAccessorMap[name]
    return (transaction ? transaction.getRepository(entity) : dataSource.getRepository(entity)) as Repository<unknown>
  })
}
