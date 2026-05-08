const jwt = require('jsonwebtoken');

const userService = require('../services/userService');
const { ApiError } = require('../utils/ApiError');

function getToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }

  return authHeader.slice(7).trim();
}

async function attachUser(req, required) {
  const token = getToken(req);

  if (!token) {
    if (required) {
      throw new ApiError(401, 'Please sign in to continue.');
    }
    return;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  const user = await userService.findUserById(decoded.sub);
  if (!user) {
    throw new ApiError(401, 'User account was not found.');
  }

  req.user = user;
  req.publicUser = userService.toPublicUser(user);
}

async function requireAuth(req, res, next) {
  try {
    await attachUser(req, true);
    next();
  } catch (error) {
    next(error);
  }
}

async function optionalAuth(req, res, next) {
  try {
    await attachUser(req, false);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  optionalAuth,
  requireAuth,
};
