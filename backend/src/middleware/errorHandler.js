const { ApiError } = require('../utils/ApiError');

function errorHandler(error, req, res, next) {
  const isKnownError = error instanceof ApiError;
  const statusCode = isKnownError ? error.statusCode : 500;

  if (!isKnownError) {
    console.error(error);
  }

  res.status(statusCode).json({
    ok: false,
    error: isKnownError ? error.message : 'Something went wrong.',
  });
}

module.exports = {
  errorHandler,
};
