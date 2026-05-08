const crypto = require('crypto');

const { query } = require('../config/mysql');
const { ApiError } = require('../utils/ApiError');

function toPublicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    name: user.name,
    email: user.email,
    jobTitle: user.job_title,
    careerLevel: user.career_level,
    resumeType: user.resume_type,
    createdAt: user.created_at,
  };
}

async function findUserByEmail(email) {
  const rows = await query(
    `SELECT id, first_name, last_name, name, email, password_hash, job_title,
            career_level, resume_type, created_at, updated_at
       FROM users
      WHERE email = :email
      LIMIT 1`,
    { email },
  );

  return rows[0] || null;
}

async function findUserById(id) {
  const rows = await query(
    `SELECT id, first_name, last_name, name, email, password_hash, job_title,
            career_level, resume_type, created_at, updated_at
       FROM users
      WHERE id = :id
      LIMIT 1`,
    { id },
  );

  return rows[0] || null;
}

async function createUser(input) {
  const user = {
    id: crypto.randomUUID(),
    ...input,
  };

  try {
    await query(
      `INSERT INTO users (
         id, first_name, last_name, name, email, password_hash,
         job_title, career_level, resume_type
       ) VALUES (
         :id, :firstName, :lastName, :name, :email, :passwordHash,
         :jobTitle, :careerLevel, :resumeType
       )`,
      user,
    );
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'An account with this email already exists.');
    }

    throw error;
  }

  return findUserById(user.id);
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  toPublicUser,
};
