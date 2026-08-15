import organizationMutations from 'src/graphql/resolvers/organization/organization.mutation'
import organizationQueries from 'src/graphql/resolvers/organization/organization.query'

export const resolvers = {
  Query: {
    health: () => ({ ok: true, uptime: process.uptime() }),
    ...organizationQueries
  },
  Mutation: {
    ...organizationMutations
  }
}
