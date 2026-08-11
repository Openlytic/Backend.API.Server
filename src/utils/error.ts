export default class CustomError extends Error {
  statusCode: number

  metadata?: Record<string, unknown>

  constructor(statusCode?: number, message?: string, metadata?: Record<string, unknown>) {
    super(message || 'Internal Server Error')
    this.statusCode = statusCode || 500
    this.metadata = metadata
  }
}
