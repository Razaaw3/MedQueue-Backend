import User from "../models/user.model.js";
import UserToken from "../models/userToken.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import ApiError from "../utils/errors/ApiError.js";
import { ApiResponse } from "../utils/errors/ApiResponse.js";
import { asyncHandler } from "../utils/errors/asyncHandler.js";
// import moment from "moment";

export const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, user, "User profile retrieved successfully"));
});

export const updateUserProfile = asyncHandler(async (req, res) => {
  const { name, dob, address, email } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, dob, address, email },
    { new: true }
  ).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, user, "User profile updated successfully"));
});

export const getUserTokenHistory = asyncHandler(async (req, res) => {
  const tokens = await UserToken.find({ userId: req.user._id }).sort({
    tokenGenerationTime: -1,
  });

  res
    .status(200)
    .json(
      new ApiResponse(200, tokens, "User token history retrieved successfully")
    );
});

export const getUserToken = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0); // Set time to 00:00:00

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999); // Set time to 23:59:59

  const tokens = await UserToken.find({
    userId: req.user._id,
    date: { $gte: startOfDay, $lt: endOfDay },
  }).select(
    "slotNumber date estimatedTurnTime checkInOutStatus tokenGenerationTime tokenNumber checkedOutTime"
  );

  res
    .status(200)
    .json(new ApiResponse(200, tokens, "User tokens retrieved successfully"));
});

export const upgradeToRegisteredUser = asyncHandler(async (req, res) => {
  if (req.user.role !== "guest") {
    throw new ApiError(400, "Only guests can upgrade to registered users");
  }

  const { password } = req.body;

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      role: "registeredUser",
      password: hashedPassword,
    },
    { new: true }
  ).select("-password");

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  const token = jwt.sign(
    { _id: updatedUser._id, role: "registeredUser" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  const response = {
    ...updatedUser,
    token,
  };

  res
    .status(200)
    .json(
      new ApiResponse(200, response, "User upgraded to registered successfully")
    );
});

export const getUserAppointmentsByStatus = asyncHandler(async (req, res) => {
  const { status } = req.query;

  if (!status || !["completed", "pending"].includes(status)) {
    throw new ApiError(
      400,
      "status query parameter must be either 'completed' or 'pending'"
    );
  }

  const query = {
    userId: req.user._id,
    checkInOutStatus: status,
  };

  const appointments = await UserToken.find(query)
    .populate({
      path: "timeSlotId",
      select: "date timeSlots",
      populate: {
        path: "timeSlots",
        match: { slotNumber: { $exists: true } },
      },
    })
    .sort({ date: -1 })
    .select(
      "slotNumber tokenNumber date estimatedTurnTime checkInOutStatus tokenGenerationTime checkedOutTime"
    );

  const transformedAppointments = appointments.map((apt) => {
    const timeSlot = apt.timeSlotId.timeSlots.find(
      (ts) => ts.slotNumber === apt.slotNumber
    );
    return {
      _id: apt._id,
      tokenNumber: apt.tokenNumber,
      timeSlot: `${timeSlot?.startingTime} - ${timeSlot?.endingTime}`,
      checkedOutTime: apt.checkedOutTime,
      date: apt.date,
      estimatedTurnTime: apt.estimatedTurnTime,
      checkInOutStatus: apt.checkInOutStatus,
      tokenGenerationTime: apt.tokenGenerationTime,
    };
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        total: transformedAppointments.length,
        appointments: transformedAppointments,
      },
      `User ${status} appointments retrieved successfully`
    )
  );
});
