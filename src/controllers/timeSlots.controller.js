import moment from 'moment';
import TimeSlots from '../models/timeSlots.model.js';
import ApiError from '../utils/errors/ApiError.js';
import {ApiResponse} from '../utils/errors/ApiResponse.js';
import {asyncHandler} from '../utils/errors/asyncHandler.js';

export const getAvailableTimeSlots = asyncHandler(async (req, res) => {
  const {date} = req.query;

  if (!date) {
    throw new ApiError(400, 'Date is required');
  }

  const currentDate = new Date();
  const requestedDate = new Date(date);

  if (requestedDate < currentDate.setHours(0, 0, 0, 0)) {
    throw new ApiError(400, 'Requested date is in the past');
  }

  const timeSlots = await TimeSlots.findOne({date: requestedDate});

  if (!timeSlots) {
    throw new ApiError(404, 'No time slots found for this date');
  }
  console.log(timeSlots);

  // filter out past time slots on the requested date
  const availableSlots = timeSlots.timeSlots.filter((slot) => {
    const slotTime = moment(slot.startingTime, 'HH:mm').toDate();
    const currentTime = new Date();
    return !slot.isReserved && slotTime >= currentTime; // Should uncomment this when all is done. this is correct logic
    // return !slot.isReserved;
  });

  const response = {
    timeSlotsId: timeSlots._id,
    availableSlots,
  };

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        response,
        'Available time slots retrieved successfully'
      )
    );
});
