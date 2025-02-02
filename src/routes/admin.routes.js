import express from "express";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";
import {
  getAllUsers,
  getUserTokens,
  updateUserRole,
} from "../controllers/admin.controller.js";

const router = express.Router();

router.get("/all-users", verifyToken, isAdmin, getAllUsers);
router.get("/all-tokens", verifyToken, isAdmin, getUserTokens);
router.put("/update-role", verifyToken, isAdmin, updateUserRole);

export default router;
