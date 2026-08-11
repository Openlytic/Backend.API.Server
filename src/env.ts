import dotenv from 'dotenv'

// Load order matters: .env â†’ .env.local (later overrides earlier), mirroring Gain.io conventions.
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

export interface ProviderConfig {
  clientId: string
  clientSecret: string
  scopes: string[]
}

export interface Env {
  nodeEnv: string
  port: number
  postgresUrl: string
  jwtSecret: string
  jwtAccessExpires: string
  jwtRefreshExpires: string
  encryptionKey: string
  appUrl: string
  apiBaseUrl: string
  provider: {
    gmail: ProviderConfig
    outlook: ProviderConfig
  }
  sqs: {
    endpoint: string
    region: string
    queueUrl: string
  }
}

const env: Env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8000),
  postgresUrl: process.env.POSTGRES_URL || 'postgres://openlytic:openlytic@localhost:5432/openlytic',
  jwtSecret: process.env.JWT_SECRET || 'dev-openlytic-jwt',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '30m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-openlytic-only',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8000',
  provider: {
    gmail: {
      clientId: process.env.GMAIL_CLIENT_ID || '',
      clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
      scopes: (
        process.env.GMAIL_SCOPE ||
        'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/userinfo.email'
      ).split(' ')
    },
    outlook: {
      clientId: process.env.OUTLOOK_CLIENT_ID || '',
      clientSecret: process.env.OUTLOOK_CLIENT_SECRET || '',
      scopes: (process.env.OUTLOOK_SCOPE || 'offline_access Mail.Read Mail.Send User.Read').split(' ')
    }
  },
  sqs: {
    endpoint: process.env.SQS_ENDPOINT || 'http://localhost:4566',
    region: process.env.SQS_REGION || 'us-east-1',
    queueUrl: process.env.SQS_QUEUE_URL || 'http://localhost:4566/000000000000/openlytic-send-queue'
  }
}

export default env
