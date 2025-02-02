import express from "express";
import { register, login } from "../controllers/auth.controller.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

router.post(
  "/register",
  upload.fields([
    {
      name: "profile",
      maxCount: 1,
    },
  ]),
  register
);
router.post("/login", login);

export default router;
