import mongoose from "mongoose";

const timeSlotSchema = new mongoose.Schema({
  startingTime: {
    type: String,
    required: true,
  },
  endingTime: {
    type: String,
    required: true,
  },
  isReserved: {
    type: Boolean,
    default: false,
  },
  slotNumber: {
    type: Number,
    required: true,
  },
});

const timeSlotsSchema = new mongoose.Schema(
  {
    timeSlots: [timeSlotSchema],
    date: {
      type: Date,
      required: true,
    },
    clinicOpeningTime: {
      type: String,
      required: true,
    },
    clinicClosingTime: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// method to find available slots
timeSlotsSchema.methods.getAvailableSlots = function () {
  return this.timeSlots.filter((slot) => !slot.isReserved);
};

const TimeSlots = mongoose.model("TimeSlots", timeSlotsSchema);
export default TimeSlots;
