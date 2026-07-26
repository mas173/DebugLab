import { Router } from 'express';
import { createSubmission, getSubmissionHistory } from '../controllers/submissionController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { rateLimit } from '../middleware/rateLimiter.js';

const submitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many compilation submissions. Please wait 60 seconds before submitting again.'
});

const router = Router();

// Submit code solution (active participant only)
router.post('/', authenticate, submitLimiter, createSubmission);

// Get submission history log
router.get('/history', authenticate, getSubmissionHistory);

export default router;
