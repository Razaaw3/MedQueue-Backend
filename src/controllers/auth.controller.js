import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import {validateEmail} from '../utils/validators.js';
import ApiError from '../utils/errors/ApiError.js';
import {ApiResponse} from '../utils/errors/ApiResponse.js';
import {asyncHandler} from '../utils/errors/asyncHandler.js';
import {uploadOnCloudinary} from '../utils/cloudinaryImageHandling.js';
import sendEmail from '../utils/sendEmail.js';

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Hash OTPs
const hashOTP = (otp) => bcrypt.hashSync(otp, 10);

// Generate JWT Tokens
const generateToken = (user) => {
  const accessToken = jwt.sign(
    {_id: user._id, role: user.role},
    process.env.JWT_SECRET,
    {expiresIn: '365d'}
  );

  const refreshToken = jwt.sign(
    {_id: user._id},
    process.env.JWT_REFRESH_SECRET,
    {expiresIn: '7d'}
  );

  return {accessToken, refreshToken};
};

// Register User
const register = asyncHandler(async (req, res) => {
  const {name, email, password, role = 'registeredUser'} = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'All fields are required');
  }

  if (!validateEmail(email)) {
    throw new ApiError(400, 'Invalid email format');
  }

  const existingUser = await User.findOne({email});

  if (existingUser) {
    if (existingUser.isVerified) {
      throw new ApiError(
        409,
        'User with this email already exists and is verified.'
      );
    }

    // agr user verified nhi hai to duplication avoid krne k lie resend email again
    const otp = generateOTP();
    existingUser.otp = hashOTP(otp);
    existingUser.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await existingUser.save();

    await sendEmail(
      email,
      'Email Verification - MedQueue',
      'emailVerification.html',
      {otp}
    );

    return res
      .status(200)
      .json(new ApiResponse(200, {email}, 'OTP resent for verification.'));
  }

  let profileUrl =
    'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';
  const profileLocalPath = req.files?.profile?.[0]?.path;

  if (profileLocalPath) {
    const profileResponse = await uploadOnCloudinary(profileLocalPath);
    if (profileResponse) {
      profileUrl = profileResponse.secure_url;
    }
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    profile: profileUrl,
    otp: hashOTP(otp), // Store Hashed OTP
    otpExpiry,
    isVerified: false,
    failedLoginAttempts: 0,
  });

  await sendEmail(
    email,
    'Email Verification - MedQueue',
    'emailVerification.html',
    {otp}
  );

  return res
    .status(201)
    .json(new ApiResponse(201, {email}, 'OTP sent to email for verification.'));
});

// Verify OTP
const verifyOTP = asyncHandler(async (req, res) => {
  const {email, otp} = req.body;

  if (!email || !otp) {
    throw new ApiError(400, 'Email and OTP are required');
  }

  const user = await User.findOne({email});

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.isVerified) {
    throw new ApiError(400, 'User is already verified');
  }

  if (!user.otp || user.otpExpiry < new Date()) {
    throw new ApiError(400, 'OTP expired. Please request a new OTP.');
  }

  const isOTPValid = bcrypt.compareSync(otp, user.otp);
  if (!isOTPValid) {
    throw new ApiError(400, 'Invalid OTP');
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, {email}, 'Email verified successfully'));
});

// Resend OTP
const resendOTP = asyncHandler(async (req, res) => {
  const {email} = req.body;

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  const user = await User.findOne({email});

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.isVerified) {
    throw new ApiError(400, 'User is already verified');
  }

  // if (user.otpExpiry && user.otpExpiry > new Date()) {
  //   throw new ApiError(429, "Please wait before requesting a new OTP.");
  // }
  console.log('first');

  const newOtp = generateOTP();
  user.otp = hashOTP(newOtp);
  user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendEmail(email, 'New OTP - MedQueue', 'newOtp.html', {newOtp});

  return res
    .status(200)
    .json(new ApiResponse(200, {email}, 'New OTP sent to email.'));
});

// Login
const login = asyncHandler(async (req, res) => {
  const {email, password} = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  if (!validateEmail(email)) {
    throw new ApiError(400, 'Invalid email format');
  }

  const user = await User.findOne({email});

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (!user.isVerified) {
    throw new ApiError(403, 'Email not verified. Please verify your account.');
  }

  if (user.failedLoginAttempts >= 5) {
    throw new ApiError(429, 'Too many failed login attempts. Try again later.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    user.failedLoginAttempts += 1;
    await user.save();
    throw new ApiError(401, 'Invalid credentials');
  }

  user.failedLoginAttempts = 0;
  await user.save();

  const {accessToken, refreshToken} = generateToken(user);

  return res
    .status(200)
    .cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    })
    .json(
      new ApiResponse(
        200,
        {accessToken, refreshToken, user},
        'User logged in successfully'
      )
    );
});

// Forgot Password
const forgotPassword = asyncHandler(async (req, res) => {
  const {email} = req.body;

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  if (!validateEmail(email)) {
    throw new ApiError(400, 'Invalid email format');
  }

  const user = await User.findOne({email});

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const otp = generateOTP();
  user.otp = hashOTP(otp);
  user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes
  await user.save();

  await sendEmail(
    email,
    'Password Reset OTP - MedQueue',
    'passwordReset.html',
    {otp}
  );

  return res
    .status(200)
    .json(new ApiResponse(200, {email}, 'Password reset OTP sent to email.'));
});

// Reset Password
const resetPassword = asyncHandler(async (req, res) => {
  const {email, newPassword, confirmPassword} = req.body;

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, 'Passwords do not match');
  }

  if (!email || !newPassword) {
    throw new ApiError(400, 'Email and new password are required');
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters long');
  }

  const user = await User.findOne({email});

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password reset successfully'));
});

const verifyPasswordOTP = asyncHandler(async (req, res) => {
  const {email, otp} = req.body;

  if (!email || !otp) {
    throw new ApiError(400, 'Email and OTP are required.');
  }

  const user = await User.findOne({email});

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  if (!user.otp || user.otpExpiry < Date.now()) {
    throw new ApiError(400, 'OTP expired. Please request a new OTP.');
  }

  const isOTPValid = bcrypt.compareSync(otp, user.otp);
  if (!isOTPValid) {
    throw new ApiError(400, 'Invalid OTP.');
  }

  // Clear OTP fields after successful verification
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {email},
        'OTP verified successfully. You can now reset your password.'
      )
    );
});

export {
  register,
  verifyOTP,
  resendOTP,
  login,
  forgotPassword,
  resetPassword,
  verifyPasswordOTP,
};
