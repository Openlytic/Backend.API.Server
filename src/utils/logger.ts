import type { TransformableInfo } from 'logform'
import winston from 'winston'

const customFormat = winston.format.printf((info: TransformableInfo) => {
  const meta = info.metadata && Object.keys(info.metadata).length ? ` | ${JSON.stringify(info.metadata)}` : ''
  return `${info.timestamp} [${String(info.level).toUpperCase()}] ${
    (info as unknown as { module?: string }).module || 'app'
  }: ${info.message}${meta}`
})

const logger = winston.createLogger({
  level: process.env.DEBUG ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'module'] }),
    customFormat
  ),
  transports: []
})

logger.add(
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), winston.format.timestamp(), customFormat)
  })
)

export default logger
