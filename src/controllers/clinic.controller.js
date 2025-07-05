import Clinic from "../models/clinic.model.js";
import ApiError from "../utils/errors/ApiError.js";
import { ApiResponse } from "../utils/errors/ApiResponse.js";
import { asyncHandler } from "../utils/errors/asyncHandler.js";
import { DateTime } from "luxon";

// @desc    Create a new clinic (only if one does not exist)
// @route   POST /api/clinic
// @access  Private (Admin)
export const createClinic = asyncHandler(async (req, res) => {
  const { clinicOpeningTime, clinicClosingTime, tokenLimit } = req.body;

  if (!clinicOpeningTime || !clinicClosingTime || !tokenLimit) {
    throw new ApiError(400, "All fields are required");
  }

  // Validate time format (HH:MM)
  const timeFormat = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (
    !timeFormat.test(clinicOpeningTime) ||
    !timeFormat.test(clinicClosingTime)
  ) {
    throw new ApiError(400, "Invalid time format. Use HH:MM format (24-hour)");
  }

  if (tokenLimit < 1 || tokenLimit > 1000) {
    throw new ApiError(400, "Token limit must be between 1 and 1000");
  }

  const existingClinic = await Clinic.findOne();

  if (existingClinic) {
    throw new ApiError(400, "A clinic already exists. Use update instead.");
  }

  const clinic = await Clinic.create({
    name: "MedQueue₂",
    clinicOpeningTime,
    clinicClosingTime,
    tokenLimit,
  });

  res
    .status(201)
    .json(new ApiResponse(201, clinic, "Clinic created successfully"));
});

// @desc    Get clinic details (Singleton)
// @route   GET /api/clinic/settings
// @access  Private (Admin)
export const getClinic = asyncHandler(async (req, res) => {
  const clinic = await Clinic.findOne();

  if (!clinic) {
    throw new ApiError(
      404,
      "Clinic settings not found. Please create settings first."
    );
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, clinic, "Clinic settings retrieved successfully")
    );
});

// @desc    Delete clinic
// @route   DELETE /api/clinic
// @access  Private (Admin)
export const deleteClinic = asyncHandler(async (req, res) => {
  const clinic = await Clinic.findOne();

  if (!clinic) {
    throw new ApiError(404, "Clinic not found");
  }

  await clinic.deleteOne();

  res
    .status(200)
    .json(new ApiResponse(200, null, "Clinic deleted successfully"));
});

// @desc    Update clinic settings
// @route   PUT /api/clinic/settings
// @access  Private (Admin)
export const updateClinicSettings = asyncHandler(async (req, res) => {
  const { clinicOpeningTime, clinicClosingTime, tokenLimit } = req.body;

  if (!clinicOpeningTime || !clinicClosingTime || !tokenLimit) {
    throw new ApiError(400, "All fields are required");
  }

  // Accept both 24-hour (HH:MM) and 12-hour (hh:mm AM/PM) formats
  const timeFormat24 = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  const timeFormat12 = /^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i;

  const isValid24HourFormat =
    timeFormat24.test(clinicOpeningTime) &&
    timeFormat24.test(clinicClosingTime);
  const isValid12HourFormat =
    timeFormat12.test(clinicOpeningTime) &&
    timeFormat12.test(clinicClosingTime);

  if (!isValid24HourFormat && !isValid12HourFormat) {
    throw new ApiError(
      400,
      "Invalid time format. Use either HH:MM (24-hour) or hh:mm AM/PM (12-hour) format"
    );
  }

  if (tokenLimit < 1 || tokenLimit > 1000) {
    throw new ApiError(400, "Token limit must be between 1 and 1000");
  }

  // Convert times to AM/PM format if they're in 24-hour format
  const formattedOpeningTime = isValid24HourFormat
    ? DateTime.fromFormat(clinicOpeningTime, "HH:mm").toFormat("hh:mm a")
    : clinicOpeningTime.toUpperCase();
  const formattedClosingTime = isValid24HourFormat
    ? DateTime.fromFormat(clinicClosingTime, "HH:mm").toFormat("hh:mm a")
    : clinicClosingTime.toUpperCase();

  let clinic = await Clinic.findOne();

  if (!clinic) {
    clinic = await Clinic.create({
      name: "MedQueue₂",
      clinicOpeningTime: formattedOpeningTime,
      clinicClosingTime: formattedClosingTime,
      tokenLimit,
    });
  } else {
    clinic.clinicOpeningTime = formattedOpeningTime;
    clinic.clinicClosingTime = formattedClosingTime;
    clinic.tokenLimit = tokenLimit;
    await clinic.save();
  }

  res
    .status(200)
    .json(new ApiResponse(200, clinic, "Clinic settings updated successfully"));
});
