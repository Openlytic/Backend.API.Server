import { organizationService } from 'src/modules/services'
import { useTransaction } from 'src/utils/database'

export default {
  async createAnOrganization(
    parent: unknown,
    args: { inputData?: Record<string, unknown> },
    context: { user?: Record<string, unknown> }
  ) {
    return useTransaction(async (transaction) =>
      organizationService.createAnOrganizationForMutation(args?.inputData, context?.user, transaction)
    )
  },
  async updateAnOrganization(
    parent: unknown,
    args: { queryData?: { entity_id?: string }; inputData?: Record<string, unknown> },
    context: { user?: Record<string, unknown> }
  ) {
    return useTransaction(async (transaction) =>
      organizationService.updateAnOrganizationForMutation(
        { queryData: args?.queryData, inputData: args?.inputData },
        context?.user,
        transaction
      )
    )
  },
  async deleteAnOrganization(
    parent: unknown,
    args: { inputData?: { org_id?: string } },
    context: { user?: Record<string, unknown> }
  ) {
    return useTransaction(async (transaction) =>
      organizationService.deleteAnOrganizationForMutation(args?.inputData, transaction)
    )
  }
}
