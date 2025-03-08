import express from 'express';
import {
  verifyToken,
  isRegisteredUser,
  isGuest,
} from '../middleware/auth.middleware.js';
import {
  getUserProfile,
  updateUserProfile,
  getUserTokenHistory,
  upgradeToRegisteredUser,
  getUserToken,
  getUserAppointmentsByStatus,
  updateProfileImage,
} from '../controllers/user.controller.js';
import {upload} from '../middleware/multer.middleware.js';

const router = express.Router();

router.get('/profile', verifyToken, isRegisteredUser, getUserProfile);
router.put('/update-profile', verifyToken, isRegisteredUser, updateUserProfile);
router.patch(
  '/update-image',
  verifyToken,
  upload.fields([
    {
      name: 'image',
      maxCount: 1,
    },
  ]),
  isRegisteredUser,
  updateProfileImage
);
router.get(
  '/token-history',
  verifyToken,
  isRegisteredUser,
  getUserTokenHistory
);
router.get('/user-token', verifyToken, isRegisteredUser, getUserToken);
router.post('/upgrade', verifyToken, isGuest, upgradeToRegisteredUser);
router.get(
  '/appointment-history',
  verifyToken,
  isRegisteredUser,
  getUserAppointmentsByStatus
);

export default router;
