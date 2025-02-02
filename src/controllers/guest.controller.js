import Queue from "../models/queue.model.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import ApiError from "../utils/errors/ApiError.js";
import { ApiResponse } from "../utils/errors/ApiResponse.js";
import { asyncHandler } from "../utils/errors/asyncHandler.js";

export const viewCurrentQueue = asyncHandler(async (req, res) => {
  const currentQueue = await Queue.findOne()
    .populate("activeTokenId")
    .populate("upcomingTokenIds");

  if (!currentQueue) {
    throw new ApiError(404, "No current queue found");
  }

  const queueInfo = {
    activeToken: currentQueue.activeTokenId
      ? { estimatedTurnTime: currentQueue.activeTokenId.estimatedTurnTime }
      : null,
    queueLength: currentQueue.upcomingTokenIds.length,
    estimatedWaitTime: currentQueue.upcomingTokenIds.length * 15, //  15 minutes per token
  };

  res
    .status(200)
    .json(
      new ApiResponse(200, queueInfo, "Current queue fetched successfully")
    );
});

export const registerAsGuest = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ApiError(400, "Phone Number is required");
  }

  if (phoneNumber.length < 2 || phoneNumber.length > 20) {
    throw new ApiError(400, "Phone Number must be between 2 and 20 characters");
  }

  const user = new User({
    phoneNumber,
    role: "guest",
  });

  await user.save();

  const token = jwt.sign(
    { _id: user._id, role: "guest" },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  res
    .status(201)
    .cookie("access_token", token, cookieOptions)
    .json(
      new ApiResponse(
        201,
        {
          user: {
            _id: user._id,
            name: user.name,
            role: user.role,
          },
          token,
        },
        "Guest registered successfully"
      )
    );
});
