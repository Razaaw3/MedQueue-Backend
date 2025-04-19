import mongoose from "mongoose";

const privacySettingsSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },
    doctorAvailability: {
      type: String,
      enum: ["Available", "Not Available"],
      default: "Available",
    },
    emergencyCases: {
      type: String,
      enum: ["Allowed", "Not Allowed"],
      default: "Allowed",
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

privacySettingsSchema.index({ clinicId: 1 }, { unique: true });

const PrivacySettings = mongoose.model(
  "PrivacySettings",
  privacySettingsSchema
);
export default PrivacySettings;
