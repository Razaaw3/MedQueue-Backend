import Queue from '../models/queue.model.js';
import UserToken from '../models/userToken.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/errors/ApiError.js';
import {ApiResponse} from '../utils/errors/ApiResponse.js';
import {asyncHandler} from '../utils/errors/asyncHandler.js';
import {io} from '../../index.js';
import Clinic from '../models/clinic.model.js';
import moment from 'moment';
import {tz, TZDate} from '@date-fns/tz';
import DoctorDetail from '../models/doctorDetail.model.js';

import {
  parseISO,
  format,
  isBefore,
  isAfter,
  startOfDay,
  addMinutes,
  isSameDay,
  parse,
  set,
  formatISO,
  addHours,
  differenceInMinutes,
  setHours,
  getHours,
  getMinutes,
  endOfDay,
} from 'date-fns';
import PrivacySettings from '../models/PrivacySettings.model.js';

// @@ Generate token
export const generateToken = asyncHandler(async (req, res) => {
  // get timezone
  // const zonalArea = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const {date} = req.body;
  const socket = req.io;
  const userId = req.user._id;

  if (!date) {
    throw new ApiError(400, 'Missing required field: date');
  }

  const clinic = await Clinic.findOne();
  if (!clinic) {
    throw new ApiError(
      404,
      'Clinic settings not found. Please visit the clinic'
    );
  }

  // Convert provided date and today to start of the day (without time)
  const requestedDate = formatISO(
    addHours(new TZDate(date, 'Asia/Karachi'), 5).setHours(0, 0, 0, 0),
    {
      representation: 'complete',
    }
  );
  let today = TZDate.tz('Asia/Karachi').toISOString();

  // // //Uncomment the below feature if you are done with the development

  // if (
  //   !isSameDay(requestedDate, today, {
  //     in: tz("Asia/Karachi"),
  //   })
  // ) {
  //   throw new ApiError(400, "Cannot generate tokens for past or future dates.");
  // }

  // Check if user already has an active token for the selected date
  const existingToken = await UserToken.findOne({
    userId,
    date: requestedDate,
  });

  if (existingToken) {
    throw new ApiError(400, 'You already have an active token for today.');
  }

  // Convert clinic opening and closing times to today's full DateTime
  // const clinicOpenStoredTime = parse(
  //   clinic.clinicOpeningTime,
  //   'hh:mm a',
  //   today
  // );

  const clinicDate = parse(
    clinic.clinicOpeningTime,
    'hh:mm a',
    addHours(new Date(), 5)
  );
  const openingHours = getHours(clinicDate);
  const openingMinutes = getMinutes(clinicDate);

  const todayWithTime = set(today, {
    hours: openingHours,
    minutes: openingMinutes,
    seconds: 0,
    milliseconds: 0,
  });

  const clinicClosingTime = parse(
    clinic.clinicClosingTime,
    'hh:mm a',
    addHours(new Date(), 5)
  );
  const closingHours = getHours(clinicClosingTime);
  const closingMinutes = getMinutes(clinicClosingTime);

  const todayWithTimeClose = set(today, {
    hours: closingHours,
    minutes: closingMinutes,
    seconds: 0,
    milliseconds: 0,
  });

  const openingTime = new TZDate(todayWithTime, 'Asia/Karachi');

  const closingTime = new TZDate(
    todayWithTimeClose,
    'Asia/Karachi'
  ).toISOString();

  const tokenStartTime = addMinutes(openingTime, -15);

  // // Uncomment this when you are done with the coding

  // if (
  //   isBefore(today, tokenStartTime.toISOString()) ||
  //   isAfter(today, closingTime)
  // ) {
  //   throw new ApiError(400, 'Cannot generate token outside clinic hours.');
  // }

  // Find the queue for today
  let queue = await Queue.findOne({
    date: addHours(parseISO(requestedDate), 5),
  });

  if (!queue) {
    queue = new Queue({
      date: addHours(parseISO(requestedDate), 5),
      activeTokenId: null,
      upcomingTokenIds: [],
    });
  }

  // Determine estimated turn time
  let estimatedTurnTime;
  if (queue.upcomingTokenIds.length > 0) {
    const lastTokenId =
      queue.upcomingTokenIds[queue.upcomingTokenIds.length - 1];
    const lastToken = await UserToken.findById(lastTokenId);

    estimatedTurnTime = addMinutes(
      lastToken.estimatedTurnTime,
      10
    ).toISOString();
  } else {
    estimatedTurnTime = openingTime.toISOString();
    const now = addHours(new Date(), 5);
    estimatedTurnTime = addHours(parseISO(estimatedTurnTime), 5);

    console.log(
      isAfter(now, addHours(parseISO(formatISO(openingTime)), 5)) && !queue
    );
    if (isAfter(now, addHours(parseISO(formatISO(openingTime)), 5))) {
      if (!queue || queue.upcomingTokenIds.length === 0)
        queue.waitTime = differenceInMinutes(
          now,
          addHours(parseISO(formatISO(openingTime)), 5)
        );
    }
  }

  // Get last token number for the day
  const lastTokenOfDay = await UserToken.findOne({
    date: addHours(parseISO(requestedDate), 5),
  });
  const tokenNumber = lastTokenOfDay ? queue.upcomingTokenIds.length + 1 : 1;

  console.log('estimatedTurnTime :', estimatedTurnTime);
  // Create new token
  const userToken = new UserToken({
    userId,
    tokenNumber,
    estimatedTurnTime: estimatedTurnTime,
    date: addHours(parseISO(requestedDate), 5),
    checkInOutStatus: 'pending',
    isActive: false,
    tokenGenerationTime: addHours(parseISO(today), 5),
    estimatedEndTime: addMinutes(estimatedTurnTime, 10),
  });

  io.emit('tokenUpdate', {
    data: {
      waitTime: queue.waitTime,
    },
  });

  await userToken.save();

  queue.upcomingTokenIds.push(userToken._id);
  await queue.save();

  res
    .status(201)
    .json(new ApiResponse(201, userToken, 'Token generated successfully'));
});

// @@ Generate token by admin
export const generateTokenByAdmin = asyncHandler(async (req, res) => {
  const {date, fullName, email} = req.body;
  const socket = req.io;

  if (!date || !fullName || !email) {
    throw new ApiError(400, 'Missing required fields: date, fullName, email');
  }

  const clinic = await Clinic.findOne();
  if (!clinic) {
    throw new ApiError(
      404,
      'Clinic settings not found. Please visit the clinic'
    );
  }

  let tempUser = await User.findOne({email, isTemporary: true});

  if (!tempUser) {
    tempUser = await User.create({
      name: fullName,
      email,
      isTemporary: true,
      role: 'registeredUser',
      password: Math.random().toString(36).slice(-8),
    });
  }

  const requestedDate = formatISO(
    addHours(new TZDate(date, 'Asia/Karachi'), 5).setHours(0, 0, 0, 0),
    {
      representation: 'complete',
    }
  );
  let today = TZDate.tz('Asia/Karachi').toISOString();

  let queue = await Queue.findOne({
    date: addHours(parseISO(requestedDate), 5),
  });

  if (!queue) {
    queue = new Queue({
      date: addHours(parseISO(requestedDate), 5),
      activeTokenId: null,
      upcomingTokenIds: [],
    });
  }

  let estimatedTurnTime;
  if (queue.upcomingTokenIds.length > 0) {
    const lastTokenId =
      queue.upcomingTokenIds[queue.upcomingTokenIds.length - 1];
    const lastToken = await UserToken.findById(lastTokenId);
    estimatedTurnTime = addMinutes(
      lastToken.estimatedTurnTime,
      10
    ).toISOString();
  } else {
    estimatedTurnTime = openingTime.toISOString();
    const now = addHours(new Date(), 5);
    estimatedTurnTime = addHours(parseISO(estimatedTurnTime), 5);

    if (isAfter(now, addHours(parseISO(formatISO(openingTime)), 5))) {
      if (!queue || queue.upcomingTokenIds.length === 0) {
        queue.waitTime = differenceInMinutes(
          now,
          addHours(parseISO(formatISO(openingTime)), 5)
        );
      }
    }
  }

  const lastTokenOfDay = await UserToken.findOne({
    date: addHours(parseISO(requestedDate), 5),
  });
  const tokenNumber = lastTokenOfDay ? queue.upcomingTokenIds.length + 1 : 1;

  const userToken = new UserToken({
    userId: tempUser._id, // Use the temporary user's ID
    tokenNumber,
    estimatedTurnTime: estimatedTurnTime,
    date: addHours(parseISO(requestedDate), 5),
    checkInOutStatus: 'pending',
    isActive: false,
    tokenGenerationTime: addHours(parseISO(today), 5),
    estimatedEndTime: addMinutes(estimatedTurnTime, 10),
    fullName,
    email,
    isAdminGenerated: true,
    isWalkIn: true,
  });

  io.emit('tokenUpdate', {
    data: {
      waitTime: queue.waitTime,
    },
  });

  await userToken.save();

  queue.upcomingTokenIds.push(userToken._id);
  await queue.save();

  res
    .status(201)
    .json(
      new ApiResponse(201, userToken, 'Token generated successfully by admin')
    );
});

// @@ Cancel token
export const cancelToken = asyncHandler(async (req, res) => {
  const {tokenId} = req.params;
  const {role, _id: userId} = req.user;

  const token = await UserToken.findOne({
    _id: tokenId,
    isActive: true,
  });

  if (!token) {
    throw new ApiError(404, 'Active token not found');
  }

  if (role !== 'admin' && token.userId.toString() !== userId.toString()) {
    throw new ApiError(403, "You don't have permission to cancel this token");
  }

  if (token.checkInOutStatus !== 'pending') {
    throw new ApiError(400, 'Cannot cancel token after check-in');
  }

  const queue = await Queue.findOne({
    $or: [{activeTokenId: tokenId}, {upcomingTokenIds: tokenId}],
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

  token.isActive = false;
  token.checkInOutStatus = 'cancelled';
  token.cancellationDetails = {
    cancelledBy: role,
    cancelledById: userId,
    cancelledAt: addHours(new Date(), 5),
  };

  await token.save();

  const socket = req.io;
  if (socket) {
    socket.emit('tokenCancelled', {
      tokenId,
      cancelledBy: role,
      cancelledAt: token.cancellationDetails.cancelledAt,
    });
  }

  const formatDate = (date) => {
    if (!date) return null;
    if (date instanceof Date) return format(date, 'yyyy-MM-dd');
    return format(parseISO(date), 'yyyy-MM-dd');
  };

  const formatTime = (date) => {
    if (!date) return null;
    if (date instanceof Date) return format(date, 'HH:mm');
    return format(parseISO(date), 'HH:mm');
  };

  const formatDateTime = (date) => {
    if (!date) return null;
    if (date instanceof Date) return format(date, 'yyyy-MM-dd HH:mm');
    return format(parseISO(date), 'yyyy-MM-dd HH:mm');
  };

  const message =
    role === 'admin' ? 'Token cancelled by admin' : 'Token cancelled by user';

  res.status(200).json(
    new ApiResponse(
      200,
      {
        token: {
          ...token.toObject(),
          date: formatDate(token.date),
          estimatedTurnTime: formatTime(token.estimatedTurnTime),
          tokenGenerationTime: formatDateTime(token.tokenGenerationTime),
          estimatedEndTime: formatTime(token.estimatedEndTime),
          cancellationDetails: {
            ...token.cancellationDetails,
            cancelledAt: formatDateTime(token.cancellationDetails.cancelledAt),
          },
        },
      },
      message
    )
  );
});

// @@ Get queue status
export const getQueueStatus = asyncHandler(async (req, res) => {
  const targetDate = new Date();

  const startOfDay = addHours(new Date(targetDate.setHours(0, 0, 0, 0)), 5);
  const endOfDay = addHours(new Date(targetDate.setHours(23, 59, 59, 999)), 5);

  console.log(startOfDay, endOfDay);

  const allTokens = await Queue.findOne({
    date: {$gte: startOfDay, $lt: endOfDay},
  })
    .populate('upcomingTokenIds')
    .lean();

  res.json(
    new ApiResponse(
      200,
      allTokens?.upcomingTokenIds,
      'Tokens retrieved successfully'
    )
  );
});

// @@ Update token status
export const updateTokenStatus = asyncHandler(async (req, res) => {
  const {tokenId} = req.params;
  const {checkInOutStatus} = req.body;

  const token = await UserToken.findById(tokenId);
  if (!token) throw new ApiError(404, 'Token not found');

  const doctorsQueue = await Queue.findOne({
    upcomingTokenIds: {$in: [tokenId]},
  }).populate('upcomingTokenIds lastTokenId');
  if (!doctorsQueue) throw new ApiError(404, 'Queue not found');

  let queue = doctorsQueue;

  const currentTime = addHours(new Date(), 5);

  switch (checkInOutStatus) {
    case 'onsite':
      const isValid =
        currentTime <=
        addMinutes(
          addMinutes(addMinutes(token.estimatedTurnTime, 10), queue.waitTime),
          queue.offset
        );
      token.checkInOutStatus = checkInOutStatus;
      let waitTime = 0;
      if (queue.lastTokenId) {
        console.log('queue.lastTokenId');
        if (!queue.activeTokenId) {
          token.tokenActivationTime = currentTime;

          console.log('!queue.activeTokenId', queue.exceptional);
          waitTime = differenceInMinutes(
            currentTime,
            queue.lastTokenId.checkedOutTime
          );
          queue.waitTime = waitTime + queue.waitTime;

          token.isActive = true;
          token.tokenActivationTime = currentTime;
          queue.activeTokenId = token._id;

          io.emit('tokenUpdate', {
            data: {
              offset: queue.offset,
              waitTime: queue.waitTime,
              exceptional: queue.exceptional,
            },
            message: 'Est. turn time updated successfully',
            success: true,
          });
        } else {
          console.log('queue.activeTokenId');

          if (!isValid) {
            console.log('!isValid');
            if (!queue.exceptional.includes(token.tokenNumber))
              queue.exceptional = [
                ...(queue.exceptional || []),
                token.tokenNumber,
              ];

            io.emit('tokenUpdate', {
              data: {
                offset: queue.offset,
                waitTime: queue.waitTime,
                exceptional: queue.exceptional,
              },
              message: 'Est. turn time updated successfully',
              success: true,
            });
          }
        }
      } else {
        console.log('!queue.lastTokenId');
        if (queue.activeTokenId) {
          console.log('queue.activeTokenId');

          if (!isValid) {
            // console.log('!isValid');
            if (!queue.exceptional.includes(token.tokenNumber))
              queue.exceptional = [
                ...(queue.exceptional || []),
                token.tokenNumber,
              ];

            io.emit('tokenUpdate', {
              data: {
                offset: queue.offset,
                waitTime: queue.waitTime,
                exceptional: queue.exceptional,
              },
              message: 'Est. turn time updated successfully',
              success: true,
            });
          }
        } else {
          console.log('!queue.activeTokenId');

          token.tokenActivationTime = currentTime;

          const clinic = await Clinic.findOne({}).lean();

          const parsedDate = parse(
            clinic.clinicOpeningTime,
            'hh:mm a',
            new Date()
          );
          queue.activeTokenId = token._id;
          token.isActive = true;

          console.log('addHours(parsedDate, 5) ');

          const waitTime = differenceInMinutes(
            currentTime,
            addHours(parsedDate, 5)
          );
          queue.waitTime = waitTime;

          console.log('io.emit');

          io.emit('tokenUpdate', {
            data: {
              offset: queue.offset,
              waitTime: waitTime,
              exceptional: queue.exceptional,
              active: token,
            },
            message: 'Est. turn time updated successfully',
            success: true,
          });
        }
      }
      break;

    case 'completed':
      if (token.checkInOutStatus !== 'onsite') {
        throw new ApiError(400, 'Token must be onsite before completion');
      }
      token.isActive = false;
      token.checkInOutStatus = checkInOutStatus;
      token.checkedOutTime = addHours(new Date(), 5);

      const firstTrueIndex = queue.upcomingTokenIds.findIndex(
        (item) =>
          item.checkInOutStatus === 'onsite' &&
          item.tokenNumber !== token.tokenNumber
      );

      const validTokens = queue.upcomingTokenIds
        .filter(
          (item) =>
            item.checkInOutStatus === 'onsite' &&
            item.tokenNumber !== token.tokenNumber &&
            item.tokenNumber <= token.tokenNumber
        )
        .sort((a, b) => a.tokenNumber - b.tokenNumber);

      const behindTrueIndex = validTokens.length
        ? queue.upcomingTokenIds.findIndex(
            (item) => item.tokenNumber === validTokens[0].tokenNumber
          )
        : -1;

      if (firstTrueIndex !== -1 || behindTrueIndex !== -1) {
        const nextToken =
          behindTrueIndex !== -1
            ? queue.upcomingTokenIds[behindTrueIndex]
            : queue.upcomingTokenIds[firstTrueIndex];

        const offset =
          differenceInMinutes(currentTime, token.tokenActivationTime) - 10;

        // console.log(offset, queue.offset + offset);

        queue.activeTokenId = nextToken._id;
        nextToken.tokenActivationTime = currentTime;
        nextToken.isActive = true;

        io.emit('tokenUpdate', {
          data: {
            offset: offset + queue.offset,
            waitTime: queue.waitTime,
            exceptional: queue.exceptional,
            active: nextToken,
          },
          message: 'Est. turn time updated successfully',
          success: true,
        });

        queue.offset = offset;

        await nextToken.save();
      }

      // else if (queue.exceptional.length > 0) {
      //   const sortedExceptional = [...queue.exceptional].sort((a, b) => a - b);

      //   // Find the smallest exceptional token that is onsite
      //   const nextToken = queue.upcomingTokenIds.find(
      //     (item) =>
      //       sortedExceptional.includes(item.tokenNumber) &&
      //       item.checkInOutStatus === 'onsite'
      //   );

      //   if (nextToken) {
      //     const currentTokenNumber = token.tokenNumber;

      //     let previousUnarrivedTokens = [];
      //     let skippedTokenNumbers = [];

      //     previousUnarrivedTokens = queue.upcomingTokenIds.filter(
      //       (item) =>
      //         item.tokenNumber < currentTokenNumber &&
      //         item.tokenNumber !== token.tokenNumber &&
      //         item.checkInOutStatus !== 'completed'
      //     );

      //     console.log('previousUnarrivedTokens : ', previousUnarrivedTokens);

      //     skippedTokenNumbers = previousUnarrivedTokens.map(
      //       (t) => t.tokenNumber
      //     );
      //     // Merge into queue.exceptional (avoiding duplicates)
      //     queue.exceptional = Array.from(
      //       new Set([...(queue.exceptional || []), ...skippedTokenNumbers])
      //     );

      //     const offset =
      //       differenceInMinutes(currentTime, token.tokenActivationTime) - 10;

      //     queue.activeTokenId = nextToken._id;
      //     nextToken.tokenActivationTime = currentTime;
      //     nextToken.isActive = true;

      //     // Remove from exceptional
      //     queue.exceptional = queue.exceptional.filter(
      //       (num) => num !== nextToken.tokenNumber
      //     );

      //     io.emit('tokenUpdate', {
      //       data: {
      //         offset: offset + queue.offset,
      //         waitTime: queue.waitTime,
      //         exceptional: queue.exceptional,
      //         active: nextToken,
      //       },
      //       message: 'Exceptional token activated',
      //       success: true,
      //     });

      //     queue.offset = offset;

      //     await nextToken.save();
      //   }
      // }
      else {
        queue.activeTokenId = null;
        const offset =
          differenceInMinutes(currentTime, token.tokenActivationTime) - 10;
        queue.offset = offset + queue.offset;
        io.emit('tokenUpdate', {
          data: {
            offset: queue.offset,
            waitTime: queue.waitTime,
            exceptional: queue.exceptional,
            active: null,
          },
          message: 'Est. turn time updated successfully',
          success: true,
        });
      }

      queue.lastTokenId = token._id;
      break;

    case 'cancelled':
      token.isActive = false;
      token.checkInOutStatus = checkInOutStatus;
      token.cancellationDetails = {
        cancelledBy: req.user.role,
        cancelledById: req.user._id,
        cancelledAt: addHours(new Date(), 5),
      };

      // Remove token from queue's upcoming tokens
      queue.upcomingTokenIds = queue.upcomingTokenIds.filter(
        (id) => id.toString() !== tokenId.toString()
      );

      // If this was the active token, clear it
      if (queue.activeTokenId?.toString() === tokenId.toString()) {
        queue.activeTokenId = null;
      }

      io.emit('tokenUpdate', {
        data: {
          offset: queue.offset,
          waitTime: queue.waitTime,
          exceptional: queue.exceptional,
        },
        message: 'Token cancelled successfully',
        success: true,
      });
      break;

    default:
      throw new ApiError(400, 'Bad status for token');
  }
  await queue.save();
  await token.save();

  res.json(new ApiResponse(200, token, 'Token status updated successfully'));
});

// @@ Get token history
export const getTokenHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const tokens = await UserToken.find({userId})
    .sort({tokenGenerationTime: -1})
    .select(
      'tokenNumber date estimatedTurnTime checkInOutStatus tokenGenerationTime estimatedEndTime isActive'
    );

  if (!tokens || tokens.length === 0) {
    throw new ApiError(404, 'No tokens found for this user');
  }

  // Format the tokens with proper timezone handling
  const formattedTokens = tokens.map((token) => {
    // Helper function to safely parse and format dates
    const formatDate = (date) => {
      if (!date) return null;
      // If date is already a Date object, use it directly
      const dateObj = date instanceof Date ? date : parseISO(date);
      const pakistanDate = addHours(dateObj, 5);
      return format(pakistanDate, 'yyyy-MM-dd');
    };

    const formatTime = (date) => {
      if (!date) return null;
      // If date is already a Date object, use it directly
      const dateObj = date instanceof Date ? date : parseISO(date);
      const pakistanDate = addHours(dateObj, 5);
      return format(pakistanDate, 'HH:mm');
    };

    const formatDateTime = (date) => {
      if (!date) return null;
      // If date is already a Date object, use it directly
      const dateObj = date instanceof Date ? date : parseISO(date);
      const pakistanDate = addHours(dateObj, 5);
      return format(pakistanDate, 'yyyy-MM-dd HH:mm');
    };

    return {
      ...token.toObject(),
      date: formatDate(token.date),
      estimatedTurnTime: formatTime(token.estimatedTurnTime),
      tokenGenerationTime: formatDateTime(token.tokenGenerationTime),
      estimatedEndTime: formatTime(token.estimatedEndTime),
    };
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        formattedTokens,
        'Token history retrieved successfully'
      )
    );
});

// Get all tokens for a specific date
export const getAllTokensByDate = asyncHandler(async (req, res) => {
  const {date} = req.query;

  if (!date) {
    throw new ApiError(400, 'Date parameter is required');
  }

  const parseDate = (dateInput) => {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    return parseISO(dateInput);
  };

  const parsedDate = addHours(parseDate(date), 5);
  const dayStart = startOfDay(parsedDate);
  const dayEnd = addHours(dayStart, 24);

  const tokens = await UserToken.find({
    date: {$gte: dayStart, $lt: dayEnd},
  })
    .sort({tokenGenerationTime: 1})
    .select(
      'tokenNumber date estimatedTurnTime checkInOutStatus tokenGenerationTime estimatedEndTime isActive userId'
    )
    .populate('userId', 'name email');

  if (!tokens || tokens.length === 0) {
    throw new ApiError(
      404,
      `No tokens found for date: ${format(dayStart, 'yyyy-MM-dd')}`
    );
  }

  const formatTime = (date) => {
    if (!date) return null;
    const dateObj = parseDate(date);
    const pakistanDate = addHours(dateObj, 5);
    return format(pakistanDate, 'HH:mm');
  };

  const formatDateTime = (date) => {
    if (!date) return null;
    const dateObj = parseDate(date);
    const pakistanDate = addHours(dateObj, 5);
    return format(pakistanDate, 'yyyy-MM-dd HH:mm');
  };

  const totalTokens = tokens.length;
  const activeTokens = tokens.filter((token) => token.isActive).length;
  const statusCounts = {
    pending: tokens.filter((token) => token.checkInOutStatus === 'pending')
      .length,
    onsite: tokens.filter((token) => token.checkInOutStatus === 'onsite')
      .length,
    completed: tokens.filter((token) => token.checkInOutStatus === 'completed')
      .length,
    cancelled: tokens.filter((token) => token.checkInOutStatus === 'cancelled')
      .length,
  };

  const formattedTokens = tokens.map((token) => ({
    ...token.toObject(),
    date: format(parseDate(token.date), 'yyyy-MM-dd'),
    estimatedTurnTime: formatTime(token.estimatedTurnTime),
    tokenGenerationTime: formatDateTime(token.tokenGenerationTime),
    estimatedEndTime: formatTime(token.estimatedEndTime),
    user: {
      name: token.userId.name,
      email: token.userId.email,
    },
  }));

  res.status(200).json(
    new ApiResponse(
      200,
      {
        tokens: formattedTokens,
        statistics: {
          total: totalTokens,
          active: activeTokens,
          ...statusCounts,
        },
        date: format(dayStart, 'yyyy-MM-dd'),
      },
      `Tokens retrieved successfully for date: ${format(
        dayStart,
        'yyyy-MM-dd'
      )}`
    )
  );
});

// @@ Get the active token for a specific date
export const getActiveTokenByDate = asyncHandler(async (req, res) => {
  const socket = req.io;
  const {date} = req.body;

  if (!date) {
    throw new ApiError(400, 'Date parameter is required');
  }

  const parseDate = (dateInput) => {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    return parseISO(dateInput);
  };

  const parsedDate = addHours(parseDate(date), 5);
  const dayStart = startOfDay(parsedDate);
  const dayEnd = addHours(dayStart, 24);

  const activeToken = await UserToken.findOne({
    date: {$gte: dayStart, $lt: dayEnd},
    isActive: true,
  }).select(
    'tokenNumber date estimatedTurnTime checkInOutStatus tokenGenerationTime estimatedEndTime'
  );

  if (!activeToken) {
    throw new ApiError(404, 'No active token found for the specified date');
  }

  const formatTime = (date) => {
    if (!date) return null;
    const dateObj = parseDate(date);
    const pakistanDate = addHours(dateObj, 5);
    return format(pakistanDate, 'HH:mm');
  };

  const formatDateTime = (date) => {
    if (!date) return null;
    const dateObj = parseDate(date);
    const pakistanDate = addHours(dateObj, 5);
    return format(pakistanDate, 'yyyy-MM-dd HH:mm');
  };

  const formattedToken = {
    ...activeToken.toObject(),
    date: format(parseDate(activeToken.date), 'yyyy-MM-dd'),
    estimatedTurnTime: formatTime(activeToken.estimatedTurnTime),
    tokenGenerationTime: formatDateTime(activeToken.tokenGenerationTime),
    estimatedEndTime: formatTime(activeToken.estimatedEndTime),
  };

  socket.emit('activeToken', {data: formattedToken});

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        formattedToken,
        'Active token retrieved successfully'
      )
    );
});

// @@ Get tokens by status
export const getTokensByStatus = asyncHandler(async (req, res) => {
  const {status} = req.query;
  const userId = req.user._id;

  if (!status) {
    throw new ApiError(400, 'Status parameter is required');
  }

  const validStatuses = ['pending', 'onsite', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(
      400,
      `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    );
  }

  const parseDate = (dateInput) => {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    return parseISO(dateInput);
  };

  const tokens = await UserToken.find({
    userId,
    checkInOutStatus: status,
  })
    .sort({tokenGenerationTime: -1})
    .select(
      'tokenNumber date estimatedTurnTime checkInOutStatus tokenGenerationTime estimatedEndTime isActive'
    );

  if (!tokens || tokens.length === 0) {
    throw new ApiError(404, `No ${status} tokens found for this user`);
  }

  const formatTime = (date) => {
    if (!date) return null;
    const dateObj = parseDate(date);
    const pakistanDate = addHours(dateObj, 5);
    return format(pakistanDate, 'HH:mm');
  };

  const formatDateTime = (date) => {
    if (!date) return null;
    const dateObj = parseDate(date);
    const pakistanDate = addHours(dateObj, 5);
    return format(pakistanDate, 'yyyy-MM-dd HH:mm');
  };

  const formattedTokens = tokens.map((token) => ({
    ...token.toObject(),
    date: format(parseDate(token.date), 'yyyy-MM-dd'),
    estimatedTurnTime: formatTime(token.estimatedTurnTime),
    tokenGenerationTime: formatDateTime(token.tokenGenerationTime),
    estimatedEndTime: formatTime(token.estimatedEndTime),
  }));

  const statusCounts = await Promise.all(
    validStatuses.map(async (s) => ({
      status: s,
      count: await UserToken.countDocuments({userId, checkInOutStatus: s}),
    }))
  );

  res.status(200).json(
    new ApiResponse(
      200,
      {
        tokens: formattedTokens,
        statistics: statusCounts,
      },
      `${status} tokens retrieved successfully`
    )
  );
});

export const getUserToken = asyncHandler(async (req, res) => {
  const _id = req.user._id;
  const socket = req.io;
  const targetDate = new Date();

  const date = addHours(new Date(targetDate.setHours(0, 0, 0, 0)), 5);
  const userToken = await UserToken.findOne({
    userId: _id,
  }).lean();
  const queue = await Queue.findOne({}).lean();

  const token = await UserToken.findOne({
    date: date,
    isActive: true,
  });

  socket.emit('tokenUpdate', {
    data: {
      offset: queue?.offset || 0,
      waitTime: queue?.waitTime || 0,
      exceptional: queue?.exceptional || [],
      active: token,
    },
    message: 'Est. turn time updated successfully',
    success: true,
  });

  // socket.emit('activeToken', {data: token});

  res
    .status(200)
    .json(new ApiResponse(200, userToken, `token retrieved successfully`));
});

export const myTokenDetail = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const date = addHours(new Date(), 5);

  const clinic = await Clinic.findOne();
  if (!clinic) {
    throw new ApiError(
      404,
      'Clinic settings not found. Please visit the clinic'
    );
  }
  const requestedDate = formatISO(date);

  console.log('req : ', parseISO(requestedDate));

  let today = TZDate.tz('Asia/Karachi').toISOString();

  const existingToken = await UserToken.findOne({
    userId,
    date: parseISO(requestedDate),
  });

  if (existingToken) {
    throw new ApiError(400, 'You already have an active token for today.');
  }

  const clinicDate = parse(
    clinic.clinicOpeningTime,
    'hh:mm a',
    addHours(new Date(), 5)
  );
  const openingHours = getHours(clinicDate);
  const openingMinutes = getMinutes(clinicDate);

  const todayWithTime = set(today, {
    hours: openingHours,
    minutes: openingMinutes,
    seconds: 0,
    milliseconds: 0,
  });

  const openingTime = new TZDate(todayWithTime, 'Asia/Karachi');

  // Find the queue for today
  let queue = await Queue.findOne({
    date: parseISO(requestedDate),
  }).lean();

  let isActive = false;

  // Determine estimated turn time

  let estimatedTurnTime;
  if (queue && queue.upcomingTokenIds.length > 0) {
    console.log('finally if');
    const lastTokenId =
      queue.upcomingTokenIds[queue.upcomingTokenIds.length - 1];
    const lastToken = await UserToken.findById(lastTokenId);

    estimatedTurnTime = addMinutes(
      lastToken.estimatedTurnTime,
      10
    ).toISOString();
  } else {
    estimatedTurnTime = openingTime.toISOString();
    const now = addHours(new Date(), 5);
    estimatedTurnTime = addHours(parseISO(estimatedTurnTime), 5);

    // if (isAfter(now, addHours(parseISO(formatISO(openingTime)), 5)) && !queue) {
    //   queue.waitTime = differenceInMinutes(
    //     now,
    //     addHours(parseISO(formatISO(openingTime)), 5)
    //   );

    //   console.log(queue.waitTime);
    // }
  }

  // Get last token number for the day
  const lastTokenOfDay = await UserToken.findOne({
    date: addHours(parseISO(requestedDate), 5),
  });
  const tokenNumber = lastTokenOfDay ? queue.upcomingTokenIds.length + 1 : 1;

  const requiredToken = {
    userId,
    tokenNumber,
    estimatedTurnTime: estimatedTurnTime,
    date: addHours(parseISO(requestedDate), 5),
    checkInOutStatus: 'pending',
    isActive: isActive,
    tokenGenerationTime: addHours(parseISO(today), 5),
    estimatedEndTime: addMinutes(estimatedTurnTime, 10),
  };

  res
    .status(200)
    .json(new ApiResponse(200, requiredToken, 'Token generated successfully'));
});

// @@ Get active tokens for table with pagination and filters
export const getActiveTokensTable = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 7,
      search = '',
      status,
      date,
      sortField = 'tokenGenerationTime',
      sortOrder = 'desc',
    } = req.query;
    const skip = (page - 1) * limit;

    let targetDate;
    if (date) {
      targetDate = new Date(date);
    } else {
      targetDate = new Date();
    }

    const dayStart = addHours(startOfDay(targetDate), 5);
    const dayEnd = addHours(endOfDay(targetDate), 5);

    const query = {
      date: {
        $gte: dayStart,
        $lt: dayEnd,
      },
      checkInOutStatus: {$in: ['pending', 'onsite']},
    };

    if (status && ['pending', 'onsite'].includes(status)) {
      query.checkInOutStatus = status;
    }

    if (search) {
      const users = await User.find({
        $or: [
          {name: {$regex: search, $options: 'i'}},
          {email: {$regex: search, $options: 'i'}},
        ],
      }).select('_id');

      if (users.length > 0) {
        query.userId = {$in: users.map((user) => user._id)};
      } else {
        return res.status(200).json({
          success: true,
          tokens: [],
          total: 0,
          page: parseInt(page),
          totalPages: 0,
        });
      }
    }

    let sortConfig = {};
    if (sortField === 'tokenNumber') {
      sortConfig = {tokenNumber: sortOrder === 'asc' ? 1 : -1};
    } else if (sortField === 'tokenGenerationTime') {
      sortConfig = {tokenGenerationTime: sortOrder === 'asc' ? 1 : -1};
    } else if (sortField === 'estimatedTurnTime') {
      sortConfig = {estimatedTurnTime: sortOrder === 'asc' ? 1 : -1};
    } else if (sortField === 'date') {
      sortConfig = {date: sortOrder === 'asc' ? 1 : -1};
    } else if (sortField === 'status') {
      sortConfig = {checkInOutStatus: sortOrder === 'asc' ? 1 : -1};
    } else {
      sortConfig = {tokenGenerationTime: -1};
    }

    const tokens = await UserToken.find(query)
      .populate({
        path: 'userId',
        select: 'name email',
        match: {_id: {$exists: true}},
      })
      .sort(sortConfig)
      .skip(skip)
      .limit(limit);

    const total = await UserToken.countDocuments(query);

    const formattedTokens = tokens
      .filter((token) => token.userId !== null)
      .map((token) => ({
        id: token._id,
        tokenNumber: token.tokenNumber,
        full_name: token.userId?.name || 'Unknown User',
        email: token.userId?.email || 'No Email',
        status: token.checkInOutStatus,
        tokenGenerationTime: token.tokenGenerationTime,
        estimatedTurnTime: token.estimatedTurnTime,
        estimatedEndTime: token.estimatedEndTime,
        tokenActivationTime: token.tokenActivationTime,
        date: token.date,
      }));

    res.status(200).json({
      success: true,
      tokens: formattedTokens,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error in getActiveTokensTable:', error);
    res
      .status(500)
      .json(
        new ApiResponse(
          500,
          null,
          error.message || 'Error fetching active tokens'
        )
      );
  }
};

// @@ Update token status from table
export const updateTokenStatusTable = async (req, res) => {
  try {
    const {tokenId} = req.params;
    const {status} = req.body;

    console.log('Received update request:', {tokenId, status});

    if (!status || !['pending', 'onsite'].includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid status provided. Only "pending" and "onsite" are allowed.',
      });
    }

    const token = await UserToken.findById(tokenId);
    console.log('Found token:', token);

    if (!token) {
      return res.status(404).json({
        success: false,
        message: 'Token not found',
      });
    }

    token.checkInOutStatus = status;

    if (status === 'onsite') {
      token.tokenActivationTime = new Date();
    }

    await token.save();
    console.log('Token updated successfully');

    res.status(200).json({
      success: true,
      message: 'Token status updated successfully',
      token: {
        id: token._id,
        status: token.checkInOutStatus,
        tokenActivationTime: token.tokenActivationTime,
      },
    });
  } catch (error) {
    console.error('Error in updateTokenStatusTable:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating token status',
      error: error.message,
    });
  }
};

// @@ Delete token
export const deleteToken = asyncHandler(async (req, res) => {
  const {tokenId} = req.params;

  const token = await UserToken.findById(tokenId);
  if (!token) {
    throw new ApiError(404, 'Token not found');
  }

  const queue = await Queue.findOne({
    $or: [{activeTokenId: tokenId}, {upcomingTokenIds: tokenId}],
  });

  if (queue) {
    queue.upcomingTokenIds = queue.upcomingTokenIds.filter(
      (id) => id.toString() !== tokenId.toString()
    );

    if (queue.activeTokenId?.toString() === tokenId.toString()) {
      queue.activeTokenId = null;
    }

    if (queue.lastTokenId?.toString() === tokenId.toString()) {
      queue.lastTokenId = null;
    }

    await queue.save();
  }

  await UserToken.findByIdAndDelete(tokenId);

  io.emit('tokenDeleted', {
    tokenId,
    message: 'Token deleted successfully',
  });

  res
    .status(200)
    .json(new ApiResponse(200, null, 'Token deleted successfully'));
});

// @@ Get today's patients
export const getTodayPatients = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    sortField = 'tokenGenerationTime',
    sortOrder = 'desc',
  } = req.query;

  try {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    const startTime = addHours(startOfToday, 5);
    const endTime = addHours(endOfToday, 5);

    console.log('Date Range:', {
      startTime,
      endTime,
      currentServerTime: new Date(),
    });

    let userQuery = {};
    if (search) {
      const users = await User.find({
        $or: [
          {name: {$regex: search, $options: 'i'}},
          {email: {$regex: search, $options: 'i'}},
        ],
      }).select('_id');

      if (users.length > 0) {
        userQuery = {userId: {$in: users.map((user) => user._id)}};
      }
    }

    const query = {
      date: {
        $gte: startTime,
        $lt: endTime,
      },
      ...(search && userQuery),
    };

    console.log('Query:', JSON.stringify(query, null, 2));

    const total = await UserToken.countDocuments(query);
    console.log('Total tokens for today:', total);

    const tokens = await UserToken.find(query)
      .populate({
        path: 'userId',
        select: 'name email',
      })
      .sort({[sortField]: sortOrder === 'asc' ? 1 : -1})
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    console.log('Found tokens for today:', tokens.length);

    const formattedTokens = tokens
      .filter((token) => token.userId)
      .map((token) => ({
        id: token._id,
        tokenNumber: token.tokenNumber,
        full_name: token.userId?.name || 'Unknown User',
        email: token.userId?.email || 'No Email',
        estimatedTurnTime: token.estimatedTurnTime,
        tokenGenerationTime: token.tokenGenerationTime,
        date: token.date,
        status: token.checkInOutStatus,
      }));

    const statusCounts = {
      pending: await UserToken.countDocuments({
        ...query,
        checkInOutStatus: 'pending',
      }),
      onsite: await UserToken.countDocuments({
        ...query,
        checkInOutStatus: 'onsite',
      }),
      completed: await UserToken.countDocuments({
        ...query,
        checkInOutStatus: 'completed',
      }),
      cancelled: await UserToken.countDocuments({
        ...query,
        checkInOutStatus: 'cancelled',
      }),
    };

    res.status(200).json({
      success: true,
      tokens: formattedTokens,
      total,
      statusCounts,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error in getTodayPatients:', error);
    throw new ApiError(500, error.message || "Error fetching today's patients");
  }
});

// @@ Get generateEmergencyToken's patients
export const generateEmergencyToken = asyncHandler(async (req, res) => {
  const {date, name, phoneNumber} = req.body;
  const userId = req.user._id;

  if (!date) {
    throw new ApiError(400, 'Missing required field: date');
  }

  const clinic = await Clinic.findOne();
  if (!clinic) {
    throw new ApiError(
      404,
      'Clinic settings not found. Please visit the clinic'
    );
  }

  // Convert provided date and today to start of the day (without time)
  const requestedDate = formatISO(
    addHours(new TZDate(date, 'Asia/Karachi'), 5).setHours(0, 0, 0, 0),
    {
      representation: 'complete',
    }
  );
  let today = TZDate.tz('Asia/Karachi').toISOString();

  // // //Uncomment the below feature if you are done with the development

  // if (
  //   !isSameDay(requestedDate, today, {
  //     in: tz("Asia/Karachi"),
  //   })
  // ) {
  //   throw new ApiError(400, "Cannot generate tokens for past or future dates.");
  // }

  // Check if user already has an active token for the selected date
  const existingToken = await UserToken.findOne({
    userId,
    date: requestedDate,
  });

  if (existingToken) {
    throw new ApiError(400, 'You already have an active token for today.');
  }

  // Convert clinic opening and closing times to today's full DateTime
  // const clinicOpenStoredTime = parse(
  //   clinic.clinicOpeningTime,
  //   'hh:mm a',
  //   today
  // );

  const clinicDate = parse(
    clinic.clinicOpeningTime,
    'hh:mm a',
    addHours(new Date(), 5)
  );
  const openingHours = getHours(clinicDate);
  const openingMinutes = getMinutes(clinicDate);

  const todayWithTime = set(today, {
    hours: openingHours,
    minutes: openingMinutes,
    seconds: 0,
    milliseconds: 0,
  });

  const clinicClosingTime = parse(
    clinic.clinicClosingTime,
    'hh:mm a',
    addHours(new Date(), 5)
  );
  const closingHours = getHours(clinicClosingTime);
  const closingMinutes = getMinutes(clinicClosingTime);

  const todayWithTimeClose = set(today, {
    hours: closingHours,
    minutes: closingMinutes,
    seconds: 0,
    milliseconds: 0,
  });

  const openingTime = new TZDate(todayWithTime, 'Asia/Karachi');

  const closingTime = new TZDate(
    todayWithTimeClose,
    'Asia/Karachi'
  ).toISOString();

  const tokenStartTime = addMinutes(openingTime, -15);

  // // Uncomment this when you are done with the coding

  // if (
  //   isBefore(today, tokenStartTime.toISOString()) ||
  //   isAfter(today, closingTime)
  // ) {
  //   throw new ApiError(400, 'Cannot generate token outside clinic hours.');
  // }

  // Find the queue for today
  let queue = await Queue.findOne({
    date: addHours(parseISO(requestedDate), 5),
  });

  if (!queue) {
    queue = new Queue({
      date: addHours(parseISO(requestedDate), 5),
      activeTokenId: null,
      upcomingTokenIds: [],
    });
  }

  // Determine estimated turn time
  let estimatedTurnTime;
  if (queue.upcomingTokenIds.length > 0) {
    const lastTokenId =
      queue.upcomingTokenIds[queue.upcomingTokenIds.length - 1];
    const lastToken = await UserToken.findById(lastTokenId);

    estimatedTurnTime = addMinutes(
      lastToken.estimatedTurnTime,
      10
    ).toISOString();
  } else {
    estimatedTurnTime = openingTime.toISOString();
    const now = addHours(new Date(), 5);
    estimatedTurnTime = addHours(parseISO(estimatedTurnTime), 5);

    console.log(
      isAfter(now, addHours(parseISO(formatISO(openingTime)), 5)) && !queue
    );
    if (isAfter(now, addHours(parseISO(formatISO(openingTime)), 5))) {
      if (!queue || queue.upcomingTokenIds.length === 0)
        queue.waitTime = differenceInMinutes(
          now,
          addHours(parseISO(formatISO(openingTime)), 5)
        );
    }
  }

  // Get last token number for the day
  const lastTokenOfDay = await UserToken.findOne({
    date: addHours(parseISO(requestedDate), 5),
  });
  const tokenNumber = lastTokenOfDay ? queue.upcomingTokenIds.length + 1 : 1;

  console.log('estimatedTurnTime :', estimatedTurnTime);
  // Create new token
  const userToken = new UserToken({
    userId,
    tokenNumber,
    estimatedTurnTime: estimatedTurnTime,
    date: addHours(parseISO(requestedDate), 5),
    checkInOutStatus: 'pending',
    isActive: false,
    tokenGenerationTime: addHours(parseISO(today), 5),
    estimatedEndTime: addMinutes(estimatedTurnTime, 10),
  });

  io.emit('tokenUpdate', {
    data: {
      waitTime: queue.waitTime,
    },
  });

  await userToken.save();

  queue.upcomingTokenIds.push(userToken._id);
  await queue.save();

  res
    .status(201)
    .json(new ApiResponse(201, userToken, 'Token generated successfully'));
});
