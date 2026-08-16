import { emailRecipientHelper } from 'src/modules/helpers'

export default {
  async getEmailRecipients(
    parent: unknown,
    args: {
      optionData?: { limit?: number; offset?: number; order?: unknown[] }
      queryData?: Record<string, unknown>
    }
  ) {
    return emailRecipientHelper.getEmailRecipientsForQuery({
      options: args?.optionData,
      query: args?.queryData
    })
  }
}
