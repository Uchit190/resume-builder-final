const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userService = require('./userService');
const { ApiError } = require('../utils/ApiError');
const {
  normalizeEmail,
  sanitizeResumeType,
  sanitizeText,
} = require('../utils/validators');

function signToken(user) {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new ApiError(500, 'JWT_SECRET must be at least 32 characters.');
  }

  return jwt.sign(
    {
      email: user.email,
      resumeType: user.resume_type,
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      subject: user.id,
    },
  );
}

async function signup(payload) {
  const firstName = sanitizeText(payload.firstName, 100);
  const lastName = sanitizeText(payload.lastName, 100);
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  const jobTitle = sanitizeText(payload.jobTitle, 160);
  const careerLevel = sanitizeText(payload.careerLevel, 120);
  const resumeType = sanitizeResumeType(payload.resumeType) || 'technical';

  const existingUser = await userService.findUserByEmail(email);
  if (existingUser) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
  const passwordHash = await bcrypt.hash(password, saltRounds);
  const name = `${firstName} ${lastName}`.trim();

  const user = await userService.createUser({
    careerLevel,
    email,
    firstName,
    jobTitle,
    lastName,
    name,
    passwordHash,
    resumeType,
  });

  return {
    token: signToken(user),
    user: userService.toPublicUser(user),
  };
}

async function login(payload) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  const user = await userService.findUserByEmail(email);

  if (!user) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  return {
    token: signToken(user),
    user: userService.toPublicUser(user),
  };
}

module.exports = {
  login,
  signup,
};
