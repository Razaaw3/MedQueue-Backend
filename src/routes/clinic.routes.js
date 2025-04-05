import express from "express";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";
import {
  createClinic,
  getClinic,
  deleteClinic,
  updateClinicSettings,
} from "../controllers/clinic.controller.js";

const router = express.Router();

// Get clinic settings
router.get("/get-settings", verifyToken, isAdmin, getClinic);

// Update clinic settings
router.put("/update-settings", verifyToken, isAdmin, updateClinicSettings);

// Create a new clinic (only if none exists)
router.post("/create-clinic", verifyToken, isAdmin, createClinic);

// Delete clinic (not recommended, but included)
router.delete("/delete-clinic", verifyToken, isAdmin, deleteClinic);

export default router;
