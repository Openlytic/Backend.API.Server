import { expressMiddleware } from '@apollo/server/express4'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import http from 'node:http'

import './env'

// load entities / TypeORM metadata before anything imports helpers/services.
import 'src/modules/entities'

import { buildContext, buildGraphQLServer } from 'src/graphql/server'
import { routes } from 'src/routes/index'
import { connectToPostgresDB } from 'src/utils/database'

const app = express()
const httpServer = http.createServer(app)

// Global middleware
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 50,
    message: 'Too many requests -- slow down.'
  })
)

// REST routes (OAuth callback, health, etc.)
app.use('/', routes)

const PORT = process.env.PORT || 8000

const start = async () => {
  await connectToPostgresDB()

  const server = await buildGraphQLServer({ httpServer })
  await server.start()
  // Mounted after 404-less rest routes, BEFORE the 404 catch-all below.
  app.use('/graphql', expressMiddleware(server, { context: buildContext }))

  // 404
  app.use((req, res) => {
    res.status(404).json({ message: 'Not Found' })
  })

  // error middleware (signature keeps next for express error handling)
  app.use((err: any, req: express.Request, res: express.Response, nextInternal?: any) => {
    nextInternal?.()
    const status = err.statusCode || 500
    res.status(status).json({ message: err.message || 'Internal Server Error' })
  })

  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => resolve())
  })
  console.log(`[server] GraphQL ready at http://localhost:${PORT}/graphql`)
}

start().catch((err) => {
  console.error('[server] failed to start', err)
  process.exit(1)
})
