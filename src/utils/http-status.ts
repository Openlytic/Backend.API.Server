import CustomError from 'src/utils/error'

export const UPPER_SNAKE_STATUS: Record<string, number> = {
  APPLICATION_IS_NOT_FOUND: 404,
  AUTH_TOKEN_IS_NOT_FOUND: 401,
  INVALID_APPLICATION_TOKEN: 401,
  INVALID_TOKEN: 401,
  OLD_PASSWORD_IS_INCORRECT: 401,
  PASSWORD_IS_INCORRECT: 401,
  REFRESH_TOKEN_IS_INVALID: 401,
  USER_DOES_NOT_EXISTS: 404,
  USER_IS_INACTIVE: 403,
  USER_IS_INVITED: 403,
  USER_IS_NOT_ACTIVE: 403,
  USER_IS_NOT_FOUND: 404,
  USER_IS_UNVERIFIED: 403
}

export const toHttpError = (err: unknown): CustomError => {
  if (err instanceof CustomError) return err
  const message = (err instanceof Error ? err.message : 'INTERNAL_SERVER_ERROR') || 'INTERNAL_SERVER_ERROR'
  return new CustomError(UPPER_SNAKE_STATUS[message] || 400, message)
}
