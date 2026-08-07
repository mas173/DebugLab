import { Router } from 'express';
import { login, logout, getMe, updateSelfPassword } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { rateLimit } from '../middleware/rateLimiter.js';

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many login attempts. Please try again after 60 seconds.'
});

const router = Router();

router.post('/login', loginLimiter, login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.put('/password', authenticate, updateSelfPassword);

export default router;
