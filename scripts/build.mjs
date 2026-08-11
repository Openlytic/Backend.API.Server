import { build } from 'esbuild'
import { cpSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

// Fresh dist
rmSync(dist, { recursive: true, force: true })

await build({
  entryPoints: [join(root, 'src', 'server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: join(dist, 'index.js'),
  sourcemap: true,
  metafile: true,
  loader: {
    '.graphql': 'text'
  },
  alias: {
    src: join(root, 'src')
  }
})

// Copy GraphQL SDL files so loadFilesSync() can glob them at runtime next to the bundle.
cpSync(join(root, 'src', 'graphql', 'typeDefs'), join(dist, 'typeDefs'), { recursive: true })

console.log('[build] bundled to dist/index.js')
