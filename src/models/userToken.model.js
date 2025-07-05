import mongoose from "mongoose";
import { toUTC, fromUTC } from "../utils/timezoneUtils.js";

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
    isEmergency: {
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

// Convert dates to UTC before saving
userTokenSchema.pre("save", function (next) {
  if (this.isModified("tokenGenerationTime")) {
    this.tokenGenerationTime = toUTC(this.tokenGenerationTime);
  }
  if (this.isModified("estimatedTurnTime")) {
    this.estimatedTurnTime = toUTC(this.estimatedTurnTime);
  }
  if (this.isModified("estimatedEndTime")) {
    this.estimatedEndTime = toUTC(this.estimatedEndTime);
  }
  if (this.isModified("tokenActivationTime")) {
    this.tokenActivationTime = toUTC(this.tokenActivationTime);
  }
  if (this.isModified("date")) {
    this.date = toUTC(this.date);
  }
  if (this.isModified("checkedOutTime")) {
    this.checkedOutTime = toUTC(this.checkedOutTime);
  }
  if (this.isModified("cancellationDetails.cancelledAt")) {
    this.cancellationDetails.cancelledAt = toUTC(
      this.cancellationDetails.cancelledAt
    );
  }
  next();
});

// Convert dates from UTC when retrieving
userTokenSchema.post("find", function (docs) {
  docs.forEach((doc) => {
    if (doc.tokenGenerationTime)
      doc.tokenGenerationTime = fromUTC(doc.tokenGenerationTime);
    if (doc.estimatedTurnTime)
      doc.estimatedTurnTime = fromUTC(doc.estimatedTurnTime);
    if (doc.estimatedEndTime)
      doc.estimatedEndTime = fromUTC(doc.estimatedEndTime);
    if (doc.tokenActivationTime)
      doc.tokenActivationTime = fromUTC(doc.tokenActivationTime);
    if (doc.date) doc.date = fromUTC(doc.date);
    if (doc.checkedOutTime) doc.checkedOutTime = fromUTC(doc.checkedOutTime);
    if (doc.cancellationDetails?.cancelledAt) {
      doc.cancellationDetails.cancelledAt = fromUTC(
        doc.cancellationDetails.cancelledAt
      );
    }
  });
});

userTokenSchema.post("findOne", function (doc) {
  if (!doc) return;
  if (doc.tokenGenerationTime)
    doc.tokenGenerationTime = fromUTC(doc.tokenGenerationTime);
  if (doc.estimatedTurnTime)
    doc.estimatedTurnTime = fromUTC(doc.estimatedTurnTime);
  if (doc.estimatedEndTime)
    doc.estimatedEndTime = fromUTC(doc.estimatedEndTime);
  if (doc.tokenActivationTime)
    doc.tokenActivationTime = fromUTC(doc.tokenActivationTime);
  if (doc.date) doc.date = fromUTC(doc.date);
  if (doc.checkedOutTime) doc.checkedOutTime = fromUTC(doc.checkedOutTime);
  if (doc.cancellationDetails?.cancelledAt) {
    doc.cancellationDetails.cancelledAt = fromUTC(
      doc.cancellationDetails.cancelledAt
    );
  }
});

const UserToken = mongoose.model("UserToken", userTokenSchema);
export default UserToken;
