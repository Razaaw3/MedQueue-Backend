const Token = require('../models/Token');

const generateToken = async (userId, date) => {
  try {
    // Get the count of tokens for the given date
    const tokenCount = await Token.countDocuments({
      date: new Date(date),
    });

    // Generate token number (1-based index)
    const tokenNumber = tokenCount + 1;

    // Create new token
    const token = await Token.create({
      user: userId,
      date: new Date(date),
      tokenNumber,
      status: 'pending',
    });

    return token;
  } catch (error) {
    console.error('Error in generateToken:', error);
    throw error;
  }
};

module.exports = {
  generateToken,
};
