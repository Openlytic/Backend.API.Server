import type { EntityManager, FindOptionsWhere } from 'typeorm'
import { In } from 'typeorm'

import { createAnAppQueue } from 'src/modules/app-queue/app-queue.service'
import { EmailRecipientEntity, EmailRecipientType } from 'src/modules/email-recipient/email-recipient.entity'
import { getEmailRecipients } from 'src/modules/email-recipient/email-recipient.helper'
import { addRecipients, deleteAnEmailRecipient } from 'src/modules/email-recipient/email-recipient.service'
import { EmailEntity, EmailStage } from 'src/modules/email/email.entity'
import { getAnEmail, getAnEmailForQuery, getEmails, prepareEmailData } from 'src/modules/email/email.helper'
import { getRepository } from 'src/utils/database'
import CustomError from 'src/utils/error'

export const createAnEmail = async (data: Partial<EmailEntity>, transaction?: EntityManager) => {
  const repo = getRepository(EmailEntity, transaction)
  return repo.save(repo.create(data))
}

export const updateAnEmail = async (
  options: FindOptionsWhere<EmailEntity>,
  data: Partial<EmailEntity>,
  transaction?: EntityManager
): Promise<EmailEntity> => {
  const email = await getAnEmail({ where: options }, transaction)
  if (!email?.id) {
    throw new CustomError(404, 'EMAIL_NOT_FOUND')
  }

  await getRepository(EmailEntity, transaction).update(email.id, data)

  return getAnEmail({ where: { id: email.id } }, transaction) as Promise<EmailEntity>
}

export const deleteAnEmail = async (
  options: FindOptionsWhere<EmailEntity>,
  transaction?: EntityManager
): Promise<EmailEntity> => {
  const email = await getAnEmail({ where: options }, transaction)
  if (!email?.id) {
    throw new CustomError(404, 'EMAIL_NOT_FOUND')
  }

  await getRepository(EmailEntity, transaction).delete(email.id)

  return email
}

export const deleteEmails = async (options: FindOptionsWhere<EmailEntity>, transaction?: EntityManager) => {
  const emails = await getEmails({ where: options }, transaction)
  if (emails.length) {
    await getRepository(EmailEntity, transaction).delete(options)
  }

  return emails
}

export interface EmailCreateInputData {
  bcc?: Array<Record<string, unknown> & { email?: string }>
  body_html?: string
  cc?: Array<Record<string, unknown> & { email?: string }>
  snippet?: string
  subject?: string
  thread_id?: string
  to?: Array<Record<string, unknown> & { email?: string }>
}

// Insert the durable send_email job and stub-publish on ready. Fan-out targets are the
// sendable recipients (everyone except the sender); no queue row is created for drafts.
const enqueueEmailSend = async (email: EmailEntity, user?: Record<string, unknown>, transaction?: EntityManager) => {
  const recipients = await getEmailRecipients({ where: { email_id: email.id } }, transaction)
  const toEmails = recipients
    .filter((recipient) => recipient.type !== EmailRecipientType.FROM)
    .map((recipient) => recipient.email)

  if (!toEmails.length) return null

  const appQueue = await createAnAppQueue(
    {
      category: 'send_email',
      destination: 'email',
      event: 'send_email',
      org_id: email.org_id || (user?.org_id as string) || null,
      params: {
        emailId: email.id,
        organizationId: email.org_id || null,
        integrationId: null,
        provider: null,
        toEmails,
        trackingEnabled: false
      }
    },
    user,
    transaction,
    true
  )

  if (!appQueue?.id) {
    throw new CustomError(500, 'FAILED_TO_QUEUE_EMAIL_SENDING')
  }

  return appQueue
}

export const createEmailForMutation = async (
  params?: EmailCreateInputData,
  user?: Record<string, unknown>,
  transaction?: EntityManager
) => {
  const to = params?.to || []
  const cc = params?.cc || []
  const bcc = params?.bcc || []
  const hasSendableRecipients = !!(to.length || cc.length || bcc.length)
  const orgId = (user?.org_id as string) || null

  let parentEmail: EmailEntity | null = null
  if (params?.thread_id) {
    parentEmail = await getAnEmail(
      { where: { thread_id: params.thread_id, org_id: orgId, is_parent: true } },
      transaction
    )
  }

  const createdEmail = await createAnEmail(
    {
      body_html: params?.body_html || null,
      is_parent: !params?.thread_id,
      org_id: orgId,
      org_user_id: (user?.org_user_id as string) || null,
      snippet: params?.snippet || null,
      stage: hasSendableRecipients ? EmailStage.SENT : EmailStage.DRAFT,
      subject: parentEmail?.subject || params?.subject || null,
      thread_id: params?.thread_id || null
    },
    transaction
  )
  if (!createdEmail?.id) {
    throw new CustomError(500, 'COULD_NOT_CREATE_EMAIL')
  }

  if (!createdEmail.thread_id) {
    await getRepository(EmailEntity, transaction).update(createdEmail.id, { thread_id: createdEmail.id })
  }

  await addRecipients(
    {
      email_id: createdEmail.id,
      to,
      cc,
      bcc
    },
    transaction
  )

  if (hasSendableRecipients) {
    await enqueueEmailSend(createdEmail, user, transaction)
  }

  return getAnEmailForQuery({ entity_id: createdEmail.id }, user, transaction)
}

export interface UpdateEmailMutationParams {
  inputData?: Record<string, unknown>
  queryData?: { entity_id?: string }
}

export const updateEmailForMutation = async (
  params?: UpdateEmailMutationParams,
  user?: Record<string, unknown>,
  transaction?: EntityManager
) => {
  const { inputData = {}, queryData = {} } = params || {}
  const orgId = (user?.org_id as string) || null

  const email = await getAnEmail({ where: { id: queryData.entity_id, org_id: orgId } }, transaction)
  if (!email?.id) {
    throw new CustomError(404, 'EMAIL_NOT_FOUND')
  }

  const emailUpdateData = prepareEmailData(inputData)
  if (emailUpdateData.stage === EmailStage.SENT && email.stage === EmailStage.SENT) {
    throw new CustomError(400, 'EMAIL_ALREADY_SENT')
  }

  if (email?.thread_id && typeof inputData?.is_read === 'boolean') {
    await getRepository(EmailEntity, transaction).update({ thread_id: email.thread_id }, { is_read: inputData.is_read })
  }

  if (email?.thread_id && typeof inputData?.is_trashed === 'boolean') {
    if (emailUpdateData.stage) {
      throw new CustomError(400, 'STAGE_CAN_NOT_BE_UPDATED_DUE_TO_TRASH')
    }
    await getRepository(EmailEntity, transaction).update(
      { thread_id: email.thread_id },
      { is_trashed: inputData.is_trashed, trashed_at: new Date() }
    )
  }

  if (Object.keys(emailUpdateData).length) {
    await getRepository(EmailEntity, transaction).update(email.id, emailUpdateData)
  }

  await addRecipients(
    {
      email_id: email.id,
      to: inputData?.to_recipients_for_adding as EmailCreateInputData['to'],
      cc: inputData?.cc_recipients_for_adding as EmailCreateInputData['cc'],
      bcc: inputData?.bcc_recipients_for_adding as EmailCreateInputData['bcc']
    },
    transaction
  )

  const recipientIdsForRemoving = inputData?.recipient_ids_for_removing as string[] | undefined
  if (Array.isArray(recipientIdsForRemoving) && recipientIdsForRemoving.length) {
    const promises = recipientIdsForRemoving.map((recipientId) =>
      deleteAnEmailRecipient({ email_id: email.id, id: recipientId }, transaction)
    )
    await Promise.all(promises)
  }

  if (emailUpdateData.stage === EmailStage.SENT) {
    const reloadedEmail = (await getAnEmail({ where: { id: email.id } }, transaction)) as EmailEntity
    await enqueueEmailSend(reloadedEmail, user, transaction)
  }

  return getAnEmailForQuery({ entity_id: email.id }, user, transaction)
}

export const deleteEmailForMutation = async (
  params: { email_id?: string },
  user?: Record<string, unknown>,
  transaction?: EntityManager
) => {
  const orgId = (user?.org_id as string) || null

  const email = await getAnEmail({ where: { id: params?.email_id, org_id: orgId } }, transaction)
  if (!email?.id) {
    throw new CustomError(404, 'EMAIL_NOT_FOUND')
  }

  const emailRepo = getRepository(EmailEntity, transaction)
  const recipientRepo = getRepository(EmailRecipientEntity, transaction)

  if (email.is_parent) {
    const threadEmails = await getEmails({ where: { thread_id: email.thread_id, org_id: orgId } }, transaction)
    const threadEmailIds = threadEmails.map((item) => item.id)

    if (threadEmailIds.length) {
      await recipientRepo.delete({ email_id: In(threadEmailIds) })
    }
    await emailRepo.delete({ thread_id: email.thread_id, org_id: orgId })

    return { ...email, recipients: [] }
  }

  await recipientRepo.delete({ email_id: email.id })
  await emailRepo.delete({ id: email.id })

  return { ...email, recipients: [] }
}
