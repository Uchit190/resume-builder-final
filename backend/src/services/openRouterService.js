const { ApiError } = require('../utils/ApiError');

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct:free';

async function createChatCompletion(messages) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5500',
      'X-Title': 'ResumeForge',
    },
    body: JSON.stringify({
      messages,
      model: OPENROUTER_MODEL,
      temperature: 0.35,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload && payload.error && payload.error.message
      ? payload.error.message
      : 'OpenRouter request failed.';
    throw new ApiError(502, message);
  }

  return payload && payload.choices && payload.choices[0]
    ? payload.choices[0].message.content
    : null;
}

module.exports = {
  createChatCompletion,
};
