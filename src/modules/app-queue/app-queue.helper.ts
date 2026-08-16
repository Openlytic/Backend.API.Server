import type { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm'
import { In } from 'typeorm'

import { AppQueueEntity, AppQueueStatus } from 'src/modules/app-queue/app-queue.entity'
import { commonHelper } from 'src/modules/helpers'
import { getRepository } from 'src/utils/database'
import CustomError from 'src/utils/error'

export const getAnAppQueue = async (options?: FindOneOptions<AppQueueEntity>, transaction?: EntityManager) =>
  getRepository(AppQueueEntity, transaction).findOne({ ...options })

export const getAppQueues = async (options?: FindManyOptions<AppQueueEntity>, transaction?: EntityManager) =>
  getRepository(AppQueueEntity, transaction).find({ ...options })

export const countAppQueues = async (options?: FindManyOptions<AppQueueEntity>) =>
  getRepository(AppQueueEntity).count({ ...options })

export const prepareAppQueueCreatingData = async (
  data: Partial<AppQueueEntity>,
  user: Record<string, unknown>,
  transaction?: EntityManager
): Promise<Partial<AppQueueEntity>> => {
  const safeUser = user || {}

  if (commonHelper.validateUUID(safeUser?.user_id as string)) {
    data.created_by = safeUser?.user_id as string
  }
  const orgId = (data?.org_id || safeUser?.org_id) as string | undefined
  if (commonHelper.validateUUID(orgId as string)) {
    data.org_id = orgId
  }
  if (data?.category && data?.status !== AppQueueStatus.HOLD) {
    const existingRunningQueue = await getAnAppQueue(
      {
        where: {
          category: data.category,
          ...(data.org_id ? { org_id: data.org_id } : {}),
          status: In([AppQueueStatus.READY, AppQueueStatus.SENT, AppQueueStatus.PROCESSING])
        }
      },
      transaction
    )

    if (existingRunningQueue?.id) {
      data.status = AppQueueStatus.HOLD
    }
  }

  return data
}

export const prepareAppQueueQuery = (query?: Record<string, unknown>): FindOptionsWhere<AppQueueEntity> => {
  const where: FindOptionsWhere<AppQueueEntity> = {}

  if (query?.category) where.category = query.category as string
  if (query?.destination) where.destination = query.destination as string
  if (query?.event) where.event = query.event as string
  if (query?.org_id) where.org_id = query.org_id as string
  if (Array.isArray(query?.statuses) && (query.statuses as unknown[]).length) {
    where.status = In(query.statuses as AppQueueStatus[]) as never
  }

  return where
}

export const getAnAppQueueForQuery = async (params: { entity_id?: string } = {}) => {
  const appQueue = await getAnAppQueue({ where: { id: params?.entity_id } })
  if (!appQueue?.id) {
    throw new CustomError(404, 'APP_QUEUE_NOT_FOUND')
  }

  return appQueue
}

export const getAppQueuesForQuery = async (
  params: {
    query?: Record<string, unknown>
    options?: { limit?: number; offset?: number; order?: unknown[] }
  } = {}
) => {
  const { query = {}, options = {} } = params || {}
  const { limit, offset } = options || {}

  const where = prepareAppQueueQuery(query)
  const data = await getAppQueues({ where, order: { created_at: 'DESC' }, take: limit, skip: offset })
  const filteredRows = await countAppQueues({ where })
  const totalRows = await countAppQueues()

  return { data, meta_data: { filtered_rows: filteredRows, total_rows: totalRows } }
}
