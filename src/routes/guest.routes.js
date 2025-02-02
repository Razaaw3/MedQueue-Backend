import express from "express";
import {
  viewCurrentQueue,
  registerAsGuest,
} from "../controllers/guest.controller.js";

const router = express.Router();

router.get("/queue/status", viewCurrentQueue);
router.post("/register", registerAsGuest);

export default router;
