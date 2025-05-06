import express from "express";
import {
  getSettings,
  updatePrivacySettings,
  updateTokenGenerationStatus,
} from "../controllers/privacySettings.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Get current settings
router.get("/get-settings", verifyToken, isAdmin, getSettings);

// Update doctor availability
router.put(
  "/update-privacy-settings",
  verifyToken,
  isAdmin,
  updatePrivacySettings
);

// Update token generation status
router.put(
  "/update-token-generation",
  verifyToken,
  isAdmin,
  updateTokenGenerationStatus
);

export default router;
