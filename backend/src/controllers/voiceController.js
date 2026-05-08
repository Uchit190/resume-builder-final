const voiceAssistantService = require('../services/voiceAssistantService');
const { ApiError } = require('../utils/ApiError');
const { sanitizeResumeType, sanitizeVoiceAnswers } = require('../utils/validators');

async function enrich(req, res) {
  const resumeType = sanitizeResumeType(req.body.resumeType);

  if (!resumeType) {
    throw new ApiError(400, 'Resume type is required.');
  }

  const suggestions = await voiceAssistantService.buildVoiceSuggestions(
    resumeType,
    sanitizeVoiceAnswers(req.body.answers),
  );

  res.json({
    ok: true,
    suggestions,
  });
}

module.exports = {
  enrich,
};
