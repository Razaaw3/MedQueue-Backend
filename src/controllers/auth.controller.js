import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { validatePhone } from "../utils/validators.js";
import ApiError from "../utils/errors/ApiError.js";
import { ApiResponse } from "../utils/errors/ApiResponse.js";
import { asyncHandler } from "../utils/errors/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinaryImageHandling.js";

const register = asyncHandler(async (req, res) => {
  const { name, phoneNumber, password, role = "registeredUser" } = req.body;

  if (!name || !phoneNumber || !password) {
    throw new ApiError(400, "All fields are required");
  }

  if (!validatePhone(phoneNumber)) {
    throw new ApiError(400, "Invalid phone number format");
  }

  const existingUser = await User.findOne({ phoneNumber });

  if (existingUser) {
    throw new ApiError(409, "User with this phone number already exists");
  }

  // Validate if a profile image is uploaded
  const profileLocalPath = req.files?.profile?.[0]?.path;
  if (!profileLocalPath) {
    throw new ApiError(400, "Profile image is required");
  }

  // Upload profile image to Cloudinary
  const profileResponse = await uploadOnCloudinary(profileLocalPath);
  if (!profileResponse) {
    throw new ApiError(500, "Failed to upload profile image");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    phoneNumber,
    password: hashedPassword,
    role,
    profile: profileResponse.secure_url, // Store Cloudinary URL
  });

  const createdUser = await User.findById(user._id).select("-password");

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

const login = asyncHandler(async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    throw new ApiError(400, "Phone number and password are required");
  }

  if (!validatePhone(phoneNumber)) {
    throw new ApiError(400, "Invalid phone number format");
  }

  const user = await User.findOne({ phoneNumber });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = jwt.sign(
    {
      _id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "365d",
    }
  );

  const loggedInUser = await User.findById(user._id).select("-password").lean();

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("access_token", token, options)
    .json(
      new ApiResponse(
        200,
        {
          ...loggedInUser,
          token,
        },
        "User logged in successfully"
      )
    );
});

export { register, login };
