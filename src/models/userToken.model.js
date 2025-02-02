import mongoose from "mongoose";

const userTokenSchema = new mongoose.Schema(
  {
    tokenNumber: {
      type: Number,
      default: 0,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenGenerationTime: {
      type: Date,
      default: Date.now,
      required: true,
    },
    timeSlotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TimeSlots",
      required: true,
    },
    slotNumber: {
      type: Number,
      required: true,
    },
    checkInOutStatus: {
      type: String,
      enum: ["pending", "onsite", "completed", "cancelled"],
      default: "pending",
    },
    estimatedTurnTime: {
      type: Date,
    },
    date: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    checkedOutTime: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const UserToken = mongoose.model("UserToken", userTokenSchema);
export default UserToken;
