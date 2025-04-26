import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import ApiError from '../utils/errors/ApiError.js';

export const checkOrCreateUser = async (req, res, next) => {
  try {
    const {name, phoneNumber} = req.body;

    if (!phoneNumber) {
      throw new ApiError(400, 'Phone number is required');
    }

    let user = await User.findOne({phoneNumber});

    if (!user) {
      if (!name) {
        throw new ApiError(400, 'Name is required for new users');
      }

      const hashedPassword = await bcrypt.hash('Test123!', 12);

      user = new User({
        name,
        phoneNumber,
        password: hashedPassword,
        role: 'registered_user',
        isVerified: true,
      });

      await user.save();
    }

    req.userId = user._id;
    next();
  } catch (error) {
    next(error);
  }
};
