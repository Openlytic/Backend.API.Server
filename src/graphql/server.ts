import { ApolloServer } from '@apollo/server'
import type { ExpressContextFunctionArgument } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'

import schema from 'src/graphql/schema'
import { verifyToken } from 'src/modules/auth/auth.service'
import { OrganizationUserEntity, OrganizationUserStatus } from 'src/modules/organization/organization_user.entity'
import { getRepository } from 'src/utils/database'

export interface GraphQLContext {
  user: {
    sub?: string
    user_id?: string
    contact_id?: string
    org_id?: string
    org_brand_id?: string
    org_user_id?: string
    email?: string
    roles?: string[]
    role?: string[]
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

  if (!token) return { user: null }

  const result = await verifyToken({ token, type: 'access_token' })
  if (!result?.success) return { user: null }

  const payload = (result.payload || {}) as {
    sub?: string
    user_id?: string
    contact_id?: string
    org_id?: string
    org_brand_id?: string
    roles?: string[]
  }
  const roles = Array.isArray(payload.roles) ? payload.roles : []

  let orgUserId: string | undefined
  if (payload?.org_id && payload?.user_id) {
    const orgUser = await getRepository(OrganizationUserEntity).findOne({
      where: { org_id: payload.org_id, user_id: payload.user_id, status: OrganizationUserStatus.ACTIVE }
    })
    orgUserId = orgUser?.id
  }

  return {
    user: {
      sub: payload.sub,
      user_id: payload.user_id,
      contact_id: payload.contact_id,
      org_id: payload.org_id,
      org_brand_id: payload.org_brand_id,
      org_user_id: orgUserId,
      roles,
      role: roles
    }
  }
}
