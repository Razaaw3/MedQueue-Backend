import express from "express";
import {
  getDashboardStats,
  getTokenTracks,
  getAppointments,
  downloadReport,
} from "../controllers/dashboard.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Get dashboard statistics
router.get("/stats", verifyToken, isAdmin, getDashboardStats);

// Get token tracks data
router.get("/token-tracks", verifyToken, isAdmin, getTokenTracks);

// Get appointments data
router.get("/appointments", verifyToken, isAdmin, getAppointments);

// Download dashboard report
router.get("/download-report", verifyToken, isAdmin, downloadReport);

export default router;
