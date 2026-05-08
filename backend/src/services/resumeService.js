const crypto = require('crypto');

const { query } = require('../config/mysql');
const { ApiError } = require('../utils/ApiError');
const { sanitizeGuestId, sanitizeResumeType, sanitizeText } = require('../utils/validators');

function resolveOwner(authUser, guestIdInput) {
  if (authUser) {
    return {
      ownerId: String(authUser.id),
      ownerType: 'user',
    };
  }

  const guestId = sanitizeGuestId(guestIdInput);
  if (!guestId) {
    throw new ApiError(401, 'Please sign in or provide a guest session.');
  }

  return {
    ownerId: guestId,
    ownerType: 'guest',
  };
}

function parseJsonValue(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function mapResume(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    type: row.type,
    title: row.title,
    data: parseJsonValue(row.data, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findExistingResume(owner, type) {
  const rows = await query(
    `SELECT id
       FROM resumes
      WHERE owner_type = :ownerType
        AND owner_id = :ownerId
        AND type = :type
      LIMIT 1`,
    { ...owner, type },
  );

  return rows[0] || null;
}

async function saveVoiceSessionIfPresent({ resumeId, owner, resumeType, resumeData }) {
  const voiceSession = resumeData.voiceAssistant;

  if (!voiceSession || typeof voiceSession !== 'object') {
    return;
  }

  await query(
    `INSERT INTO voice_sessions (
       id, resume_id, owner_type, owner_id, resume_type, language, transcript, generated_data
     ) VALUES (
       :id, :resumeId, :ownerType, :ownerId, :resumeType, :language, :transcript, :generated
     )
     ON DUPLICATE KEY UPDATE
       language = VALUES(language),
       transcript = VALUES(transcript),
       generated_data = VALUES(generated_data)`,
    {
      generated: JSON.stringify(voiceSession.generated || {}),
      id: crypto.randomUUID(),
      language: voiceSession.language || null,
      ownerId: owner.ownerId,
      ownerType: owner.ownerType,
      resumeId,
      resumeType,
      transcript: JSON.stringify(voiceSession.transcript || []),
    },
  );
}

async function saveResume({ authUser, body, guestId }) {
  const owner = resolveOwner(authUser, guestId);
  const type = sanitizeResumeType(body.type);
  const title = sanitizeText(body.title) || `${type} resume`;
  const resumeData = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : null;

  if (!type) {
    throw new ApiError(400, 'Resume type is required.');
  }

  if (!resumeData) {
    throw new ApiError(400, 'Resume data is required.');
  }

  const existingResume = await findExistingResume(owner, type);
  const resumeId = existingResume ? existingResume.id : crypto.randomUUID();

  await query(
    `INSERT INTO resumes (
       id, owner_type, owner_id, type, title, data
     ) VALUES (
       :id, :ownerType, :ownerId, :type, :title, :data
     )
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       data = VALUES(data)`,
    {
      data: JSON.stringify(resumeData),
      id: resumeId,
      ownerId: owner.ownerId,
      ownerType: owner.ownerType,
      title,
      type,
    },
  );

  await saveVoiceSessionIfPresent({
    owner,
    resumeData,
    resumeId,
    resumeType: type,
  });

  const rows = await query('SELECT * FROM resumes WHERE id = :resumeId LIMIT 1', { resumeId });

  return {
    resume: mapResume(rows[0]),
    wasCreated: !existingResume,
  };
}

async function listResumes({ authUser, guestId }) {
  const owner = resolveOwner(authUser, guestId);
  const rows = await query(
    `SELECT *
       FROM resumes
      WHERE owner_type = :ownerType
        AND owner_id = :ownerId
      ORDER BY updated_at DESC`,
    owner,
  );

  return rows.map(mapResume);
}

async function getLatestResume({ authUser, guestId, type }) {
  const owner = resolveOwner(authUser, guestId);
  const requestedType = sanitizeResumeType(type);
  const params = { ...owner };
  let typeClause = '';

  if (requestedType) {
    typeClause = 'AND type = :type';
    params.type = requestedType;
  }

  const rows = await query(
    `SELECT *
       FROM resumes
      WHERE owner_type = :ownerType
        AND owner_id = :ownerId
        ${typeClause}
      ORDER BY updated_at DESC
      LIMIT 1`,
    params,
  );

  return mapResume(rows[0] || null);
}

module.exports = {
  getLatestResume,
  listResumes,
  saveResume,
};
