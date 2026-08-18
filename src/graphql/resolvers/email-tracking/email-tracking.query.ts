import { emailTrackingHelper } from 'src/modules/helpers'

export default {
  async getAnEmailAnalytic(
    parent: unknown,
    args: { queryData?: { entity_id?: string } },
    context: { user?: Record<string, unknown> }
  ) {
    return emailTrackingHelper.getAnEmailAnalyticForQuery(args?.queryData, context?.user)
  },
  async getEmailAnalytics(
    parent: unknown,
    args: {
      optionData?: { limit?: number; offset?: number; order?: unknown[] }
      queryData?: { email_id?: string; status?: string }
    },
    context: { user?: Record<string, unknown> }
  ) {
    return emailTrackingHelper.getEmailAnalyticsForQuery(
      { options: args?.optionData, query: args?.queryData },
      context?.user
    )
  },
  async getTrackedLinks(
    parent: unknown,
    args: { queryData?: { email_id?: string } },
    context: { user?: Record<string, unknown> }
  ) {
    return emailTrackingHelper.getTrackedLinksForQuery(args?.queryData, context?.user)
  },
  async getEmailTrackingEvents(
    parent: unknown,
    args: {
      optionData?: { limit?: number; offset?: number; order?: unknown[] }
      queryData?: { email_id?: string; event_type?: string }
    },
    context: { user?: Record<string, unknown> }
  ) {
    return emailTrackingHelper.getEmailTrackingEventsForQuery(
      { options: args?.optionData, query: args?.queryData },
      context?.user
    )
  }
}
