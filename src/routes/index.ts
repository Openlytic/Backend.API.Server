import { Router } from 'express'

import { organizationRouter } from 'src/modules/organization/organization.router'
import { userRouter } from 'src/modules/user/user.router'

const router = Router()

// Health check
router.get('/health', (req, res) => {
  res.json({ ok: true })
})

// Auth Routes
router.use('/auth', userRouter)

// Organization Routes
router.use('/organization', organizationRouter)

export const restRoutes = router
export const routes = router
