import { Router } from 'express'

import { authorizer } from 'src/middlewares/authorizer'
import { userController } from 'src/modules/user/user.controller'

export const userRouter = Router()

userRouter.post('/pre-register', userController.preRegisterAnUser)

userRouter.post('/register', userController.registerAnUser)

userRouter.post('/verify', userController.verifyEmailForAnUser)

userRouter.post('/resend-verification', userController.resendVerificationEmailForAnUser)

userRouter.post('/login', userController.loginAnUser)

userRouter.post('/app-login', userController.loginAnApplication)

userRouter.post('/refresh-token', userController.getRefreshedTokensForAnUser)

userRouter.get('/user', authorizer(), userController.getAuthUser)

userRouter.post('/logout', authorizer(), userController.logoutAnUser)

userRouter.post('/change-email', authorizer(), userController.changeEmailOfAnUser)

userRouter.post('/cancel-change-email', authorizer(), userController.cancelChangeEmailOfAnUser)

userRouter.post('/verify-change-email', authorizer(), userController.verifyNewEmailOfAnUser)

userRouter.post('/set-user-email', authorizer(['admin', 'manager', 'org_owner']), userController.setUserEmailByAdmin)

userRouter.post('/change-password', authorizer(), userController.changePasswordOfAnUser)

userRouter.post('/set-user-password', authorizer(['admin', 'manager']), userController.setUserPasswordByAdmin)

userRouter.post('/forgot-password', userController.tryForgotPasswordForAnUser)

userRouter.post('/retry-forgot-password', userController.retryForgotPasswordOfAnUser)

userRouter.post('/verify-forgot-password', userController.verifyForgotPasswordForAnUser)

userRouter.post('/verify-forgot-password-code', userController.verifyForgotPasswordCodeForAnUser)

userRouter.post('/verify-user-password', authorizer(), userController.verifyUserPassword)
