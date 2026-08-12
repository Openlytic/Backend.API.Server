import type { TransformableInfo } from 'logform'
import util from 'node:util'
import winston from 'winston'

const prepareRestString = (rest: unknown[]): string => {
  if (!rest.length) return ''
  return ` ${rest.map((arg) => util.inspect(arg, { depth: null, colors: false })).join(', ')}`
}

const winstonLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info: TransformableInfo) => {
      const rest = Array.isArray(info.rest) ? info.rest : []
      const message = `[${String(info.level).toUpperCase()}] [${String(info.module).toUpperCase()}] [${String(
        info.timestamp
      )}]:- ${String(info.message)}${prepareRestString(rest)}`
      return winston.format.colorize().colorize('info', message)
    })
  ),
  transports: [new winston.transports.Console()]
})

const shouldLog = (module: string): boolean => {
  if (!(process.env.DEBUG === 'true') && module !== 'server') return false
  const debugModule = process.env.DEBUG_MODULE || ''
  return module === 'server' || debugModule === 'global' || debugModule === module
}

const logMessage = (level: string, module: string, message: string, rest: unknown[]): void => {
  if (!shouldLog(module)) return
  winstonLogger.log({ level, message, module, rest })
}

export const logger = {
  debug: (module: string, message: string, ...rest: unknown[]) => logMessage('debug', module, message, rest),
  error: (module: string, message: string, ...rest: unknown[]) => logMessage('error', module, message, rest),
  info: (module: string, message: string, ...rest: unknown[]) => logMessage('info', module, message, rest),
  warn: (module: string, message: string, ...rest: unknown[]) => logMessage('warn', module, message, rest)
}
