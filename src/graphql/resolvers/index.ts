// Resolver aggregates. Populated per feature branch.
export const resolvers = {
  Query: {
    health: () => ({ ok: true, uptime: process.uptime() })
  },
  Mutation: {}
}
