import express from 'express';
import {verifyToken, isAdmin} from '../middleware/auth.middleware.js';
import {
  generateToken,
  cancelToken,
  getQueueStatus,
  updateTokenStatus,
  getTokenHistory,
  getTokensByStatus,
  getActiveTokenByDate,
  getAllTokensByDate,
  getUserToken,
  myTokenDetail,
} from '../controllers/token.controller.js';

const router = express.Router();

// User routes
router.post('/generate', verifyToken, generateToken);
router.put('/cancel/:tokenId', verifyToken, cancelToken);
router.get('/queue-status', verifyToken, getQueueStatus);
router.get('/history', verifyToken, getTokenHistory);
router.get('/tokens-by-status', verifyToken, getTokensByStatus);
router.post('/active', verifyToken, getActiveTokenByDate);

// Admin routes
router.patch('/:tokenId/status', verifyToken, isAdmin, updateTokenStatus);
router.get('/tokens-by-date', verifyToken, isAdmin, getAllTokensByDate);
router.get('/user-token', verifyToken, getUserToken);
router.get('/my-token-detail', verifyToken, myTokenDetail);

export default router;
