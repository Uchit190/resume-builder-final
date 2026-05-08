const express = require('express');
const { body } = require('express-validator');

const voiceController = require('../controllers/voiceController');
const { optionalAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.post(
  '/enrich',
  optionalAuth,
  [
    body('resumeType').isIn(['technical', 'non-technical']).withMessage('Resume type is required.'),
    body('answers').optional({ nullable: true }).isObject().withMessage('Answers must be an object.'),
    body('language').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  ],
  validateRequest,
  asyncHandler(voiceController.enrich),
);

module.exports = router;
