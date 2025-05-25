const express = require('express');
const router = express.Router();
const Token = require('../models/Token');
const {isAuthenticated} = require('../middleware/auth');
const {generateToken} = require('../utils/tokenGenerator');

// Generate token
router.post('/generate', isAuthenticated, async (req, res) => {
  try {
    const {date} = req.body;
    const userId = req.user._id;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required',
      });
    }

    // Check if user already has a token for this date
    const existingToken = await Token.findOne({
      user: userId,
      date: date,
    });

    if (existingToken) {
      return res.status(400).json({
        success: false,
        message: 'You already have a token for this date',
      });
    }

    // Generate new token
    const token = await generateToken(userId, date);

    res.status(201).json({
      success: true,
      message: 'Token generated successfully',
      token,
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating token',
      error: error.message,
    });
  }
});

// Get user's tokens
router.get('/my-tokens', isAuthenticated, async (req, res) => {
  try {
    const tokens = await Token.find({user: req.user._id})
      .sort({date: -1})
      .populate('user', 'name email');

    res.status(200).json({
      success: true,
      tokens,
    });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tokens',
      error: error.message,
    });
  }
});

// Get all tokens (admin only)
router.get('/all', isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this resource',
      });
    }

    const tokens = await Token.find()
      .sort({date: -1})
      .populate('user', 'name email');

    res.status(200).json({
      success: true,
      tokens,
    });
  } catch (error) {
    console.error('Error fetching all tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tokens',
      error: error.message,
    });
  }
});

module.exports = router;
