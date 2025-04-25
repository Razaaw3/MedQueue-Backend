import moment from "moment-timezone";
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
    estimatedEndTime: {
      type: Date,
    },
    tokenActivationTime: {
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
    isExpired: {
      type: Boolean,
      default: false,
    },
    isWalkIn: {
      type: Boolean,
      default: false,
    },
    cancellationDetails: {
      cancelledBy: {
        type: String,
        enum: ["user", "admin"],
      },
      cancelledById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      cancelledAt: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// userTokenSchema.pre('find', function () {
//   const currentTime = new Date();
//   currentTime.setMinutes(
//     currentTime.getMinutes() - currentTime.getTimezoneOffset()
//   );
//   this.updateMany(
//     {
//       estimatedTurnTime: {$lt: currentTime},
//       checkInOutStatus: 'pending',
//       isExpired: false,
//     },
//     {$set: {isExpired: true}}
//   );
// });

const UserToken = mongoose.model("UserToken", userTokenSchema);
export default UserToken;
