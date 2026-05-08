const { validationResult } = require('express-validator');

const { ApiError } = require('../utils/ApiError');

function validateRequest(req, res, next) {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  const firstError = result.array({ onlyFirstError: true })[0];
  return next(new ApiError(400, firstError.msg || 'Invalid request payload.'));
}

module.exports = {
  validateRequest,
};
