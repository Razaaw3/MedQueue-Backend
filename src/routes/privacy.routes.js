import express from "express";
import {
  // getPrivacySettings,
  updatePrivacySettings,
} from "../controllers/privacySettings.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Routes
// router.get("/get-privacy-settings", verifyToken, isAdmin, getPrivacySettings);
router.put(
  "/update-privacy-settings",
  verifyToken,
  isAdmin,
  updatePrivacySettings
);

export default router;
