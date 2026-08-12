import type { NextFunction, Request, Response } from 'express'

export const error = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err)
  }

  const status = (err as { statusCode?: number })?.statusCode || 500
  const message = (err as Error)?.message || 'INTERNAL_SERVER_ERROR'
  const metadata = (err as { metadata?: Record<string, unknown> })?.metadata

  return res.status(status).json(metadata ? { message, metadata } : { message })
}
