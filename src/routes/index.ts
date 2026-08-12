import { Router } from 'express'

import { userRouter } from 'src/modules/user/user.router'

const router = Router()

// Health check
router.get('/health', (req, res) => {
  res.json({ ok: true })
})

// Auth Routes
router.use('/auth', userRouter)

export const restRoutes = router
export const routes = router
