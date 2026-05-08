const express = require('express');
const { body, query } = require('express-validator');

const resumeController = require('../controllers/resumeController');
const { optionalAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.post(
  '/',
  optionalAuth,
  [
    body('type').isIn(['technical', 'non-technical']).withMessage('Resume type is required.'),
    body('title').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
    body('guestId').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
    body('data').custom((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Resume data is required.');
      }
      return true;
    }),
  ],
  validateRequest,
  asyncHandler(resumeController.saveResume),
);

router.get('/', optionalAuth, asyncHandler(resumeController.listResumes));

router.get(
  '/latest',
  optionalAuth,
  [
    query('type').optional({ values: 'falsy' }).isIn(['technical', 'non-technical']).withMessage('Invalid resume type.'),
    query('guestId').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  ],
  validateRequest,
  asyncHandler(resumeController.getLatestResume),
);

module.exports = router;
