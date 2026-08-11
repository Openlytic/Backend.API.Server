import jwt, { SignOptions } from 'jsonwebtoken'

import CustomError from 'src/utils/error'

export interface AccessTokenPayload {
  sub: string
  orgId?: string
  email?: string
  typ: 'access'
  name?: string
  role?: string | string[]
  [key: string]: unknown
}

const secret = () => process.env.JWT_SECRET || 'dev-openlytic-secret'

const signOptions = (): SignOptions => ({
  expiresIn: (process.env.JWT_ACCESS_EXPIRES || '30m') as SignOptions['expiresIn']
})

const refreshOptions = (): SignOptions => ({
  expiresIn: (process.env.JWT_REFRESH_EXPIRES || '30d') as SignOptions['expiresIn']
})

export const signAccessToken = (payload: Record<string, unknown>): string => jwt.sign(payload, secret(), signOptions())

export const signRefreshToken = (payload: Record<string, unknown>): string =>
  jwt.sign(payload, secret(), refreshOptions())

export const verifyToken = (token: string): AccessTokenPayload => jwt.verify(token, secret()) as AccessTokenPayload

export const getAccessTokenPayload = (token: string): AccessTokenPayload => {
  try {
    const decoded = verifyToken(token)
    if (!decoded?.typ || decoded.typ !== 'access') {
      throw new CustomError(401, 'Invalid access token')
    }
    return decoded
  } catch (err) {
    if (err instanceof CustomError) throw err
    throw new CustomError(401, 'Invalid or expired token')
  }
}
