import { expressMiddleware } from '@apollo/server/express4'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import http from 'node:http'

import './env'

// load entities / TypeORM metadata before anything imports helpers/services.
import 'src/modules/entities'

import { buildContext, buildGraphQLServer } from 'src/graphql/server'
import { error } from 'src/middlewares/error'
import { configureAuthRepositories } from 'src/modules/auth/auth-repository'
import { routes } from 'src/routes/index'
import { connectToPostgresDB } from 'src/utils/database'
import { logger } from 'src/utils/logger'

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

app.use(
  '/organization',
  rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: 'Too many requests from this IP, please try again after some moments',
    skip: (req) => req.method !== 'POST'
  })
)

// REST routes (OAuth callback, health, etc.)
app.use('/', routes)

const PORT = process.env.PORT || 8000

const start = async () => {
  await connectToPostgresDB()
  configureAuthRepositories()

  const server = await buildGraphQLServer({ httpServer })
  await server.start()
  // Mounted after 404-less rest routes, BEFORE the 404 catch-all below.
  app.use('/graphql', expressMiddleware(server, { context: buildContext }))

  // error handling

  // 404 wildcard
  app.use((req, res) => {
    res.status(404).json({ message: 'Not Found' })
  })

  app.use(error)

  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => resolve())
  })
  logger.info('server', `Openlytic ready at http://localhost:${PORT}`)
}

start().catch((err) => {
  logger.error('server', 'failed to start', err)
  process.exit(1)
})
