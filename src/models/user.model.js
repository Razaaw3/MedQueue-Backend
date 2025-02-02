import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'registeredUser'],
      default: 'registeredUser',
      required: true,
    },
    phoneNumber: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    profile: {
      type: String, // cloudinary url
      default:
        'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png',
    },
    dob: {
      type: String,
    },
    address: {
      type: String,
    },
  },

  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

export default User;
