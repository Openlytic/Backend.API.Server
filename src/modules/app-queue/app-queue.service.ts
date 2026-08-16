import type { EntityManager, FindOptionsWhere } from 'typeorm'

import { AppQueueEntity, AppQueueStatus } from 'src/modules/app-queue/app-queue.entity'
import { getAnAppQueue, prepareAppQueueCreatingData } from 'src/modules/app-queue/app-queue.helper'
import { getRepository } from 'src/utils/database'
import CustomError from 'src/utils/error'
import { publishSendJob } from 'src/utils/sqs-client'

export const initiateSendingQueueMessage = async (appQueueId?: string, transaction?: EntityManager) => {
  if (!appQueueId) {
    return null
  }

  const appQueue = await getAnAppQueue({ where: { id: appQueueId } }, transaction)
  if (!appQueue?.id) {
    return null
  }
  if (!appQueue?.destination) {
    return null
  }
  if (appQueue?.status !== AppQueueStatus.READY) {
    return null
  }

  await getRepository(AppQueueEntity, transaction).update(appQueue.id, { status: AppQueueStatus.SENT })

  const { success } = await publishSendJob({
    event: appQueue.event,
    queue_id: appQueue.id,
    params: appQueue.params as Record<string, unknown>
  })

  if (!success) {
    await getRepository(AppQueueEntity, transaction).update(appQueue.id, { status: AppQueueStatus.FAILED })
  }

  return getAnAppQueue({ where: { id: appQueue.id } }, transaction)
}

export const createAnAppQueue = async (
  data: Partial<AppQueueEntity>,
  user: Record<string, unknown>,
  transaction?: EntityManager,
  haveToSendSQS = false
): Promise<AppQueueEntity> => {
  await prepareAppQueueCreatingData(data, user, transaction)

  const repo = getRepository(AppQueueEntity, transaction)
  const appQueue = await repo.save(repo.create(data))
  if (!appQueue?.id) {
    throw new CustomError(404, 'App queue creation failed')
  }

  if (haveToSendSQS) {
    await initiateSendingQueueMessage(appQueue.id, transaction)
  }

  return appQueue
}

export const updateAnAppQueue = async (
  options: FindOptionsWhere<AppQueueEntity>,
  data: Partial<AppQueueEntity>,
  transaction?: EntityManager
): Promise<AppQueueEntity> => {
  const appQueue = await getAnAppQueue({ where: options }, transaction)
  if (!appQueue?.id) {
    throw new CustomError(404, 'APP_QUEUE_NOT_FOUND')
  }

  await getRepository(AppQueueEntity, transaction).update(appQueue.id, data)

  return getAnAppQueue({ where: { id: appQueue.id } }, transaction) as Promise<AppQueueEntity>
}
