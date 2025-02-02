import Queue from "../models/queue.model.js";
import TimeSlots from "../models/timeSlots.model.js";
import UserToken from "../models/userToken.model.js";
import ApiError from "../utils/errors/ApiError.js";
import { ApiResponse } from "../utils/errors/ApiResponse.js";
import { asyncHandler } from "../utils/errors/asyncHandler.js";
import {
  formatEstimatedTurnTime,
  formatTokenGenerationTime,
} from "../utils/dateTimeFormatting.js";
import { io } from "../index.js";

// Generate a token
export const generateToken = asyncHandler(async (req, res) => {
  const { timeSlotId, slotNumber, date } = req.body;

  if (!timeSlotId || !slotNumber || !date) {
    throw new ApiError(
      400,
      "Missing required fields: timeSlotId, slotNumber, or date"
    );
  }

  const requestedDate = new Date(date);
  requestedDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayOfWeek = today.getDay();

  if (requestedDate < today) {
    throw new ApiError(400, "Cannot generate tokens for past dates");
  }

  // testing k lie comment krdo on sat and sun
  // if (requestedDate > today) {
  //   throw new ApiError(400, "Cannot generate tokens for future dates");
  // }

  // if (dayOfWeek === 0 || dayOfWeek === 6) {
  //   throw new ApiError(
  //     400,
  //     "Clinic is closed on weekends. No tokens available."
  //   );
  // }

  // Use the requestedDate (from the request body) to find the time slot document
  const timeSlotDoc = await TimeSlots.findOne({
    _id: timeSlotId,
    date: date,
  });

  if (!timeSlotDoc) throw new ApiError(400, "Invalid time slot document");

  const timeSlot = timeSlotDoc.timeSlots.find(
    (slot) => slot.slotNumber === slotNumber
  );

  if (!timeSlot || timeSlot.isReserved) {
    throw new ApiError(400, "Time slot not available");
  }

  let queue = await Queue.findOne({ date: today });
  let isActive = false;

  if (!queue) {
    isActive = true;
    queue = new Queue({
      date: today,
      activeTokenId: null,
      upcomingTokenIds: [],
    });
  }

  const averageWaitTime = 10;
  let estimatedTurnTime;

  if (queue.upcomingTokenIds.length > 0) {
    const lastTokenId =
      queue.upcomingTokenIds[queue.upcomingTokenIds.length - 1];
    const lastToken = await UserToken.findById(lastTokenId);

    if (!lastToken) {
      throw new ApiError(500, "Error retrieving the last token in the queue");
    }

    estimatedTurnTime = new Date(lastToken.estimatedTurnTime);
    estimatedTurnTime.setMinutes(
      estimatedTurnTime.getMinutes() + averageWaitTime
    );
  } else {
    estimatedTurnTime = new Date();
  }

  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const lastTokenOfDay = await UserToken.findOne({
    date: { $gte: startOfDay, $lte: endOfDay },
  })
    .sort({ tokenNumber: -1 })
    .select("tokenNumber");

  const tokenNumber = lastTokenOfDay ? lastTokenOfDay.tokenNumber + 1 : 1;

  await req.user.populate("name phoneNumber");

  const userToken = new UserToken({
    userId: req.user._id,
    userName: req.user.name,
    userPhoneNumber: req.user.phoneNumber,
    timeSlotId: timeSlotDoc._id,
    slotNumber: timeSlot.slotNumber,
    estimatedTurnTime,
    date: today,
    checkInOutStatus: "pending",
    isActive: isActive,
    tokenNumber: tokenNumber,
  });

  await userToken.save();

  queue.upcomingTokenIds.push(userToken._id);
  if (!queue.activeTokenId) queue.activeTokenId = userToken._id;

  await queue.save();

  timeSlot.isReserved = true;
  await timeSlotDoc.save();

  res.status(201).json(
    new ApiResponse(
      201,
      {
        tokenId: userToken._id,
        tokenNumber: userToken.tokenNumber,
        userName: req.user.name,
        slotNumber: userToken.slotNumber,
        date: userToken.date,
        tokenGenerationTime: formatTokenGenerationTime(new Date()),
        estimatedTurnTime: formatEstimatedTurnTime(userToken.estimatedTurnTime),
        status: userToken.checkInOutStatus,
      },
      "Token generated successfully"
    )
  );
});

// Cancel a token
export const cancelToken = asyncHandler(async (req, res) => {
  const { tokenId } = req.params;
  const { role, _id: userId } = req.user;

  const token = await UserToken.findOne({
    _id: tokenId,
    isActive: true,
  });

  if (!token) throw new ApiError(404, "Active token not found");

  if (role !== "admin" && token.userId.toString() !== userId.toString()) {
    throw new ApiError(403, "You don't have permission to cancel this token");
  }

  if (token.checkInOutStatus !== "pending") {
    throw new ApiError(400, "Cannot cancel token after check-in");
  }

  // remove token from queue
  const queue = await Queue.findOne({
    $or: [{ activeTokenId: tokenId }, { upcomingTokenIds: tokenId }],
  });

  if (queue) {
    queue.upcomingTokenIds = queue.upcomingTokenIds.filter(
      (id) => id.toString() !== tokenId.toString()
    );
    if (queue.activeTokenId?.toString() === tokenId.toString()) {
      queue.activeTokenId = null;
    }
    await queue.save();
  }

  // free up the time slot
  const timeSlotDoc = await TimeSlots.findById(token.timeSlotId);
  if (timeSlotDoc) {
    const timeSlot = timeSlotDoc.timeSlots.find(
      (ts) => ts.slotNumber === token.slotNumber
    );
    if (timeSlot) {
      timeSlot.isReserved = false;
      await timeSlotDoc.save();
    }
  }

  // update token status
  token.isActive = false;
  token.checkInOutStatus = "cancelled";
  token.cancellationDetails = {
    cancelledBy: role,
    cancelledById: userId,
    cancelledAt: new Date(),
  };
  await token.save();

  // add information about who cancelled the token in the response
  const message =
    role === "admin" ? "Token cancelled by admin" : "Token cancelled by user";

  res.json(new ApiResponse(200, { token }, message));
});

// Get queue status
export const getQueueStatus = asyncHandler(async (req, res) => {
  const queue = await Queue.findOne({})
    .populate({
      path: "activeTokenId",
      select: "userId estimatedTurnTime checkInOutStatus",
      populate: { path: "userId", select: "name phoneNumber" },
    })
    .populate({
      path: "upcomingTokenIds",
      select: "userId estimatedTurnTime checkInOutStatus",
      populate: { path: "userId", select: "name phoneNumber" },
    });

  if (!queue) {
    return res.json(
      new ApiResponse(
        200,
        {
          activeToken: null,
          upcomingTokens: [],
          queueLength: 0,
          estimatedWaitTime: 0,
          tokenGenerationActive: false,
        },
        "Queue is empty"
      )
    );
  }

  const userTokens = queue.upcomingTokenIds.filter(
    (token) => token.userId._id.toString() === req.user._id.toString()
  );

  const queueInfo = {
    activeToken: queue.activeTokenId,
    userTokens,
    totalTokens: queue.upcomingTokenIds.length,
    // tokenGenerationActive: true,
  };

  res.json(
    new ApiResponse(200, queueInfo, "Queue status fetched successfully")
  );
});

// Update token status

export const updateTokenStatus = asyncHandler(async (req, res) => {
  const { tokenId } = req.params;
  const { checkInOutStatus } = req.body;

  const token = await UserToken.findById(tokenId);
  if (!token) throw new ApiError(404, "Token not found");

  const allTokensInQueue = await Queue.findOne({
    upcomingTokenIds: tokenId,
  }).populate("upcomingTokenIds");

  switch (checkInOutStatus) {
    case "onsite":
      token.checkInOutStatus = checkInOutStatus;
      break;
    case "completed":
      if (token.checkInOutStatus !== "onsite") {
        throw new ApiError(400, "Token must be onsite before completion");
      }
      token.checkInOutStatus = checkInOutStatus;
      token.isActive = false;
      token.checkedOutTime = new Date(); // Add checkedOutTime
      const nextToken = allTokensInQueue.upcomingTokenIds
        .filter((allTokens) => allTokens.slotNumber > token.slotNumber)
        .sort((a, b) => a.slotNumber - b.slotNumber)[0];

      if (nextToken) {
        allTokensInQueue.activeTokenId = nextToken;
        const updatedToken = await UserToken.findOneAndUpdate(
          { _id: nextToken },
          {
            $set: {
              isActive: true,
            },
          }
        );

        io.emit("TokenUpdated", {
          data: updatedToken,
          message: "New Active Token",
          success: true,
        });
      }
      break;
    default:
      throw new ApiError(400, "Invalid status");
  }

  await token.save();
  await allTokensInQueue.save();

  await token.populate("userId", "name phoneNumber");
  res.json(new ApiResponse(200, token, "Token status updated successfully"));
});

// Get token history
export const getTokenHistory = asyncHandler(async (req, res) => {
  const tokens = await UserToken.find({ userId: req.user._id })
    .populate("timeSlot", "date clinicOpeningTime clinicClosingTime")
    .sort({ tokenGenerationTime: -1 });

  res.json(new ApiResponse(200, tokens, "Token history fetched successfully"));
});

// Get all tokens for a specific date
export const getTokensByDate = asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) throw new ApiError(400, "Date query parameter is required");

  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const tokens = await UserToken.find({
    date: { $gte: startDate, $lte: endDate },
  })
    .populate("userId", "name phoneNumber")
    .populate("timeSlotId", "date clinicOpeningTime clinicClosingTime")
    .sort({ tokenGenerationTime: 1 });

  res.json(
    new ApiResponse(
      200,
      tokens,
      "Tokens fetched successfully for the given date"
    )
  );
});

export const getActiveToken = asyncHandler(async (req, res) => {
  const { date } = req.body;

  if (!date) throw new ApiError(400, "Date query parameter is required");

  const tokens = await UserToken.findOne({
    date: date,
    isActive: true,
  });

  res.json(
    new ApiResponse(
      200,
      tokens,
      "Tokens fetched successfully for the given date"
    )
  );
});
