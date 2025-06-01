import Queue from '../models/queue.model.js';
import UserToken from '../models/userToken.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/errors/ApiError.js';
import {ApiResponse} from '../utils/errors/ApiResponse.js';
import {asyncHandler} from '../utils/errors/asyncHandler.js';
import {io} from '../../index.js';
import Clinic from '../models/clinic.model.js';
import moment from 'moment-timezone';
import {
  parseISO,
  format,
  isBefore,
  isAfter,
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
  startOfDay,
} from 'date-fns';
import PrivacySettings from '../models/PrivacySettings.model.js';
import {
  toAppTimezone,
  formatInAppTimezone,
  getCurrentAppTime,
  toUTC,
  fromUTC,
  getStartOfDay,
  getEndOfDay,
} from '../utils/timezoneUtils.js';
import {TZDate} from '@date-fns/tz';

// @@ Generate token
export const generateToken = asyncHandler(async (req, res) => {
  console.log('Generate token ki api ');
  const {date, type = 'user'} = req.body;
  const userId = type === 'admin' ? req.userId : req.user._id;

  if (!date) {
    throw new ApiError(400, 'Missing required field: date');
  }

  // Ensure date is properly parsed
  let requestedDate;
  try {
    requestedDate = new Date(date);
    if (isNaN(requestedDate.getTime())) {
      throw new Error('Invalid date format');
    }
  } catch (error) {
    throw new ApiError(400, 'Invalid date format provided');
  }
  console.log('requestedDate:', requestedDate);

  const clinic = await Clinic.findOne();
  if (!clinic) {
    throw new ApiError(
      404,
      'Clinic settings not found. Please visit the clinic'
    );
  }

  if (!clinic.tokenGenerationStatus)
    throw new ApiError(
      400,
      'Cannot generate new token since doctor is unavailable at this moment.'
    );

  // Convert provided date to application timezone
  const today = getCurrentAppTime();
  console.log('today:', today);
  const startOfRequestedDate = getStartOfDay(requestedDate);
  console.log('startOfRequestedDate:', startOfRequestedDate);

  // Check if user already has an active token for the selected date
  const existingToken = await UserToken.findOne({
    userId,
    date: startOfRequestedDate,
  });

  if (existingToken) {
    throw new ApiError(400, 'You already have an active token for today.');
  }

  // Convert clinic opening time to application timezone
  const clinicDate = parse(
    clinic.clinicOpeningTime,
    'hh:mm a',
    getCurrentAppTime()
  );
  console.log('clinicDate:', clinicDate);
  const openingHours = getHours(clinicDate);
  const openingMinutes = getMinutes(clinicDate);

  const todayWithTime = set(today, {
    hours: openingHours,
    minutes: openingMinutes,
    seconds: 0,
    milliseconds: 0,
  });
  console.log('todayWithTime:', todayWithTime);

  const clinicClosingTime = parse(
    clinic.clinicClosingTime,
    'hh:mm a',
    getCurrentAppTime()
  );
  console.log('clinicClosingTime:', clinicClosingTime);
  const closingHours = getHours(clinicClosingTime);
  const closingMinutes = getMinutes(clinicClosingTime);

  const todayWithTimeClose = set(today, {
    hours: closingHours,
    minutes: closingMinutes,
    seconds: 0,
    milliseconds: 0,
  });
  console.log('todayWithTimeClose:', todayWithTimeClose);

  const openingTime = toAppTimezone(todayWithTime);
  console.log('openingTime:', openingTime);
  const closingTime = toAppTimezone(todayWithTimeClose);
  console.log('closingTime:', closingTime);

  const tokenStartTime = addMinutes(openingTime, -15);
  console.log('tokenStartTime:', tokenStartTime);

  // Find the queue for today
  let queue = await Queue.findOne({
    date: startOfRequestedDate,
  }).populate('upcomingTokenIds');

  if (!queue) {
    queue = new Queue({
      date: startOfRequestedDate,
      activeTokenId: null,
      upcomingTokenIds: [],
    });
  }

  // Determine estimated turn time
  let estimatedTurnTime;
  if (queue.upcomingTokenIds.length > 0) {
    const lastTokenId = queue.upcomingTokenIds
      .filter((item) => item.isEmergency === false)
      .pop();

    if (lastTokenId) {
      const lastToken = await UserToken.findById(lastTokenId._id);
      estimatedTurnTime = addMinutes(lastToken.estimatedTurnTime, 10);
      console.log('estimatedTurnTime (from lastToken):', estimatedTurnTime);
    } else {
      const activeToken = await UserToken.findOne({
        isActive: true,
        isEmergency: true,
      }).lean();

      if (activeToken && activeToken.tokenNumber === 1) {
        estimatedTurnTime = activeToken.tokenActivationTime;
        console.log('estimatedTurnTime (from activeToken):', estimatedTurnTime);
      } else {
        estimatedTurnTime = openingTime;
        console.log('estimatedTurnTime (from openingTime):', estimatedTurnTime);
        const now = getCurrentAppTime();
        console.log('now:', now);
        if (isAfter(now, openingTime)) {
          queue.waitTime = differenceInMinutes(now, openingTime);
        }
      }
    }
  } else {
    estimatedTurnTime = openingTime;
    console.log('estimatedTurnTime (no upcomingTokenIds):', estimatedTurnTime);
    const now = getCurrentAppTime();
    console.log('now:', now);
    if (isAfter(now, openingTime)) {
      if (!queue || queue.upcomingTokenIds.length === 0) {
        queue.waitTime = differenceInMinutes(now, openingTime);
      }
    }
  }

  // Get last token number for the day
  const lastTokenOfDay = await UserToken.findOne({
    date: startOfRequestedDate,
  });
  console.log('lastTokenOfDay:', lastTokenOfDay);
  const tokenNumber = lastTokenOfDay ? queue.upcomingTokenIds.length + 1 : 1;

  // Create new token
  const userToken = new UserToken({
    userId,
    tokenNumber,
    estimatedTurnTime,
    date: startOfRequestedDate,
    checkInOutStatus: 'pending',
    isActive: false,
    tokenGenerationTime: getCurrentAppTime(),
    estimatedEndTime: addMinutes(estimatedTurnTime, 10),
  });
  console.log('userToken object:', {
    userId,
    tokenNumber,
    estimatedTurnTime,
    date: startOfRequestedDate,
    checkInOutStatus: 'pending',
    isActive: false,
    tokenGenerationTime: getCurrentAppTime(),
    estimatedEndTime: addMinutes(estimatedTurnTime, 10),
  });

  io.emit('tokenUpdate', {
    data: {
      offset: queue.offset,
      waitTime: queue.waitTime,
      exceptional: queue.exceptional,
    },
  });

  await userToken.save();

  queue.upcomingTokenIds.push(userToken._id);
  await queue.save();

  const fullQueue = await Queue.findOne().populate('upcomingTokenIds');

  io.emit('queue', {
    queue: fullQueue.upcomingTokenIds,
  });

  res
    .status(201)
    .json(new ApiResponse(201, userToken, 'Token generated successfully'));
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
    cancelledAt: getCurrentAppTime(),
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

  const message =
    role === 'admin' ? 'Token cancelled by admin' : 'Token cancelled by user';

  res.status(200).json(
    new ApiResponse(
      200,
      {
        token: {
          ...token.toObject(),
          date: formatInAppTimezone(token.date, 'yyyy-MM-dd'),
          estimatedTurnTime: formatInAppTimezone(
            token.estimatedTurnTime,
            'HH:mm'
          ),
          tokenGenerationTime: formatInAppTimezone(token.tokenGenerationTime),
          estimatedEndTime: formatInAppTimezone(
            token.estimatedEndTime,
            'HH:mm'
          ),
          cancellationDetails: {
            ...token.cancellationDetails,
            cancelledAt: formatInAppTimezone(
              token.cancellationDetails.cancelledAt
            ),
          },
        },
      },
      message
    )
  );
});

// @@ Get queue status
export const getQueueStatus = asyncHandler(async (req, res) => {
  console.log('getQueueStatus ki api ');
  const targetDate = getCurrentAppTime();
  const startOfDay = addHours(getStartOfDay(targetDate), 5);
  const endOfDay = addHours(getEndOfDay(targetDate), 5);

  console.log('targetDate : ', targetDate);
  console.log('startOfDay : ', startOfDay);
  console.log('endOfDay : ', endOfDay);

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

export const getQueueDoctor = asyncHandler(async (req, res) => {
  console.log('getQueueDoctor ki api ');
  const targetDate = getCurrentAppTime();
  const startOfDay = addHours(getStartOfDay(targetDate), 5);
  const endOfDay = addHours(getEndOfDay(targetDate), 5);

  console.log('targetDate : ', targetDate);
  console.log('startOfDay : ', startOfDay);
  console.log('endOfDay : ', endOfDay);

  const allTokens = await Queue.findOne({
    date: {$gte: startOfDay, $lt: endOfDay},
  })
    .populate('upcomingTokenIds')
    .lean();

  console.log(allTokens);

  io.emit('queue', {
    queue: allTokens?.upcomingTokenIds || [],
  });

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
  console.log('updateTokenStatus ki api ');
  const {tokenId} = req.params;
  const {checkInOutStatus} = req.body;

  const token = await UserToken.findById(tokenId);
  if (!token) throw new ApiError(404, 'Token not found');

  const doctorsQueue = await Queue.findOne({
    upcomingTokenIds: {$in: [tokenId]},
  }).populate('upcomingTokenIds lastTokenId');
  if (!doctorsQueue) throw new ApiError(404, 'Queue not found');

  let queue = doctorsQueue;

  const currentTime = getCurrentAppTime();
  console.log('currentTime : ', currentTime);

  switch (checkInOutStatus) {
    case 'pending':
      if (token.checkInOutStatus !== 'onsite') {
        throw new ApiError(404, 'User must be onsite before');
      }
      if (!token.isActive) {
        throw new ApiError(
          404,
          'Token must be active before going into pending'
        );
      }

    case 'completed':
      if (token.checkInOutStatus !== 'onsite') {
        throw new ApiError(400, 'Token must be onsite before completion');
      }
      token.isActive = false;
      token.checkInOutStatus = checkInOutStatus;
      token.checkedOutTime = getCurrentAppTime();
      console.log('token.checkedOutTime : ', token.checkedOutTime);

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

        let offset = 0;

        if (token.isEmergency) {
          offset = differenceInMinutes(currentTime, token.tokenActivationTime);
        } else {
          offset =
            differenceInMinutes(currentTime, token.tokenActivationTime) - 10;
        }

        queue.activeTokenId = nextToken._id;
        nextToken.tokenActivationTime = currentTime;
        console.log(
          'nextToken.tokenActivationTime : ',
          nextToken.tokenActivationTime
        );
        nextToken.isActive = true;

        io.emit('tokenUpdate', {
          data: {
            offset: offset + queue.offset,
            waitTime: queue.waitTime,
            exceptional: queue.exceptional,
            active: nextToken,
            isEmergency: nextToken.isEmergency,
          },
          message: 'Est. turn time updated successfully',
          success: true,
        });

        queue.offset = offset;

        await nextToken.save();
      } else if (queue.exceptional.length > 0) {
        const sortedExceptional = [...queue.exceptional].sort((a, b) => a - b);

        // Find the smallest exceptional token that is onsite
        const nextToken = queue.upcomingTokenIds.find(
          (item) =>
            sortedExceptional.includes(item.tokenNumber) &&
            item.checkInOutStatus === 'onsite'
        );

        if (nextToken) {
          let offset = 0;
          if (token.isEmergency) {
            offset = differenceInMinutes(
              currentTime,
              token.tokenActivationTime
            );
          } else {
            offset =
              differenceInMinutes(currentTime, token.tokenActivationTime) - 10;
          }

          queue.activeTokenId = nextToken._id;
          nextToken.tokenActivationTime = currentTime;
          nextToken.isActive = true;

          // Remove from exceptional
          queue.exceptional = queue.exceptional.filter(
            (num) => num !== nextToken.tokenNumber
          );

          io.emit('tokenUpdate', {
            data: {
              offset: offset + queue.offset,
              waitTime: queue.waitTime,
              exceptional: queue.exceptional,
              active: nextToken,
              isEmergency: nextToken.isEmergency,
            },
            message: 'Exceptional token activated',
            success: true,
          });

          queue.offset = offset;

          await nextToken.save();
        }
      } else {
        queue.activeTokenId = null;

        let offset = 0;

        if (token.isEmergency) {
          offset = differenceInMinutes(currentTime, token.tokenActivationTime);
        } else {
          offset =
            differenceInMinutes(currentTime, token.tokenActivationTime) - 10;
        }

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

          console.log('WaitTime is : ', waitTime);
          queue.waitTime = waitTime + queue.waitTime;

          token.isActive = true;
          token.tokenActivationTime = currentTime;
          queue.activeTokenId = token._id;

          io.emit('tokenUpdate', {
            data: {
              offset: queue.offset,
              waitTime: queue.waitTime,
              exceptional: queue.exceptional,
              active: token,
              isEmergency: token.isEmergency,
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
            getCurrentAppTime()
          );
          console.log('parsedDate : ', parsedDate);
          queue.activeTokenId = token._id;
          token.isActive = true;

          const waitTime = differenceInMinutes(currentTime, parsedDate);
          queue.waitTime = waitTime;

          console.log('io.emit');

          io.emit('tokenUpdate', {
            data: {
              offset: queue.offset,
              waitTime: waitTime,
              exceptional: queue.exceptional,
              active: token,
              isEmergency: token.isEmergency,
            },
            message: 'Est. turn time updated successfully',
            success: true,
          });
        }
      }
      break;

    case 'cancelled':
      token.isActive = false;
      token.checkInOutStatus = checkInOutStatus;
      token.cancellationDetails = {
        cancelledBy: req.user.role,
        cancelledById: req.user._id,
        cancelledAt: getCurrentAppTime(),
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
  const fullQueue = await Queue.findOne().populate('upcomingTokenIds');

  io.emit('queue', {
    queue: fullQueue.upcomingTokenIds,
  });

  res.json(new ApiResponse(200, token, 'Token status updated successfully'));
});

// @@ Get QR Code for admin
export const getQRCode = asyncHandler(async (req, res) => {
  console.log('getQRCode ki api ');
  const targetDate = new Date();
  const startOfDay = addHours(new Date(targetDate.setHours(0, 0, 0, 0)), 5);
  const endOfDay = addHours(new Date(targetDate.setHours(23, 59, 59, 999)), 5);

  console.log('targetDate : ', targetDate);
  console.log('startOfDay : ', startOfDay);
  console.log('endOfDay : ', endOfDay);

  const queue = await Queue.findOne({
    date: {$gte: startOfDay, $lt: endOfDay},
  });

  if (!queue) {
    throw new ApiError(404, 'No queue found for today');
  }

  // Generate a unique QR code URL that uses the custom scheme for deep linking
  const qrCodeUrl = `medqueue://scan-qr/${queue._id}`;

  res
    .status(200)
    .json(
      new ApiResponse(200, {qrCodeUrl}, 'QR code URL generated successfully')
    );
});

// @@ Scan QR Code and update token status
export const scanQRCode = asyncHandler(async (req, res) => {
  const {queueId} = req.params;
  const userId = req.user._id;

  const queue = await Queue.findById(queueId);
  if (!queue) {
    return res.status(404).json({success: false, message: 'Queue not found'});
  }

  // Find the user's active token for today
  const token = await UserToken.findOne({
    userId,
    date: queue.date,
    checkInOutStatus: 'pending',
  });

  if (!token) {
    return res.status(200).json({
      success: false,
      message: 'No pending token found for this user in the queue',
    });
  }

  // Only validate, do not update token or queue
  return res.status(200).json({success: true});
});

// @@ Get token history
export const getTokenHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const tokens = await UserToken.find({userId}).sort({
    tokenGenerationTime: -1,
  });
  if (!tokens || tokens.length === 0) {
    throw new ApiError(404, 'No tokens found for this user');
  }

  // Format the tokens with proper timezone handling
  const formattedTokens = tokens.map((token) => {
    return {
      ...token.toObject(),
      date: formatInAppTimezone(token.date, 'yyyy-MM-dd'),
      estimatedTurnTime: formatInAppTimezone(token.estimatedTurnTime, 'HH:mm'),
      tokenGenerationTime: formatInAppTimezone(token.tokenGenerationTime),
      estimatedEndTime: formatInAppTimezone(token.estimatedEndTime, 'HH:mm'),
      OriginalToken: token.toObject(),
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
  console.log('getAllTokensByDate ki api ');
  const {date} = req.query;

  if (!date) {
    throw new ApiError(400, 'Date parameter is required');
  }

  const parseDate = (dateInput) => {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    return parseISO(dateInput);
  };

  const parsedDate = parseDate(date);
  const dayStart = startOfDay(parsedDate);
  const dayEnd = addHours(dayStart, 24);

  console.log('dayStart : ', dayStart);
  console.log('dayEnd : ', dayEnd);
  console.log('parsedDate : ', parsedDate);

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
    const pakistanDate = dateObj;
    return format(pakistanDate, 'HH:mm');
  };

  const formatDateTime = (date) => {
    if (!date) return null;
    const dateObj = parseDate(date);
    const pakistanDate = dateObj;
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

  const parsedDate = parseDate(date);
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
    const pakistanDate = dateObj;
    return format(pakistanDate, 'HH:mm');
  };

  const formatDateTime = (date) => {
    if (!date) return null;
    const dateObj = parseDate(date);
    const pakistanDate = dateObj;
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
  }).sort({tokenGenerationTime: -1});

  if (!tokens || tokens.length === 0) {
    throw new ApiError(404, `No ${status} tokens found for this user`);
  }

  const formatTime = (date) => {
    if (!date) return null;
    const dateObj = parseDate(date);
    const pakistanDate = dateObj;
    return format(pakistanDate, 'HH:mm');
  };

  const formatDateTime = (date) => {
    if (!date) return null;
    const dateObj = parseDate(date);
    const pakistanDate = dateObj;
    return format(pakistanDate, 'yyyy-MM-dd HH:mm');
  };

  const formattedTokens = tokens.map((token) => ({
    ...token.toObject(),
    date: format(parseDate(token.date), 'yyyy-MM-dd'),
    estimatedTurnTime: formatTime(token.estimatedTurnTime),
    tokenGenerationTime: formatDateTime(token.tokenGenerationTime),
    estimatedEndTime: formatTime(token.estimatedEndTime),
    OriginalToken: token.toObject(),
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
  console.log('getUserToken ki api ');
  const _id = req.user._id;
  const socket = req.io;
  const targetDate = new Date();
  const settings = await PrivacySettings.findOne({}).lean();

  const date = new Date(targetDate.setHours(0, 0, 0, 0));

  const userToken = await UserToken.findOne({
    userId: _id,
    date,
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
      active: token || null,
      isEmergency: token?.isEmergency || false,
      doctorAvailability: settings.doctorAvailability,
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
  // get timezone
  // const zonalArea = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const targetDate = new Date();
  console.log('Targetted date with new Date() : ', targetDate);
  const date = new Date(targetDate.setHours(0, 0, 0, 0));
  console.log('Date after adding 5 hours created with new Date() : ', date);
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

  if (!clinic.tokenGenerationStatus)
    throw new ApiError(
      400,
      'Cannot generate new token since doctor is unavailable at this moment.'
    );

  // Convert provided date and today to start of the day (without time)
  const requestedDate = addHours(
    formatISO(
      addHours(new TZDate(date, 'Asia/Karachi'), 5).setHours(0, 0, 0, 0),
      {
        representation: 'complete',
      }
    ),
    5
  );
  console.log(
    'Requested date with TZDate to ISOString using formatISO: ',
    requestedDate
  );
  let today = TZDate.tz('Asia/Karachi').toISOString();
  console.log("Today's date with TZDate to ISOString : ", today);

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
  const clinicDate = parse(
    clinic.clinicOpeningTime,
    'hh:mm a',
    getCurrentAppTime()
  );

  console.log('Clinic date with parse : ', clinicDate);
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
    getCurrentAppTime()
  );
  console.log('Clinic closing time with parse : ', clinicClosingTime);
  const closingHours = getHours(clinicClosingTime);
  const closingMinutes = getMinutes(clinicClosingTime);

  const todayWithTimeClose = set(today, {
    hours: closingHours,
    minutes: closingMinutes,
    seconds: 0,
    milliseconds: 0,
  });

  const openingTime = new TZDate(todayWithTime, 'Asia/Karachi');
  console.log('Opening time with TZDate : ', openingTime);

  const closingTime = new TZDate(
    todayWithTimeClose,
    'Asia/Karachi'
  ).toISOString();
  console.log('Closing time with TZDate : ', closingTime);
  const tokenStartTime = addMinutes(openingTime, -15);

  // // Uncomment this when you are done with the coding

  // if (
  //   isBefore(today, tokenStartTime.toISOString()) ||
  //   isAfter(today, closingTime)
  // ) {
  //   throw new ApiError(400, 'Cannot generate token outside clinic hours.');
  // }

  console.log('Requested date with parseISO : ', parseISO(requestedDate));
  // Find the queue for today
  let queue = await Queue.findOne({
    date: requestedDate,
  }).populate('upcomingTokenIds');

  if (!queue) {
    queue = new Queue({
      date: requestedDate,
      activeTokenId: null,
      upcomingTokenIds: [],
    });
  }

  // Determine estimated turn time
  let estimatedTurnTime;
  if (queue.upcomingTokenIds.length > 0) {
    const lastTokenId = queue.upcomingTokenIds
      .filter((item) => item.isEmergency === false)
      .pop();

    if (lastTokenId) {
      const lastToken = await UserToken.findById(lastTokenId);

      estimatedTurnTime = addMinutes(
        lastToken.estimatedTurnTime,
        10
      ).toISOString();
    } else {
      const activeToken = await UserToken.findOne({
        isActive: true,
        isEmergency: true,
      }).lean();

      if (activeToken && activeToken.tokenNumber === 1) {
        estimatedTurnTime = activeToken.tokenActivationTime;
      } else {
        estimatedTurnTime = openingTime;
        const now = getCurrentAppTime();

        if (isAfter(now, openingTime)) {
          queue.waitTime = differenceInMinutes(now, openingTime);
        }
      }
    }
  } else {
    estimatedTurnTime = openingTime;
    const now = getCurrentAppTime();

    if (isAfter(now, openingTime)) {
      if (!queue || queue.upcomingTokenIds.length === 0) {
        queue.waitTime = differenceInMinutes(now, openingTime);
      }
    }
  }

  // Get last token number for the day
  const lastTokenOfDay = await UserToken.findOne({
    date: requestedDate,
  });
  const tokenNumber = lastTokenOfDay ? queue.upcomingTokenIds.length + 1 : 1;

  // Create new token
  const userToken = new UserToken({
    userId,
    tokenNumber,
    estimatedTurnTime,
    date: requestedDate,
    checkInOutStatus: 'pending',
    isActive: false,
    tokenGenerationTime: getCurrentAppTime(),
    estimatedEndTime: addMinutes(estimatedTurnTime, 10),
  });

  io.emit('tokenUpdate', {
    data: {
      offset: queue.offset,
      waitTime: queue.waitTime,
      exceptional: queue.exceptional,
    },
  });

  queue.upcomingTokenIds.push(userToken._id);

  res
    .status(201)
    .json(new ApiResponse(201, userToken, 'Token generated successfully'));
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

    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

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
        select: 'name email phoneNumber',
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
        phoneNumber: token.userId?.phoneNumber || 'No Phone',
        priority: token.isEmergency ? 'High' : 'Normal',
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
    console.log('getTodayPatients ki api ');
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    console.log('startOfToday : ', startOfToday);
    const endOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );
    console.log('endOfToday : ', endOfToday);

    const startTime = startOfToday;
    const endTime = endOfToday;

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
        select: 'name email phoneNumber',
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
        phoneNumber: token.userId?.phoneNumber || 'No Phone',
        estimatedTurnTime: token.estimatedTurnTime,
        tokenGenerationTime: token.tokenGenerationTime,
        date: token.date,
        status: token.checkInOutStatus,
        priority: token.isEmergency ? 'High' : 'Normal',
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
  console.log('generateEmergencyToken ki api ');
  const {date} = req.body;
  const userId = req.userId;
  const currentTime = getCurrentAppTime();
  console.log('currentTime : ', currentTime);

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

  // Convert provided date to application timezone
  const requestedDate = toAppTimezone(date);
  console.log('requestedDate : ', requestedDate);
  const today = getCurrentAppTime();
  console.log('today : ', today);

  // Check if user already has an active token for the selected date
  const existingToken = await UserToken.findOne({
    userId,
    date: getStartOfDay(requestedDate),
  });

  if (existingToken) {
    throw new ApiError(400, 'You already have an active token for today.');
  }

  // Convert clinic opening time to application timezone
  const clinicDate = parse(
    clinic.clinicOpeningTime,
    'hh:mm a',
    getCurrentAppTime()
  );
  console.log('clinicDate : ', clinicDate);
  const openingHours = getHours(clinicDate);
  const openingMinutes = getMinutes(clinicDate);

  const todayWithTime = set(today, {
    hours: openingHours,
    minutes: openingMinutes,
    seconds: 0,
    milliseconds: 0,
  });

  console.log('todayWithTime : ', todayWithTime);

  const clinicClosingTime = parse(
    clinic.clinicClosingTime,
    'hh:mm a',
    getCurrentAppTime()
  );

  console.log('clinicClosingTime : ', clinicClosingTime);

  const closingHours = getHours(clinicClosingTime);
  const closingMinutes = getMinutes(clinicClosingTime);

  const todayWithTimeClose = set(today, {
    hours: closingHours,
    minutes: closingMinutes,
    seconds: 0,
    milliseconds: 0,
  });

  const openingTime = toAppTimezone(todayWithTime);
  console.log('openingTime : ', openingTime);
  const closingTime = toAppTimezone(todayWithTimeClose);
  console.log('closingTime : ', closingTime);

  const tokenStartTime = addMinutes(openingTime, -15);
  console.log('tokenStartTime : ', tokenStartTime);

  // Find the queue for today
  let queue = await Queue.findOne({
    date: addHours(requestedDate, 5),
  }).populate('activeTokenId lastTokenId');

  // Determine estimated turn time
  let estimatedTurnTime;
  if (queue && queue.upcomingTokenIds.length > 0) {
    const lastTokenId =
      queue.upcomingTokenIds[queue.upcomingTokenIds.length - 1];
    const lastToken = await UserToken.findById(lastTokenId);

    console.log('lastToken : ', lastToken);

    estimatedTurnTime = addMinutes(
      lastToken.estimatedTurnTime,
      10
    ).toISOString();
  }

  // Get last token number for the day

  const lastTokenOfDay = await UserToken.findOne({
    date: addHours(requestedDate, 5),
  });
  const tokenNumber = lastTokenOfDay ? queue.upcomingTokenIds.length + 1 : 1;

  // Create new token
  let userToken;

  if (!queue || (!queue.activeTokenId && !queue.lastTokenId)) {
    userToken = new UserToken({
      userId,
      tokenNumber,
      estimatedTurnTime: addHours(requestedDate, 5),
      date: addHours(requestedDate, 5),
      checkInOutStatus: 'onsite',
      isActive: true,
      tokenGenerationTime: addHours(requestedDate, 5),
      estimatedEndTime: addMinutes(requestedDate, 10),
      isEmergency: true,
      tokenActivationTime: addHours(requestedDate, 5),
    });
    console.log('userToken : ', userToken);
    queue = new Queue({
      date: addHours(requestedDate, 5),
      activeTokenId: userToken._id,
      upcomingTokenIds: [],
    });
  } else {
    if (queue.activeTokenId) {
      userToken = new UserToken({
        userId,
        tokenNumber,
        estimatedTurnTime: addHours(requestedDate, 5),
        date: addHours(requestedDate, 5),
        checkInOutStatus: 'onsite',
        isActive: true,
        tokenGenerationTime: addHours(requestedDate, 5),
        estimatedEndTime: addMinutes(requestedDate, 10),
        isEmergency: true,
        tokenActivationTime: addHours(requestedDate, 5),
      });
      console.log('userToken : ', userToken);
      const currentlyActiveToken = await UserToken.findOne({
        _id: queue.activeTokenId,
      });
      currentlyActiveToken.isActive = false;
      currentlyActiveToken.tokenActivationTime = null;

      const diff = differenceInMinutes(
        currentTime,
        queue.activeTokenId.tokenActivationTime
      );
      queue.waitTime = queue.waitTime + diff;
      currentlyActiveToken.save();
    } else if (!queue.activeTokenId && queue.lastTokenId) {
      console.log('queue.lastTokenId');
      const diff = differenceInMinutes(
        currentTime,
        queue.lastTokenId.checkedOutTime
      );
      queue.waitTime = queue.waitTime + diff;
      userToken = new UserToken({
        userId,
        tokenNumber,
        estimatedTurnTime: estimatedTurnTime,
        date: addHours(requestedDate, 5),
        checkInOutStatus: 'onsite',
        isActive: true,
        tokenGenerationTime: addHours(requestedDate, 5),
        estimatedEndTime: addMinutes(estimatedTurnTime, 10),
        isEmergency: true,
        tokenActivationTime: addHours(requestedDate, 5),
      });
      console.log('userToken : ', userToken);
    }
  }
  queue.activeTokenId = userToken._id;
  queue.isEmergency = true;

  console.log('User Token : ', userToken);
  await userToken.save();
  queue.upcomingTokenIds.push(userToken._id);
  await queue.save();

  io.emit('tokenUpdate', {
    data: {
      offset: queue?.offset || 0,
      waitTime: queue?.waitTime || 0,
      exceptional: queue?.exceptional || [],
      active: userToken,
      isEmergency: userToken.isEmergency,
    },
  });

  res
    .status(201)
    .json(new ApiResponse(201, userToken, 'Token generated successfully'));
});

export const userTokenDetail = asyncHandler(async (req, res) => {
  const userId = req.params.tokenId;

  const token = await UserToken.findById(userId).populate('userId');

  res
    .status(201)
    .json(new ApiResponse(201, token, 'Token generated successfully'));
});
