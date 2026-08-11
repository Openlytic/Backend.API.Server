import { ApolloServer } from '@apollo/server'
import type { ExpressContextFunctionArgument } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'

import schema from 'src/graphql/schema'
import { getAccessTokenPayload } from 'src/utils/jwt'

export interface GraphQLContext {
  user: {
    sub: string
    orgId?: string
    email?: string
    role?: string | string[]
    [key: string]: unknown
  } | null
}

export const buildGraphQLServer = ({ httpServer }: { httpServer: any }) => {
  const server = new ApolloServer({
    schema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })]
  })

  return server
}

export const buildContext = async ({ req }: ExpressContextFunctionArgument): Promise<GraphQLContext> => {
  const rawHeader = req?.headers?.authorization
  const header = typeof rawHeader === 'string' ? rawHeader : ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const payload = token ? getAccessTokenPayload(token) : null

  if (!payload) return { user: null }
  return { user: payload }
}
