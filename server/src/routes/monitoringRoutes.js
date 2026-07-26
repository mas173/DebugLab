import { Router } from 'express';
import {
  getSystemStats,
  getParticipantsActivity,
  getParticipantDrafts,
} from '../controllers/monitoringController.js';
import { requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

// Admin-only monitoring routes
router.get('/stats', requireAdmin, getSystemStats);
router.get('/participants', requireAdmin, getParticipantsActivity);
router.get('/participants/:id/drafts', requireAdmin, getParticipantDrafts);

export default router;
