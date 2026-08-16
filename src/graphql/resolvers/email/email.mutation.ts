import { emailService } from 'src/modules/services'
import { useTransaction } from 'src/utils/database'

export default {
  async createEmail(
    parent: unknown,
    args: { inputData?: Record<string, unknown> },
    context: { user?: Record<string, unknown> }
  ) {
    return useTransaction(async (transaction) =>
      emailService.createEmailForMutation(args?.inputData, context?.user, transaction)
    )
  },
  async updateEmail(
    parent: unknown,
    args: { inputData?: Record<string, unknown>; queryData?: { entity_id?: string } },
    context: { user?: Record<string, unknown> }
  ) {
    return useTransaction(async (transaction) =>
      emailService.updateEmailForMutation(
        { inputData: args?.inputData, queryData: args?.queryData },
        context?.user,
        transaction
      )
    )
  },
  async deleteEmail(
    parent: unknown,
    args: { inputData?: { email_id?: string } },
    context: { user?: Record<string, unknown> }
  ) {
    return useTransaction(async (transaction) =>
      emailService.deleteEmailForMutation(args?.inputData, context?.user, transaction)
    )
  }
}
