import { Router } from 'express';
import multer from 'multer';
import {
  getContestProblemsAdmin,
  createProblem,
  updateProblem,
  deleteProblem,
  getProblemTestCases,
  createTestCase,
  deleteTestCase,
  uploadBulkTestCases,
  getContestProblemsParticipant,
  uploadTestCaseFiles,
  saveDraft,
  getDraft,
  runCodeHandler,
} from '../controllers/problemController.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const isText = file.mimetype.startsWith('text/') || 
                   file.originalname.endsWith('.txt') || 
                   file.originalname.endsWith('.in') || 
                   file.originalname.endsWith('.out');
    if (isText) {
      cb(null, true);
    } else {
      cb(new Error('Only plain text files (.txt, .in, .out) are allowed.'));
    }
  }
});

const router = Router();

// Participant routes
router.get('/active', authenticate, getContestProblemsParticipant);
router.post('/draft', authenticate, saveDraft);
router.get('/draft/:problemId', authenticate, getDraft);

// Admin-only problem management routes
router.get('/admin', requireAdmin, getContestProblemsAdmin);
router.post('/admin', requireAdmin, createProblem);
router.put('/admin/:id', requireAdmin, updateProblem);
router.delete('/admin/:id', requireAdmin, deleteProblem);

// Admin-only testcase management routes
router.get('/admin/:problemId/testcases', requireAdmin, getProblemTestCases);
router.post('/admin/:problemId/testcases', requireAdmin, createTestCase);
router.post('/admin/:problemId/testcases/bulk', requireAdmin, uploadBulkTestCases);
router.delete('/admin/testcases/:id', requireAdmin, deleteTestCase);
router.post(
  '/admin/:problemId/testcases/upload',
  requireAdmin,
  upload.fields([
    { name: 'input', maxCount: 1 },
    { name: 'expected_output', maxCount: 1 }
  ]),
  uploadTestCaseFiles
);

// Admin: run code to verify / generate expected output
router.post('/admin/run-code', requireAdmin, runCodeHandler);

export default router;
