import 'reflect-metadata'
import { DataSource, EntityManager, EntityTarget, Repository } from 'typeorm'

import env from 'src/env'
import { entities } from 'src/modules/entities'
import CustomError from 'src/utils/error'

export const dataSource = new DataSource({
  type: 'postgres',
  url: env.postgresUrl,
  entities,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error'] : false,
  extra: {
    max: Number(process.env.POSTGRES_POOL_MAX) || 10,
    min: 0,
    acquireTimeoutMillis: 60000,
    idleTimeoutMillis: 10000
  },
  ssl: process.env.NODE_ENV === 'production' ? ({ require: true, rejectUnauthorized: false } as any) : false
})

export const connectToPostgresDB = async () => {
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize()
    }
  } catch (error) {
    console.error('[db] Unable to connect:', error)
  }
}

/**
 * Transaction manager-aware repository helper. Returns a TypeORM repository
 * bound to the active transaction (or the global DataSource when no tx).
 */
export const getRepository = <Entity>(entity: EntityTarget<Entity>, transaction?: EntityManager): Repository<Entity> =>
  transaction ? transaction.getRepository(entity) : dataSource.getRepository(entity)

/**
 * Transaction wrapper used by `…ForMutation` services. Sets a 40s lock_timeout
 * before the transaction (mirrors Gain.io / Sequelize behaviour).
 */
export const useTransaction = async <T>(callback: (transaction: EntityManager) => Promise<T>): Promise<T> => {
  try {
    await dataSource.query('SET lock_timeout TO 40000')
    return dataSource.transaction(callback)
  } catch (err) {
    throw new CustomError((err as { statusCode?: number })?.statusCode || 500, (err as Error)?.message)
  }
}

export default dataSource
