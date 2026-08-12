import type { NextFunction, Request, Response } from 'express'

import type { AuthRequestUser } from 'src/middlewares/authorizer'
import { authService } from 'src/modules/services'
import { useTransaction } from 'src/utils/database'

const handler =
  (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res)
    } catch (err) {
      next(err)
    }
  }

export const userController = {
  preRegisterAnUser: handler(async (req, res) => {
    const data = await useTransaction(async (transaction) => authService.preRegisterAnUser(req.body, transaction))
    res.status(200).json({ data, message: 'Successfully pre-registered!' })
  }),

  registerAnUser: handler(async (req, res) => {
    const data = await useTransaction(async (transaction) => authService.signUp(req.body, transaction))
    res.status(200).json({ data, message: 'Successfully registered!' })
  }),

  verifyEmailForAnUser: handler(async (req, res) => {
    const user = await useTransaction(async (transaction) => authService.verifyUserEmail(req.body, transaction))
    res.status(200).json({ data: { success: true, user }, message: 'Successfully verified user email!' })
  }),

  resendVerificationEmailForAnUser: handler(async (req, res) => {
    await useTransaction(async (transaction) => authService.resendUserVerificationEmail(req.body, transaction))
    res.status(200).json({ data: { success: true }, message: 'Successfully resent verification email!' })
  }),

  loginAnUser: handler(async (req, res) => {
    const data = await useTransaction(async (transaction) => authService.loginAnUser(req.body, transaction))
    res.status(200).json({ data, message: 'Successfully logged in!' })
  }),

  loginAnApplication: handler(async (req, res) => {
    const data = await useTransaction(async (transaction) => authService.loginAnApplication(req.body, transaction))
    res.status(200).json({ data, message: 'Successfully logged in!' })
  }),

  getRefreshedTokensForAnUser: handler(async (req, res) => {
    const data = await useTransaction(async (transaction) => authService.refreshTokens(req.body, transaction))
    res.status(200).json({ data, message: 'Successfully refreshed tokens!' })
  }),

  getAuthUser: handler(async (req, res) => {
    const data = await useTransaction(async (transaction) =>
      authService.getMeUserForQuery(req.user as AuthRequestUser, transaction)
    )
    res.status(200).json({ data, message: 'Successfully fetched user!' })
  }),

  logoutAnUser: handler(async (req, res) => {
    const token = req.headers?.authorization || ''
    const raw = token.startsWith('Bearer ') ? token.slice(7) : token
    await useTransaction(async (transaction) => authService.logout({ token: raw, type: 'access_token' }, transaction))
    res.status(200).json({ data: { success: true }, message: 'Successfully logged out!' })
  }),

  changeEmailOfAnUser: handler(async (req, res) => {
    await useTransaction(async (transaction) => authService.changeEmailByUser(req.body, req.user, transaction))
    res.status(200).json({ data: { success: true }, message: 'Email changed successfully' })
  }),

  cancelChangeEmailOfAnUser: handler(async (req, res) => {
    await useTransaction(async (transaction) => authService.cancelChangeEmail(req.user, transaction))
    res.status(200).json({ data: { success: true }, message: 'Email changed successfully' })
  }),

  verifyNewEmailOfAnUser: handler(async (req, res) => {
    await useTransaction(async (transaction) => authService.verifyChangeEmail(req.body, req.user, transaction))
    res.status(200).json({ data: { success: true }, message: 'Email confirmed successfully' })
  }),

  setUserEmailByAdmin: handler(async (req, res) => {
    await useTransaction(async (transaction) => authService.changeEmailByAdmin(req.body, transaction))
    res.status(200).json({ data: { success: true }, message: 'Email changed successfully' })
  }),

  changePasswordOfAnUser: handler(async (req, res) => {
    await useTransaction(async (transaction) => authService.changePasswordByUser(req.body, req.user, transaction))
    res.status(200).json({ data: { success: true }, message: 'Successfully changed password!' })
  }),

  setUserPasswordByAdmin: handler(async (req, res) => {
    await useTransaction(async (transaction) => authService.changePasswordByAdmin(req.body, transaction))
    res.status(200).json({ data: { success: true }, message: 'Successfully set user password!' })
  }),

  tryForgotPasswordForAnUser: handler(async (req, res) => {
    await useTransaction(async (transaction) => authService.forgotPassword(req.body, transaction))
    res.status(200).json({ data: { success: true }, message: 'Successfully sent verification email!' })
  }),

  retryForgotPasswordOfAnUser: handler(async (req, res) => {
    await useTransaction(async (transaction) => authService.retryForgotPassword(req.body, transaction))
    res.status(200).json({ success: true, message: 'A password reset code is sent to your email' })
  }),

  verifyForgotPasswordForAnUser: handler(async (req, res) => {
    await useTransaction(async (transaction) => authService.verifyForgotPassword(req.body, transaction))
    res.status(200).json({ data: { success: true }, message: 'Successfully reset new password!' })
  }),

  verifyForgotPasswordCodeForAnUser: handler(async (req, res) => {
    await useTransaction(async (transaction) => authService.verifyForgotPasswordCode(req.body, transaction))
    res.status(200).json({ data: { success: true }, message: 'Successfully verified password reset code!' })
  }),

  verifyUserPassword: handler(async (req, res) => {
    const data = await useTransaction(async (transaction) =>
      authService.verifyUserPassword(req.body, req.user, transaction)
    )
    res.status(200).json({ data, message: 'Successfully verified password!' })
  })
}
