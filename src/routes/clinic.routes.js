import express from 'express';
import {verifyToken, isAdmin} from '../middleware/auth.middleware.js';
import {
  createClinic,
  updateClinic,
  getClinic,
  deleteClinic,
} from '../controllers/clinic.controller.js';

const router = express.Router();

// Create a new clinic (only if none exists)
router.post('/clinic', verifyToken, isAdmin, createClinic);

// Update an existing clinic
router.put('/clinic', verifyToken, isAdmin, updateClinic);

// Get clinic details
router.get('/clinic', verifyToken, isAdmin, getClinic);

// Delete clinic (not recommended, but included)
router.delete('/clinic', verifyToken, isAdmin, deleteClinic);

export default router;
