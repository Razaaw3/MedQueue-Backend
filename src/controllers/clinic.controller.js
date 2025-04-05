import Clinic from "../models/clinic.model.js";
import ApiError from "../utils/errors/ApiError.js";
import { ApiResponse } from "../utils/errors/ApiResponse.js";
import { asyncHandler } from "../utils/errors/asyncHandler.js";

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

  let clinic = await Clinic.findOne();

  if (!clinic) {
    clinic = await Clinic.create({
      name: "MedQueue₂",
      clinicOpeningTime,
      clinicClosingTime,
      tokenLimit,
    });
  } else {
    clinic.clinicOpeningTime = clinicOpeningTime;
    clinic.clinicClosingTime = clinicClosingTime;
    clinic.tokenLimit = tokenLimit;
    await clinic.save();
  }

  res
    .status(200)
    .json(new ApiResponse(200, clinic, "Clinic settings updated successfully"));
});
