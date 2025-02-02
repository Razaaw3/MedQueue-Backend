import mongoose from "mongoose";

const queueSchema = new mongoose.Schema(
  {
    activeTokenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserToken",
      default: null,
    },
    date:{
      type : Date,
      required : true
    },
    upcomingTokenIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserToken",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// to ensure only one active queue
queueSchema.pre("save", async function (next) {
  if (this.isNew) {
    await Queue.deleteMany({}); // remove any existing queues
  }
  next();
});

const Queue = mongoose.model("Queue", queueSchema);
export default Queue;
