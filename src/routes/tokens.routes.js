import express from 'express';
import {
  verifyToken,
  isAdmin,
  isRegisteredUser,
} from '../middleware/auth.middleware.js';
import {
  generateToken,
  cancelToken,
  getQueueStatus,
  updateTokenStatus,
  getTokenHistory,
  getTokensByDate,
  getActiveToken,
} from '../controllers/token.controller.js';

const router = express.Router();

router.post('/generate', verifyToken, generateToken);
router.put('/:tokenId', verifyToken, cancelToken);
router.get('/queue-status', verifyToken, getQueueStatus);
router.get('/token-history', verifyToken, getTokenHistory); /*  */
router.post('/active-token', getActiveToken); /*  */

// admin routes
router.patch('/:tokenId/status', verifyToken, isAdmin, updateTokenStatus);
router.get('/by-date', verifyToken, isAdmin, getTokensByDate);

export default router;
