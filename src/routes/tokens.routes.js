import express from 'express';
import {
  verifyToken,
  isAdmin,
  isDoctor,
  isRegisteredUser,
} from '../middleware/auth.middleware.js';
import {
  generateToken,
  generateTokenByAdmin,
  cancelToken,
  getQueueStatus,
  updateTokenStatus,
  getTokenHistory,
  getTokensByStatus,
  getActiveTokenByDate,
  getAllTokensByDate,
  getUserToken,
  myTokenDetail,
  getActiveTokensTable,
  // updateTokenStatusTable,
  deleteToken,
  getTodayPatients,
  generateEmergencyToken,
  getQueueDoctor,
} from '../controllers/token.controller.js';
import {checkOrCreateUser} from '../middleware/createOrCheckUser.middleware.js';

const router = express.Router();

// User routes
router.post('/generate', verifyToken, generateToken);
router.post(
  '/generate-emergency',
  checkOrCreateUser,

  generateEmergencyToken
);
router.post('/generate-by-admin', verifyToken, isAdmin, generateTokenByAdmin);
router.put('/cancel/:tokenId', verifyToken, cancelToken);
router.get('/queue-status', verifyToken, getQueueStatus);
router.get('/queue-status-doctor', verifyToken, getQueueDoctor);
router.get('/history', verifyToken, getTokenHistory);
router.get('/tokens-by-status', verifyToken, getTokensByStatus);
router.post('/active', verifyToken, getActiveTokenByDate);

// Admin routes

router.get('/tokens-by-date', verifyToken, isAdmin, getAllTokensByDate);
router.get('/user-token', verifyToken, getUserToken);
router.get('/my-token-detail', verifyToken, myTokenDetail);

// all roles can access
router.patch('/:tokenId/status', verifyToken, updateTokenStatus);

// routes for active tokens table
router.get('/active-table', verifyToken, isAdmin, getActiveTokensTable);
router.get('/today-patients', verifyToken, isAdmin, getTodayPatients);
// router.patch(
//   "/:tokenId/status-table",
//   verifyToken,
//   isAdmin,
//   updateTokenStatusTable
// );
router.delete('/delete-token/:tokenId', verifyToken, isAdmin, deleteToken);

export default router;
