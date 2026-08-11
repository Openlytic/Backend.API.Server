import { Router } from 'express'

const router = Router()

// Health check
router.get('/health', (req, res) => {
  res.json({ ok: true })
})

export const restRoutes = router
export const routes = router
