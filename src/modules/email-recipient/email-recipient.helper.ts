import type { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm'
import { ILike } from 'typeorm'

import { EmailRecipientEntity } from 'src/modules/email-recipient/email-recipient.entity'
import { getRepository } from 'src/utils/database'
import CustomError from 'src/utils/error'

export const getAnEmailRecipient = async (
  options?: FindOneOptions<EmailRecipientEntity>,
  transaction?: EntityManager
) => getRepository(EmailRecipientEntity, transaction).findOne({ ...options })

export const getEmailRecipients = async (
  options?: FindManyOptions<EmailRecipientEntity>,
  transaction?: EntityManager
) => getRepository(EmailRecipientEntity, transaction).find({ ...options })

export const countEmailRecipients = async (options?: FindManyOptions<EmailRecipientEntity>) =>
  getRepository(EmailRecipientEntity).count({ ...options })

export const validateRecipient = (recipient?: Record<string, unknown>): void => {
  const keys = ['contact_org_id', 'contact_person_id', 'org_user_id']
  const present = keys.filter((key) => recipient?.[key] !== undefined)

  if (present.length !== 1) {
    throw new CustomError(400, 'INVALID_RECIPIENT')
  }
}

export const getEmailRecipientsForQuery = async (
  params: {
    query?: { email?: string; email_id?: string; type?: string }
    options?: { limit?: number; offset?: number; order?: unknown[] }
  } = {}
) => {
  const { query = {}, options = {} } = params || {}
  const { limit, offset } = options || {}

  const where: FindOptionsWhere<EmailRecipientEntity> = {}
  const { email, email_id: emailId, type } = query || {}

  if (emailId) where.email_id = emailId
  if (typeof email === 'string' && email.length) where.email = ILike(`%${email}%`)
  if (type) where.type = type as never

  const data = await getEmailRecipients({ where, order: { created_at: 'DESC' }, take: limit, skip: offset })
  const filteredRows = await countEmailRecipients({ where })
  const totalRows = await countEmailRecipients()

  return { data, meta_data: { filtered_rows: filteredRows, total_rows: totalRows } }
}
