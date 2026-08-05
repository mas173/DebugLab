import { Router } from 'express';
import { getLeaderboard } from '../controllers/leaderboardController.js';
import { requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

// Get real-time leaderboard standings (Admin only)
router.get('/', requireAdmin, getLeaderboard);

export default router;
