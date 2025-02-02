class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message); // Super constructor will set the message property
    this.statusCode = statusCode;
    this.data = null;
    this.success = false;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
