import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'

import env from 'src/env'
import { logger } from 'src/utils/logger'

export interface PublishSendJobParams {
  event?: string
  queue_id?: string
  params?: Record<string, unknown>
}

// SQS transport for the durable `{ event, queue_id, params }` envelope, consumed by the
// `Openlytic.Backend.Service.Email` lambda (simple-queue-service publish).
// Falls back to a stub (log + fake MessageId) when the queue is unreachable (e.g. localstack
// not running) so dev keeps working offline; the app_queue row remains the source of truth.
export const publishSendJob = async (
  params: PublishSendJobParams = {}
): Promise<{ success: boolean; MessageId?: string }> => {
  const { event, queue_id: queueId, params: queueParams = {} } = params || {}

  if (!(event && queueId)) {
    return { success: false }
  }

  try {
    const client = new SQSClient({
      region: env.sqs.region,
      ...(env.sqs.endpoint ? { endpoint: env.sqs.endpoint } : {})
    })
    const response = await client.send(
      new SendMessageCommand({
        QueueUrl: env.sqs.queueUrl,
        MessageBody: JSON.stringify({ event, queue_id: queueId, params: queueParams })
      })
    )

    return { success: true, MessageId: response?.MessageId }
  } catch (error) {
    const publishError = error as { message?: string; code?: string; name?: string }
    logger.warn(
      'server',
      '[openlytic:sqs] publish failed, falling back to stub',
      publishError?.message || publishError?.code || publishError?.name || String(error)
    )
    logger.info('server', '[openlytic:sqs:stub] publishSendJob', { event, queue_id: queueId, params: queueParams })

    return { success: true, MessageId: `stubbed-${Date.now()}` }
  }
}
