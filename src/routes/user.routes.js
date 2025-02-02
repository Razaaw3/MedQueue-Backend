import express from "express";
import {
  verifyToken,
  isRegisteredUser,
  isGuest,
} from "../middleware/auth.middleware.js";
import {
  getUserProfile,
  updateUserProfile,
  getUserTokenHistory,
  upgradeToRegisteredUser,
  getUserToken,
  getUserAppointmentsByStatus,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/profile", verifyToken, isRegisteredUser, getUserProfile);
router.put("/update-profile", verifyToken, isRegisteredUser, updateUserProfile);
router.get(
  "/token-history",
  verifyToken,
  isRegisteredUser,
  getUserTokenHistory
);
router.get("/user-token", verifyToken, isRegisteredUser, getUserToken);
router.post("/upgrade", verifyToken, isGuest, upgradeToRegisteredUser);
router.get(
  "/appointment-history",
  verifyToken,
  isRegisteredUser,
  getUserAppointmentsByStatus
);

export default router;
