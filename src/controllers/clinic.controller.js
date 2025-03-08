import Clinic from '../models/clinic.model.js';
import ApiError from '../utils/errors/ApiError.js';
import {ApiResponse} from '../utils/errors/ApiResponse.js';
import {asyncHandler} from '../utils/errors/asyncHandler.js';

// @desc    Create a new clinic (only if one does not exist)
// @route   POST /api/clinic
// @access  Private (Admin)
export const createClinic = asyncHandler(async (req, res) => {
  const {name, clinicOpeningTime, clinicClosingTime} = req.body;

  if (!name || !clinicOpeningTime || !clinicClosingTime) {
    throw new ApiError(400, 'All fields are required');
  }

  const existingClinic = await Clinic.findOne();

  if (existingClinic) {
    throw new ApiError(400, 'A clinic already exists. Use update instead.');
  }

  const clinic = await Clinic.create({
    name,
    clinicOpeningTime,
    clinicClosingTime,
  });

  res
    .status(201)
    .json(new ApiResponse(201, clinic, 'Clinic created successfully'));
});

// @desc    Update existing clinic
// @route   PUT /api/clinic/:clinicId
// @access  Private (Admin)
export const updateClinic = asyncHandler(async (req, res) => {
  const {name, clinicOpeningTime, clinicClosingTime} = req.body;

  if (!name || !clinicOpeningTime || !clinicClosingTime) {
    throw new ApiError(400, 'All fields are required');
  }

  const clinic = await Clinic.findOne();

  if (!clinic) {
    throw new ApiError(404, 'Clinic not found');
  }

  clinic.name = name;
  clinic.clinicOpeningTime = clinicOpeningTime;
  clinic.clinicClosingTime = clinicClosingTime;

  await clinic.save();

  res
    .status(200)
    .json(new ApiResponse(200, clinic, 'Clinic updated successfully'));
});

// @desc    Get clinic details (Singleton)
// @route   GET /api/clinic
// @access  Public
export const getClinic = asyncHandler(async (req, res) => {
  const clinic = await Clinic.findOne();
  console.log(clinic);

  if (!clinic) {
    throw new ApiError(404, 'Clinic not found');
  }

  res
    .status(200)
    .json(new ApiResponse(200, clinic, 'Clinic retrieved successfully'));
});

// @desc    Delete clinic (Not recommended, but included for completeness)
// @route   DELETE /api/clinic
// @access  Private (Admin)
export const deleteClinic = asyncHandler(async (req, res) => {
  const clinic = await Clinic.findOne();

  if (!clinic) {
    throw new ApiError(404, 'Clinic not found');
  }

  await clinic.deleteOne();

  res
    .status(200)
    .json(new ApiResponse(200, null, 'Clinic deleted successfully'));
});
