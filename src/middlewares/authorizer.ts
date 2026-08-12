import type { Request as ExpressRequest, NextFunction, Response } from 'express'

import { authService } from 'src/modules/services'
import CustomError from 'src/utils/error'

export interface AuthRequestUser {
  sub?: string
  user_id?: string
  contact_id?: string
  org_id?: string
  org_brand_id?: string
  roles?: string[]
  [key: string]: unknown
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthRequestUser
    }
  }
}

const extractToken = (authorization: string | undefined): string => {
  if (!authorization) return ''
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : authorization
}

export const authorizer = (requiredRoles: string[] = []) => {
  const callback = async (req: ExpressRequest, res: Response, next: NextFunction) => {
    try {
      const token = extractToken(req.headers?.authorization)
      if (!token) {
        throw new CustomError(401, 'MISSING_TOKEN')
      }

      const result = await authService.verifyToken({ token, type: 'access_token' })
      if (!result?.success || !result?.payload) {
        throw new CustomError(401, 'UNAUTHORIZED')
      }

      req.user = result.payload as AuthRequestUser

      if (requiredRoles.length) {
        const hasRole = (req.user?.roles || []).some((role: string) => requiredRoles.includes(role))
        if (!hasRole) {
          throw new CustomError(403, 'MISSING_REQUIRED_ROLES')
        }
      }

      return next()
    } catch (err) {
      return next(err)
    }
  }

  return callback
}
