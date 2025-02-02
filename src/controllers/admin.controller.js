import User from "../models/user.model.js";
import UserToken from "../models/userToken.model.js";
import ApiError from "../utils/errors/ApiError.js";
import { ApiResponse } from "../utils/errors/ApiResponse.js";
import { asyncHandler } from "../utils/errors/asyncHandler.js";

export const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password");
  if (!users) {
    throw new ApiError(404, "No users found");
  }
  res
    .status(200)
    .json(new ApiResponse(200, users, "Users fetched successfully"));
});

export const getUserTokens = asyncHandler(async (req, res) => {
  const tokens = await UserToken.find()
    .populate("userId", "name phoneNumber") // populate userId with name and phoneNumber fields
    .sort({ tokenGenerationTime: -1 });

  if (!tokens || tokens.length === 0) {
    throw new ApiError(404, "No tokens found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, tokens, "Tokens fetched successfully"));
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const { userId, role } = req.body;

  if (!userId || !role) {
    throw new ApiError(400, "User ID and role are required");
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true }
  ).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, user, "User role updated successfully"));
});
