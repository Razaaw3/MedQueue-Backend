import PrivacySettings from "../models/PrivacySettings.model.js";
import Clinic from "../models/clinic.model.js";
import Queue from "../models/queue.model.js";
import moment from "moment-timezone";

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

    const updateFields = {
      emergencyCases: emergencyCases || settings?.emergencyCases || "Allowed",
      updatedAt: moment().tz("Asia/Karachi").toDate(),
    };

    // Doctor went unavailable
    if (doctorAvailability === "Not Available") {
      updateFields.doctorAvailability = "Not Available";
      updateFields.unavailableSince = moment().tz("Asia/Karachi").toDate();
    }

    // Doctor came back online
    if (doctorAvailability === "Available") {
      if (settings?.unavailableSince) {
        const now = moment().tz("Asia/Karachi").toDate();
        const downtimeMinutes = Math.floor(
          (now - new Date(settings.unavailableSince)) / 60000
        );

        // update queue wait time
        const todayStart = moment().tz("Asia/Karachi").startOf("day").toDate();
        const todayEnd = moment().tz("Asia/Karachi").endOf("day").toDate();

        await Queue.updateOne(
          { date: { $gte: todayStart, $lte: todayEnd } },
          { $inc: { waitTime: downtimeMinutes } }
        );
      }

      updateFields.doctorAvailability = "Available";
      updateFields.unavailableSince = null;
    }

    if (!settings) {
      // Create new settings if they don't exist
      settings = await PrivacySettings.create({
        clinicId: clinic._id,
        ...updateFields,
      });
    } else {
      // Update existing settings
      settings = await PrivacySettings.findOneAndUpdate(
        { clinicId: clinic._id },
        { $set: updateFields },
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

// basic structure
// import PrivacySettings from "../models/PrivacySettings.model.js";
// import Clinic from "../models/clinic.model.js";

// // @@Get privacy settings
// export const getPrivacySettings = async (req, res) => {
//   try {
//     let clinic = await Clinic.findOne({});

//     if (!clinic) {
//       clinic = await Clinic.create({
//         name: "MedQueue Clinic",
//         clinicOpeningTime: "03:00 PM",
//         clinicClosingTime: "05:00 PM",
//         tokenLimit: 150,
//       });
//     }

//     let settings = await PrivacySettings.findOne({ clinicId: clinic._id });

//     if (!settings) {
//       settings = await PrivacySettings.create({
//         clinicId: clinic._id,
//         doctorAvailability: "Available",
//         emergencyCases: "Allowed",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: settings,
//     });
//   } catch (error) {
//     console.error("Error in getPrivacySettings:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching privacy settings",
//       error: error.message,
//     });
//   }
// };

// // @@ Update privacy settings
// export const updatePrivacySettings = async (req, res) => {
//   try {
//     let clinic = await Clinic.findOne({});

//     if (!clinic) {
//       clinic = await Clinic.create({
//         name: "Default Clinic",
//         clinicOpeningTime: "09:00 AM",
//         clinicClosingTime: "05:00 PM",
//         tokenLimit: 150,
//       });
//     }

//     const { doctorAvailability, emergencyCases } = req.body;

//     if (
//       doctorAvailability &&
//       !["Available", "Not Available"].includes(doctorAvailability)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid doctor availability status",
//       });
//     }

//     if (
//       emergencyCases &&
//       !["Allowed", "Not Allowed"].includes(emergencyCases)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid emergency cases status",
//       });
//     }

//     let settings = await PrivacySettings.findOne({ clinicId: clinic._id });

//     if (!settings) {
//       settings = await PrivacySettings.create({
//         clinicId: clinic._id,
//         doctorAvailability: doctorAvailability || "Available",
//         emergencyCases: emergencyCases || "Allowed",
//       });
//     } else {
//       settings = await PrivacySettings.findOneAndUpdate(
//         { clinicId: clinic._id },
//         {
//           $set: {
//             doctorAvailability:
//               doctorAvailability || settings.doctorAvailability,
//             emergencyCases: emergencyCases || settings.emergencyCases,
//             updatedAt: Date.now(),
//           },
//         },
//         { new: true }
//       );
//     }

//     res.status(200).json({
//       success: true,
//       data: settings,
//     });
//   } catch (error) {
//     console.error("Error in updatePrivacySettings:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error updating privacy settings",
//       error: error.message,
//     });
//   }
// };
