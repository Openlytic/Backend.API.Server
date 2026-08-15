import { organizationHelper } from 'src/modules/helpers'

export default {
  async getAnOrganization(
    parent: unknown,
    args: { queryData?: { entity_id?: string } },
    context: { user?: Record<string, unknown> }
  ) {
    return organizationHelper.getAnOrganizationForQuery(args?.queryData, context?.user)
  },
  async getOrganizations(
    parent: unknown,
    args: {
      queryData?: Record<string, unknown>
      optionData?: { limit?: number; offset?: number; order?: unknown[] }
    },
    context: { user?: Record<string, unknown> }
  ) {
    return organizationHelper.getOrganizationsForQuery(
      { query: args?.queryData, options: args?.optionData },
      context?.user
    )
  }
}
