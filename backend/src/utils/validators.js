function sanitizeText(value, maxLength = 200) {
  return String(value || '').trim().slice(0, maxLength);
}

function sanitizeLongText(value, maxLength = 1200) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizeResumeType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'technical' || normalized === 'non-technical' ? normalized : '';
}

function sanitizeGuestId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);
}

function sanitizeVoiceAnswers(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const sanitized = {};

  Object.keys(source).forEach((key) => {
    sanitized[key] = sanitizeLongText(source[key]);
  });

  return sanitized;
}

module.exports = {
  normalizeEmail,
  sanitizeGuestId,
  sanitizeLongText,
  sanitizeResumeType,
  sanitizeText,
  sanitizeVoiceAnswers,
};
