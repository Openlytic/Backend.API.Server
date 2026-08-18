import type { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm'
import { ILike, In } from 'typeorm'

import { EmailRecipientEntity } from 'src/modules/email-recipient/email-recipient.entity'
import { getEmailRecipients } from 'src/modules/email-recipient/email-recipient.helper'
import { EmailEntity } from 'src/modules/email/email.entity'
import { getRepository } from 'src/utils/database'
import CustomError from 'src/utils/error'

export const getAnEmail = async (options?: FindOneOptions<EmailEntity>, transaction?: EntityManager) =>
  getRepository(EmailEntity, transaction).findOne({ ...options })

export const getEmails = async (options?: FindManyOptions<EmailEntity>, transaction?: EntityManager) =>
  getRepository(EmailEntity, transaction).find({ ...options })

export const countEmails = async (options?: FindManyOptions<EmailEntity>) =>
  getRepository(EmailEntity).count({ ...options })

export const prepareEmailData = (inputData?: Record<string, unknown>): Record<string, unknown> => {
  const data: Record<string, unknown> = {}
  const {
    body_html: bodyHtml,
    is_read: isRead,
    is_trashed: isTrashed,
    snippet,
    stage,
    subject,
    tracking_enabled: trackingEnabled
  } = inputData || {}

  if (typeof subject === 'string' && subject.length) data.subject = subject
  if (typeof bodyHtml === 'string' && bodyHtml.length) data.body_html = bodyHtml
  if (typeof snippet === 'string' && snippet.length) data.snippet = snippet
  if (stage) data.stage = stage
  if (typeof isRead === 'boolean') data.is_read = isRead
  if (typeof isTrashed === 'boolean') data.is_trashed = isTrashed
  if (typeof trackingEnabled === 'boolean') data.tracking_enabled = trackingEnabled

  return data
}

export interface EmailWithRecipients extends Omit<EmailEntity, 'generateId'> {
  recipients?: EmailRecipientEntity[]
}

export const attachRecipients = async (
  emails: EmailEntity[],
  transaction?: EntityManager
): Promise<EmailWithRecipients[]> => {
  if (!emails.length) return []

  const emailIds = emails.map((email) => email.id)
  const recipients = await getEmailRecipients({ where: { email_id: In(emailIds) } }, transaction)

  const grouped = recipients.reduce((groups: Map<string, EmailRecipientEntity[]>, recipient) => {
    const list = groups.get(recipient.email_id) || []
    list.push(recipient)
    groups.set(recipient.email_id, list)
    return groups
  }, new Map<string, EmailRecipientEntity[]>())

  return emails.map((email) => ({
    ...email,
    recipients: grouped.get(email.id) || []
  }))
}

export const getAnEmailForQuery = async (
  params: { entity_id?: string },
  user?: Record<string, unknown>,
  transaction?: EntityManager
): Promise<EmailWithRecipients> => {
  const email = await getAnEmail(
    { where: { id: params?.entity_id, org_id: (user?.org_id as string) || null } },
    transaction
  )
  if (!email?.id) {
    throw new CustomError(404, 'EMAIL_NOT_FOUND')
  }

  const emailsWithRecipients = await attachRecipients([email], transaction)

  return emailsWithRecipients[0]
}

export interface GetEmailsForQueryParams {
  query?: { search_keyword?: string; stage?: string; thread_id?: string }
  options?: { limit?: number; offset?: number; order?: unknown[] }
}

export const getEmailsForQuery = async (
  params: GetEmailsForQueryParams,
  user?: Record<string, unknown>,
  transaction?: EntityManager
) => {
  const { query = {}, options = {} } = params || {}
  const { limit, offset } = options || {}

  const baseWhere: FindOptionsWhere<EmailEntity> = { org_id: (user?.org_id as string) || null }
  const { search_keyword: searchKeyword, stage, thread_id: threadId } = query || {}

  if (stage) baseWhere.stage = stage as never
  if (threadId) baseWhere.thread_id = threadId

  const where: FindOptionsWhere<EmailEntity> | FindOptionsWhere<EmailEntity>[] = searchKeyword
    ? [
        { ...baseWhere, subject: ILike(`%${searchKeyword}%`) },
        { ...baseWhere, snippet: ILike(`%${searchKeyword}%`) }
      ]
    : baseWhere

  const emails = await getEmails({ where, order: { created_at: 'DESC' }, take: limit, skip: offset }, transaction)
  const data = await attachRecipients(emails, transaction)
  const filteredRows = await countEmails({ where })
  const totalRows = await countEmails()

  return { data, meta_data: { filtered_rows: filteredRows, total_rows: totalRows } }
}
