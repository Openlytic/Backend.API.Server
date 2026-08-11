import { getDirectives, MapperKind, mapSchema } from '@graphql-tools/utils'
import { defaultFieldResolver, GraphQLSchema } from 'graphql'

// @auth directive evaluates JWT payload role claims (mirrors Gain.io).
// Normalizes getDirectives() both return shapes:
//   older: { auth: { roles: [...] } }
//   newer: [{ name: 'auth', args: { roles: [...] } }]
export const authDirective = (schema: GraphQLSchema): GraphQLSchema =>
  mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const directives = getDirectives(schema, fieldConfig) || []
      let found: { name?: string; args?: { roles?: unknown }; roles?: unknown } | undefined
      if (Array.isArray(directives)) {
        found = directives.find((d) => d?.name === 'auth' || d?.name === 'Auth') as typeof found
      } else if (directives && typeof directives === 'object') {
        const obj = directives as Record<string, { roles?: unknown }>
        found = obj.auth || obj.Auth
      }
      if (!found) return fieldConfig

      const roles = Array.isArray(directives)
        ? (found.args?.roles as unknown[] | undefined) || []
        : (found as { roles?: unknown[] }).roles
      const normalizedRoles: unknown[] = Array.isArray(roles) ? roles : []

      const { resolve = defaultFieldResolver } = fieldConfig
      fieldConfig.resolve = async function authResolve(source, args, context, info) {
        const { user } = context as { user?: { role?: string | string[] } | null }
        if (!user) throw new Error('Unauthorized')
        if (normalizedRoles.length) {
          const ok = Array.isArray(user.role)
            ? user.role.some((r: string) => (normalizedRoles as string[]).includes(r))
            : (normalizedRoles as string[]).includes(user.role as string)
          if (!ok) throw new Error('Forbidden')
        }
        return resolve.call(this, source, args, context, info)
      }
      return fieldConfig
    }
  })
