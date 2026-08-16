import { emailHelper } from 'src/modules/helpers'

const filterRecipientsByType = (email: { recipients?: Array<{ type?: string }> }, type: string) =>
  (email?.recipients || []).filter((recipient) => recipient?.type === type)

export const emailFieldResolvers = {
  Email: {
    bcc: (email: { recipients?: Array<{ type?: string }> }) => filterRecipientsByType(email, 'bcc'),
    cc: (email: { recipients?: Array<{ type?: string }> }) => filterRecipientsByType(email, 'cc'),
    from: (email: { recipients?: Array<{ type?: string }> }) => filterRecipientsByType(email, 'from'),
    to: (email: { recipients?: Array<{ type?: string }> }) => filterRecipientsByType(email, 'to')
  }
}

export default {
  async getAnEmail(
    parent: unknown,
    args: { queryData?: { entity_id?: string } },
    context: { user?: Record<string, unknown> }
  ) {
    return emailHelper.getAnEmailForQuery(args?.queryData, context?.user)
  },
  async getEmails(
    parent: unknown,
    args: {
      optionData?: { limit?: number; offset?: number; order?: unknown[] }
      queryData?: Record<string, unknown>
    },
    context: { user?: Record<string, unknown> }
  ) {
    return emailHelper.getEmailsForQuery({ options: args?.optionData, query: args?.queryData }, context?.user)
  }
}
