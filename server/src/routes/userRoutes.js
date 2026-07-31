import { Router } from 'express';
import { getUsers, createUser, deleteUser, updateUserPassword } from '../controllers/userController.js';
import { requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

// Admin-only user management routes
router.get('/', requireAdmin, getUsers);
router.post('/', requireAdmin, createUser);
router.delete('/:id', requireAdmin, deleteUser);
router.put('/:id/password', requireAdmin, updateUserPassword);

export default router;
