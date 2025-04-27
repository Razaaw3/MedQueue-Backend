import express from 'express';
import {verifyToken, isRegisteredUser} from '../middleware/auth.middleware.js';
import {
  getUserProfile,
  updateUserProfile,
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
  // isRegisteredUser,
  updateProfileImage
);

export default router;
