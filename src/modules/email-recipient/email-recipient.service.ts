import type { EntityManager, FindOptionsWhere } from 'typeorm'

import { checkRequiredFields } from 'src/modules/common/common.helper'
import { EmailRecipientEntity } from 'src/modules/email-recipient/email-recipient.entity'
import { getAnEmailRecipient, validateRecipient } from 'src/modules/email-recipient/email-recipient.helper'
import { getRepository } from 'src/utils/database'
import CustomError from 'src/utils/error'

export const createAnEmailRecipient = async (data: Partial<EmailRecipientEntity>, transaction?: EntityManager) => {
  const repo = getRepository(EmailRecipientEntity, transaction)
  return repo.save(repo.create(data))
}

export const createEmailRecipients = async (data: Partial<EmailRecipientEntity>[], transaction?: EntityManager) => {
  const repo = getRepository(EmailRecipientEntity, transaction)
  return repo.save(repo.create(data))
}

export const updateAnEmailRecipient = async (
  options: FindOptionsWhere<EmailRecipientEntity>,
  data: Partial<EmailRecipientEntity>,
  transaction?: EntityManager
): Promise<EmailRecipientEntity> => {
  const emailRecipient = await getAnEmailRecipient({ where: options }, transaction)
  if (!emailRecipient?.id) {
    throw new CustomError(404, 'EMAIL_RECIPIENT_NOT_FOUND')
  }

  await getRepository(EmailRecipientEntity, transaction).update(emailRecipient.id, data)

  return getAnEmailRecipient({ where: { id: emailRecipient.id } }, transaction) as Promise<EmailRecipientEntity>
}

export const deleteAnEmailRecipient = async (
  options: FindOptionsWhere<EmailRecipientEntity>,
  transaction?: EntityManager
): Promise<EmailRecipientEntity> => {
  const emailRecipient = await getAnEmailRecipient({ where: options }, transaction)
  if (!emailRecipient?.id) {
    throw new CustomError(404, 'EMAIL_RECIPIENT_NOT_FOUND')
  }

  await getRepository(EmailRecipientEntity, transaction).delete(emailRecipient.id)

  return emailRecipient
}

export interface RecipientInput {
  contact_org_id?: string
  contact_person_id?: string
  email?: string
  org_user_id?: string
}

export const validateAndCreateEmailRecipients = async (
  params: {
    email_id?: string
    recipients?: RecipientInput[]
    type?: string
  },
  transaction?: EntityManager
) => {
  const { email_id: emailId, recipients = [], type } = params || {}
  if (!recipients?.length) return

  const creationData = recipients.map((recipient) => {
    checkRequiredFields(['email'], recipient as Record<string, unknown>)
    validateRecipient(recipient as Record<string, unknown>)

    return {
      email_id: emailId,
      email: recipient?.email,
      ...(recipient?.contact_org_id ? { contact_org_id: recipient.contact_org_id } : {}),
      ...(recipient?.contact_person_id ? { contact_person_id: recipient.contact_person_id } : {}),
      ...(recipient?.org_user_id ? { org_user_id: recipient.org_user_id } : {}),
      type
    }
  })

  await createEmailRecipients(creationData as Partial<EmailRecipientEntity>[], transaction)
}

export const addRecipients = async (
  params: {
    bcc?: RecipientInput[]
    cc?: RecipientInput[]
    email_id?: string
    from?: RecipientInput[]
    to?: RecipientInput[]
  },
  transaction?: EntityManager
) => {
  const { bcc = [], cc = [], email_id: emailId, from = [], to = [] } = params || {}

  if (from.length) {
    await validateAndCreateEmailRecipients({ email_id: emailId, recipients: from, type: 'from' }, transaction)
  }
  if (to.length) {
    await validateAndCreateEmailRecipients({ email_id: emailId, recipients: to, type: 'to' }, transaction)
  }
  if (cc.length) {
    await validateAndCreateEmailRecipients({ email_id: emailId, recipients: cc, type: 'cc' }, transaction)
  }
  if (bcc.length) {
    await validateAndCreateEmailRecipients({ email_id: emailId, recipients: bcc, type: 'bcc' }, transaction)
  }
}
