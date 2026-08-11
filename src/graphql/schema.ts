import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { authDirective } from 'src/graphql/directives/auth'
import { resolvers } from 'src/graphql/resolvers/index'

// Works both for tsx dev (src/graphql/schema.ts) and bundled CJS (dist/index.js).
const moduleDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

const resolveTypeDefsDir = () => {
  const candidates = [path.join(moduleDir, 'typeDefs'), path.join(path.resolve(moduleDir, '..'), 'typeDefs')]
  return candidates.find((dir) => existsSync(dir)) || path.join(moduleDir, 'typeDefs')
}

const typeDefs = loadFilesSync(path.join(resolveTypeDefsDir(), './**/*.graphql'))

const baseSchema = makeExecutableSchema({ typeDefs: mergeTypeDefs(typeDefs), resolvers })

const schema = authDirective(baseSchema)

export default schema
