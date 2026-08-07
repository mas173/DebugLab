import { Router } from 'express';
import {
  getAllContests,
  getActiveContest,
  createContest,
  updateContest,
  deleteContest,
  updateContestStatus,
  addContestTime,
  reduceContestTime,
} from '../controllers/contestController.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

// Participant & Admin route - Get active contest
router.get('/active', authenticate, getActiveContest);

// Admin-only routes
router.get('/', requireAdmin, getAllContests);
router.post('/', requireAdmin, createContest);
router.put('/:id', requireAdmin, updateContest);
router.delete('/:id', requireAdmin, deleteContest);
router.post('/:id/status', requireAdmin, updateContestStatus);
router.post('/:id/add-time', requireAdmin, addContestTime);
router.post('/:id/reduce-time', requireAdmin, reduceContestTime);

export default router;
