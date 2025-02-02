// utils/asyncHandler.js
const asyncHandler = (requestHandler) => {
  return async (req, res, next) => {
    try {
      await requestHandler(req, res, next);
    } catch (err) {
      // console.log(err.message);
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        errors: err.errors || [],
      });
    }
  };
};

export {asyncHandler};
