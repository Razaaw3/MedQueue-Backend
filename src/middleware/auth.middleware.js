import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export const verifyToken = async (req, res, next) => {
  try {
    // check for token in cookie first
    let token = req.cookies.access_token;

    // return to Authorization header if no cookie exists
    if (!token) {
      token = req.header('Authorization')?.replace('Bearer ', '');
    }

    if (!token) {
      return res.status(401).json({error: 'No token provided'});
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({_id: decoded._id});

    if (!user) {
      return res.status(401).json({error: 'User not found'});
    }

    req.user = user;
    next();
  } catch (error) {
    console.log('Error in verifyToken middleware:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({error: 'Invalid token'});
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({error: 'Token expired'});
    }
    res.status(401).json({error: 'Invalid token'});
  }
};

export const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({error: 'Admin access required'});
    }
    next();
  } catch (error) {
    console.log('Error in isAdmin middleware:', error);
    res.status(500).json({error: 'Server error'});
  }
};

export const isRegisteredUser = async (req, res, next) => {
  try {
    if (req.user.role !== 'registeredUser' && req.user.role !== 'admin') {
      return res.status(403).json({error: 'Registered user access required'});
    }
    next();
  } catch (error) {
    console.log('Error in isRegisteredUser middleware:', error);
    res.status(500).json({error: 'Server error'});
  }
};

export const isGuest = async (req, res, next) => {
  try {
    if (req.user.role !== 'guest') {
      return res.status(403).json({error: 'Guest access required'});
    }
    next();
  } catch (error) {
    console.log('Error in isGuest middleware:', error);
    res.status(500).json({error: 'Server error'});
  }
};
