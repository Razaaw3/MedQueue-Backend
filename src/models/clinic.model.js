import mongoose from "mongoose";

const clinicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    clinicOpeningTime: {
      type: String, // Store time as "06:00 AM"
      required: true,
      match: /^([0-9]{1,2}):([0-9]{2})\s?(AM|PM)?$/, // Ensures proper time format
    },
    clinicClosingTime: {
      type: String, // Store time as "06:00 PM"
      required: true,
      match: /^([0-9]{1,2}):([0-9]{2})\s?(AM|PM)?$/,
    },
    tokenLimit: {
      type: Number,
      required: true,
      min: 1,
      max: 1000,
      default: 150,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one clinic settings document exists
clinicSchema.index({}, { unique: true });

const Clinic = mongoose.model("Clinic", clinicSchema);
export default Clinic;
