import appQueueQueries from 'src/graphql/resolvers/app-queue/app-queue.query'
import emailRecipientQueries from 'src/graphql/resolvers/email-recipient/email-recipient.query'
import emailTrackingQueries from 'src/graphql/resolvers/email-tracking/email-tracking.query'
import emailMutations from 'src/graphql/resolvers/email/email.mutation'
import emailQueries, { emailFieldResolvers } from 'src/graphql/resolvers/email/email.query'
import organizationMutations from 'src/graphql/resolvers/organization/organization.mutation'
import organizationQueries from 'src/graphql/resolvers/organization/organization.query'

export const resolvers = {
  Query: {
    health: () => ({ ok: true, uptime: process.uptime() }),
    ...organizationQueries,
    ...emailQueries,
    ...emailRecipientQueries,
    ...emailTrackingQueries,
    ...appQueueQueries
  },
  Mutation: {
    ...organizationMutations,
    ...emailMutations
  },
  ...emailFieldResolvers
}
