import Queue from '../models/queue.model.js';
// import TimeSlots from '../models/timeSlots.model.js';
import UserToken from '../models/userToken.model.js';
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
} from 'date-fns';

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
    new TZDate(date, 'Asia/Karachi').setHours(0, 0, 0, 0),
    {representation: 'complete'}
  );
  let today = TZDate.tz('Asia/Karachi').toISOString();

  // //Uncomment the below feature if you are done with the development

  if (
    !isSameDay(requestedDate, today, {
      in: tz('Asia/Karachi'),
    })
  ) {
    throw new ApiError(400, 'Cannot generate tokens for past or future dates.');
  }

  // Check if user already has an active token for the selected date
  const existingToken = await UserToken.findOne({
    userId,
    date: requestedDate,
  });

  if (existingToken) {
    throw new ApiError(400, 'You already have an active token for today.');
  }

  // Convert clinic opening and closing times to today’s full DateTime
  const clinicOpenStoredTime = parse(
    clinic.clinicOpeningTime,
    'hh:mm a',
    today
  );
  const todayWithTime = set(today, {
    hours: clinicOpenStoredTime.getHours(),
    minutes: clinicOpenStoredTime.getMinutes(),
    seconds: 0,
    milliseconds: 0,
  });
  const clinicCloseStoredTime = parse(
    clinic.clinicClosingTime,
    'hh:mm a',
    today
  );
  const todayWithTimeClose = set(today, {
    hours: clinicCloseStoredTime.getHours(),
    minutes: clinicCloseStoredTime.getMinutes(),
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
  let queue = await Queue.findOne({date: requestedDate});
  let isActive = false;

  if (!queue) {
    isActive = true;
    queue = new Queue({
      date: requestedDate,
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
    console.log('if', lastTokenId);

    estimatedTurnTime = addMinutes(
      lastToken.estimatedTurnTime,
      10
    ).toISOString();
  } else {
    estimatedTurnTime = openingTime.toISOString();
    estimatedTurnTime = addHours(parseISO(estimatedTurnTime), 5);
  }

  // Get last token number for the day
  const lastTokenOfDay = await UserToken.findOne({
    date: addHours(parseISO(requestedDate), 5),
  });
  const tokenNumber = lastTokenOfDay ? queue.upcomingTokenIds.length + 1 : 1;

  // Create new token
  const userToken = new UserToken({
    userId,
    tokenNumber,
    estimatedTurnTime: estimatedTurnTime,
    date: addHours(parseISO(requestedDate), 5),
    checkInOutStatus: 'pending',
    isActive: isActive,
    tokenGenerationTime: addHours(parseISO(today), 5),
    estimatedEndTime: addMinutes(estimatedTurnTime, 10),
  });

  await userToken.save();

  // Mark as active token if it's the first one
  if (isActive) {
    queue.activeTokenId = userToken._id;
    socket.emit('activeToken', {data: userToken});
  }

  queue.upcomingTokenIds.push(userToken._id);
  await queue.save();

  res
    .status(201)
    .json(new ApiResponse(201, userToken, 'Token generated successfully'));
});

export const cancelToken = asyncHandler(async (req, res) => {
  // const {tokenId} = req.params;
  // const {role, _id: userId} = req.user;
  // const token = await UserToken.findOne({
  //   _id: tokenId,
  //   isActive: true,
  // });
  // if (!token) throw new ApiError(404, 'Active token not found');
  // if (role !== 'admin' && token.userId.toString() !== userId.toString()) {
  //   throw new ApiError(403, "You don't have permission to cancel this token");
  // }
  // if (token.checkInOutStatus !== 'pending') {
  //   throw new ApiError(400, 'Cannot cancel token after check-in');
  // }
  // // remove token from queue
  // const queue = await Queue.findOne({
  //   $or: [{activeTokenId: tokenId}, {upcomingTokenIds: tokenId}],
  // });
  // if (queue) {
  //   queue.upcomingTokenIds = queue.upcomingTokenIds.filter(
  //     (id) => id.toString() !== tokenId.toString()
  //   );
  //   if (queue.activeTokenId?.toString() === tokenId.toString()) {
  //     queue.activeTokenId = null;
  //   }
  //   await queue.save();
  // }
  // // free up the time slot
  // const timeSlotDoc = await TimeSlots.findById(token.timeSlotId);
  // if (timeSlotDoc) {
  //   const timeSlot = timeSlotDoc.timeSlots.find(
  //     (ts) => ts.slotNumber === token.slotNumber
  //   );
  //   if (timeSlot) {
  //     timeSlot.isReserved = false;
  //     await timeSlotDoc.save();
  //   }
  // }
  // // update token status
  // token.isActive = false;
  // token.checkInOutStatus = 'cancelled';
  // token.cancellationDetails = {
  //   cancelledBy: role,
  //   cancelledById: userId,
  //   cancelledAt: new Date(),
  // };
  // await token.save();
  // // add information about who cancelled the token in the response
  // const message =
  //   role === 'admin' ? 'Token cancelled by admin' : 'Token cancelled by user';
  // res.json(new ApiResponse(200, {token}, message));
});

// Get today's Token
export const getQueueStatus = asyncHandler(async (req, res) => {
  const targetDate = new Date();

  const startOfDay = addHours(new Date(targetDate.setHours(0, 0, 0, 0)), 5);
  const endOfDay = addHours(new Date(targetDate.setHours(23, 59, 59, 999)), 5);

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
      const isValid = currentTime <= addMinutes(token.estimatedTurnTime, 10);
      token.checkInOutStatus = checkInOutStatus;
      let waitTime = 0;
      if (queue.lastTokenId) {
        if (!queue.activeTokenId) {
          waitTime = differenceInMinutes(
            currentTime,
            queue.lastTokenId.checkedOutTime
          );
          waitTime = waitTime + queue.offset;

          token.isActive = true;
        } else {
          if (!isValid)
            queue.exceptional = [
              ...(queue.exceptional || []),
              token.tokenNumber,
            ];
        }
      } else {
        if (queue.activeTokenId) {
          if (!isValid)
            queue.exceptional = [
              ...(queue.exceptional || []),
              token.tokenNumber,
            ];
        } else {
          const doc = await DoctorDetail.find({}).lean();
          if (doc.available) {
            const clinic = await Clinic.find({}).lean();
            const parsedDate = parse(
              clinic.clinicOpeningTime,
              'hh:mm a',
              new Date()
            );

            token.isActive = true;
            const offset = differenceInMinutes(
              differenceInMinutes(currentTime, addHours(parsedDate, 5)),
              10
            );
            io.emit('tokenUpdate', {
              data: {
                offset: offset + queue.offset,
                waitTime: queue.waitTime,
                exceptional: queue.exceptional,
              },
              message: 'Est. turn time updated successfully',
              success: true,
            });
          }
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

      if (firstTrueIndex !== -1) {
        const nextToken = queue.upcomingTokenIds[firstTrueIndex];
        const offset = differenceInMinutes(
          differenceInMinutes(currentTime, token.tokenActivationTime),
          10
        );

        queue.activeTokenId = nextToken._id;
        nextToken.tokenActivationTime = currentTime;
        io.emit('tokenUpdate', {
          data: {
            offset: offset + queue.offset,
            waitTime: queue.waitTime,
            exceptional: queue.exceptional,
          },
          message: 'Est. turn time updated successfully',
          success: true,
        });
        await nextToken.save();
      } else {
        queue.activeTokenId = null;
      }

      queue.lastTokenId = token._id;
      break;
    default:
      throw new ApiError(400, 'Bad status for token');
  }
  await queue.save();
  await token.save();

  res.json(new ApiResponse(200, token, 'Token status updated successfully'));
});

// export const updateTokenStatus = asyncHandler(async (req, res) => {
// const {tokenId} = req.params;
// const {checkInOutStatus} = req.body;

// const token = await UserToken.findById(tokenId);
// if (!token) throw new ApiError(404, 'Token not found');

// const doctorsQueue = await Queue.findOne({
//   upcomingTokenIds: {$in: [tokenId]},
// }).populate('upcomingTokenIds lastTokenId');
// if (!doctorsQueue) throw new ApiError(404, 'Queue not found');

//   let queue = doctorsQueue;

//   switch (checkInOutStatus) {
//     case 'onsite':
//       token.checkInOutStatus = checkInOutStatus;

//       //exceptional case handling remaining

//       if (!queue.activeTokenId) {
//         token.isActive = true;
//         const currentTime = addHours(new Date(), 5);
//         const waitTime = differenceInMinutes(
//           currentTime,
//           queue.lastTokenId.checkedOutTime
//         );
//         if (queue.lastTokenId.tokenNumber + 1 === token.tokenNumber) {
//           queue.waitTime = queue.waitTime + waitTime;

//           io.emit('tokenUpdate', {
//             data: {
//               offset: queue.offset,
//               case: 4,
//             },
//             message: 'Est. turn time updated successfully',
//             success: true,
//           });
//         } else {
//           const recentToken = queue.upcomingTokenIds.find((token) => {
//             const estimatedTime = token.estimatedTurnTime;

//             // Check if currentTime lies within the estimatedTime and estimatedTime +10 min
//             const isValid = isWithinInterval(currentTime, {
//               start: estimatedTime,
//               end: addMinutes(estimatedTime, 10),
//             });

//             if (isValid) {
//               const offset = differenceInMinutes(currentTime, estimatedTime);
//               return {token, offset};
//             }

//             return false;
//           });

//           const offset = recentToken.offset || {};

//           const exceptional = queue.upcomingTokenIds
//             .filter(
//               (token) =>
//                 token.estimatedTurnTime < currentTime &&
//                 token.checkInOutStatus === 'pending'
//             )
//             .map((token) => token.tokenNumber);

//           queue.offset = offset;
//           queue.exceptional = exceptional;

//           io.emit('tokenUpdate', {
//             data: {
//               offset: queue.offset,
//               case: 5,
//               exceptional: exceptional,
//             },
//             message: 'Est. turn time updated successfully',
//             success: true,
//           });
//         }
//       }
//       break;

//     case 'completed':
// if (token.checkInOutStatus !== 'onsite') {
//   throw new ApiError(400, 'Token must be onsite before completion');
// }
// token.isActive = false;
// token.checkInOutStatus = checkInOutStatus;
// token.checkedOutTime = addHours(new Date(), 5);

//       if (!queue.exceptional.includes(token.tokenNumber)) {
//         const activeItem = queue.upcomingTokenIds.find(
//           (item) =>
//             item.isActive === false && item.checkInOutStatus === 'onsite'
//         );
//         const hasItemsBehind = activeItem
//           ? queue.upcomingTokenIds.some(
//               (item) =>
//                 item.tokenNumber < activeItem.tokenNumber &&
//                 item.isActive === false &&
//                 !queue.exceptional.includes(item.tokenNumber)
//             )
//           : false;

//         if (!activeItem) {
//           queue.waitTime = queue.offset;
//           queue.activeTokenId = null;
//           queue.lastTokenId = token._id;

//           io.emit('tokenUpdate', {
//             data: {
//               offset: queue.offset,
//               case: 3,
//             },
//             message: 'Est. turn time updated successfully',
//             success: true,
//           });
//         } else if (!hasItemsBehind) {
// const firstTrueIndex = queue.upcomingTokenIds.findIndex(
//   (item) => item.checkInOutStatus === 'onsite'
// );

// const nextToken = queue.upcomingTokenIds[firstTrueIndex + 1];
// const currentTime = addHours(new Date(), 5);
// const offset = differenceInMinutes(
//   currentTime,
//   nextToken.estimatedTurnTime
// );
// io.emit('tokenUpdate', {
//   data: {offset: offset, case: 1, waitTime: queue.waitTime},
//   message: 'Est. turn time updated successfully',
//   success: true,
// });
//         } else {
//           const duration = differenceInMinutes(
//             token.checkedOutTime,
//             token.tokenActivationTime
//           );
//           const newCalculatedOffset = duration - 10; // 10 represents avg time per patient

//           // Increase offset for existing tokens in queue.pendingTokens
//           const updatedPendingTokens = queue.pendingTokens.map((token) => ({
//             tokenNumber: token.tokenNumber,
//             tokenOffset: token.tokenOffset + 10, // Increase existing offset by 10
//           }));

//           // Add new tokens from upcomingTokenIds
//           const newPendingTokens = queue.upcomingTokenIds
//             .filter(
//               (item) =>
//                 item.tokenNumber < activeItem.tokenNumber &&
//                 item.isActive === false &&
//                 !queue.exceptional.includes(item.tokenNumber)
//             )
//             .map((item) => ({
//               tokenNumber: item.tokenNumber,
//               tokenOffset: 10, // Newly added tokens get offset 10
//             }));

//           // Merge both lists
//           const pendingTokenNumbers = [
//             ...updatedPendingTokens,
//             ...newPendingTokens,
//           ];

//           io.emit('tokenUpdate', {
//             data: {
//               offset: queue.offset + newCalculatedOffset,
//               case: 2,
//               tokens: pendingTokenNumbers,
//               waitTime: queue.waitTime,
//             },
//             message: 'Est. turn time updated successfully',
//             success: true,
//           });
//         }
//       } else {
//         queue.exceptional = queue.exceptional.filter(
//           (item) => item.tokenNumber !== token.tokenNumber
//         );
//       }
//       break;
//   }

//   // await token.save();
//   // await queue.save();

//   // await token.populate('userId', 'name email');

//   io.emit('TokenUpdated', {
//     data: token,
//     message: 'Token status updated successfully',
//     success: true,
//   });

//   res.json(new ApiResponse(200, token, 'Token status updated successfully'));
// });

// Get token history

export const getTokenHistory = asyncHandler(async (req, res) => {
  // const tokens = await UserToken.find({userId: req.user._id})
  //   .populate('timeSlot', 'date clinicOpeningTime clinicClosingTime')
  //   .sort({tokenGenerationTime: -1});
  // res.json(new ApiResponse(200, tokens, 'Token history fetched successfully'));
});

// Get all tokens for a specific date
export const getTokensByDate = asyncHandler(async (req, res) => {
  // const {date} = req.query;
  // if (!date) throw new ApiError(400, 'Date query parameter is required');
  // const startDate = new Date(date);
  // startDate.setHours(0, 0, 0, 0);
  // const endDate = new Date(date);
  // endDate.setHours(23, 59, 59, 999);
  // const tokens = await UserToken.find({
  //   date: {$gte: startDate, $lte: endDate},
  // })
  //   .populate('userId', 'name email')
  //   .populate('timeSlotId', 'date clinicOpeningTime clinicClosingTime')
  //   .sort({tokenGenerationTime: 1});
  // res.json(
  //   new ApiResponse(
  //     200,
  //     tokens,
  //     'Tokens fetched successfully for the given date'
  //   )
  // );
});

export const getActiveToken = asyncHandler(async (req, res) => {
  const socket = req.io;
  const {date} = req.body;

  const targetDate = new Date(date);

  if (!date) throw new ApiError(400, 'Date query parameter is required');

  const startOfDay = addHours(new Date(targetDate.setHours(0, 0, 0, 0)), 5);
  const endOfDay = addHours(new Date(targetDate.setHours(23, 59, 59, 999)), 5);

  const tokens = await UserToken.findOne({
    date: {$gte: startOfDay, $lt: endOfDay},
    isActive: true,
  });

  socket.emit('activeToken', {data: tokens});

  res.json(
    new ApiResponse(200, [], 'Tokens fetched successfully for the given date')
  );
});
