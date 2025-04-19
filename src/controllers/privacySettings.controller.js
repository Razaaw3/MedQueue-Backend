import PrivacySettings from "../models/PrivacySettings.model.js";
import Clinic from "../models/clinic.model.js";

// @@Get privacy settings
export const getPrivacySettings = async (req, res) => {
  try {
    let clinic = await Clinic.findOne({});

    if (!clinic) {
      clinic = await Clinic.create({
        name: "MedQueue Clinic",
        clinicOpeningTime: "03:00 PM",
        clinicClosingTime: "05:00 PM",
        tokenLimit: 150,
      });
    }

    let settings = await PrivacySettings.findOne({ clinicId: clinic._id });

    if (!settings) {
      settings = await PrivacySettings.create({
        clinicId: clinic._id,
        doctorAvailability: "Available",
        emergencyCases: "Allowed",
      });
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error in getPrivacySettings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching privacy settings",
      error: error.message,
    });
  }
};

// @@ Update privacy settings
export const updatePrivacySettings = async (req, res) => {
  try {
    let clinic = await Clinic.findOne({});

    if (!clinic) {
      clinic = await Clinic.create({
        name: "Default Clinic",
        clinicOpeningTime: "09:00 AM",
        clinicClosingTime: "05:00 PM",
        tokenLimit: 150,
      });
    }

    const { doctorAvailability, emergencyCases } = req.body;

    if (
      doctorAvailability &&
      !["Available", "Not Available"].includes(doctorAvailability)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor availability status",
      });
    }

    if (
      emergencyCases &&
      !["Allowed", "Not Allowed"].includes(emergencyCases)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid emergency cases status",
      });
    }

    let settings = await PrivacySettings.findOne({ clinicId: clinic._id });

    if (!settings) {
      settings = await PrivacySettings.create({
        clinicId: clinic._id,
        doctorAvailability: doctorAvailability || "Available",
        emergencyCases: emergencyCases || "Allowed",
      });
    } else {
      settings = await PrivacySettings.findOneAndUpdate(
        { clinicId: clinic._id },
        {
          $set: {
            doctorAvailability:
              doctorAvailability || settings.doctorAvailability,
            emergencyCases: emergencyCases || settings.emergencyCases,
            updatedAt: Date.now(),
          },
        },
        { new: true }
      );
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error in updatePrivacySettings:", error);
    res.status(500).json({
      success: false,
      message: "Error updating privacy settings",
      error: error.message,
    });
  }
};
