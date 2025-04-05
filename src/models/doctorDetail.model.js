import mongoose from 'mongoose';

const DoctorDetailSchema = new mongoose.Schema(
  {
    docId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    available: {
      type: Boolean,
      default: false,
    },
    availabiltyTime: {
      type: Date,
    },
  },

  {
    timestamps: true,
  }
);

const DoctorDetail = mongoose.model('DoctorDetail', DoctorDetailSchema);

export default DoctorDetail;
