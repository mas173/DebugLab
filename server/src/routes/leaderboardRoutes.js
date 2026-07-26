import { Router } from 'express';
import { getLeaderboard } from '../controllers/leaderboardController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Get real-time leaderboard standings
router.get('/', authenticate, getLeaderboard);

export default router;
