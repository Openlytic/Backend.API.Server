import { appQueueHelper } from 'src/modules/helpers'

export default {
  async getAnAppQueue(parent: unknown, args: { queryData?: { entity_id?: string } }) {
    return appQueueHelper.getAnAppQueueForQuery(args?.queryData)
  },
  async getAppQueues(
    parent: unknown,
    args: {
      optionData?: { limit?: number; offset?: number; order?: unknown[] }
      queryData?: Record<string, unknown>
    }
  ) {
    return appQueueHelper.getAppQueuesForQuery({ options: args?.optionData, query: args?.queryData })
  }
}
