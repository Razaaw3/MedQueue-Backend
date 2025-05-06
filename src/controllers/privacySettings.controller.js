import PrivacySettings from "../models/PrivacySettings.model.js";
import Clinic from "../models/clinic.model.js";
import Queue from "../models/queue.model.js";
import moment from "moment-timezone";
import { asyncHandler } from "../utils/errors/asyncHandler.js";
import ApiError from "../utils/errors/ApiError.js";
import { addHours, differenceInMinutes } from "date-fns";
import { ApiResponse } from "../utils/errors/ApiResponse.js";

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await PrivacySettings.findOne({});
  const clinic = await Clinic.findOne({});

  if (!settings || !clinic) {
    throw new ApiError(404, "Settings not found");
  }

  const response = {
    doctorAvailability: settings.doctorAvailability,
    tokenGenerationStatus: clinic.tokenGenerationStatus,
  };

  res
    .status(200)
    .json(new ApiResponse(200, response, "Settings retrieved successfully"));
});

export const updatePrivacySettings = asyncHandler(async (req, res) => {
  const settings = await PrivacySettings.findOne({});
  const { doctorAvailability } = req.body;

  if (
    !doctorAvailability ||
    !["Available", "Not Available"].includes(doctorAvailability)
  ) {
    throw new ApiError(
      400,
      "DoctorAvailability value must be either 'Available' or 'Not Available'"
    );
  }

  settings.doctorAvailability = doctorAvailability;
  await settings.save();

  res
    .status(200)
    .json(
      new ApiResponse(200, settings, "Settings updated successfully by admin")
    );
});

export const updateTokenGenerationStatus = asyncHandler(async (req, res) => {
  let clinic = await Clinic.findOne({});
  const { status } = req.body;

  console.log(status);

  if (typeof status !== "boolean") {
    throw new ApiError(400, "Status must be a boolean value");
  }

  if (!clinic) {
    // Create a default clinic if none exists
    clinic = await Clinic.create({
      name: "MedQueue₂",
      clinicOpeningTime: "09:00 AM",
      clinicClosingTime: "05:00 PM",
      tokenLimit: 150,
      tokenGenerationStatus: status,
    });
  } else {
    clinic.tokenGenerationStatus = status;
    await clinic.save();
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { tokenGenerationStatus: clinic.tokenGenerationStatus },
        "Token Generation status updated successfully by admin"
      )
    );
});
