const express = require('express');
const { body } = require('express-validator');

const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.post(
  '/signup',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required.').isLength({ max: 100 }),
    body('lastName').trim().notEmpty().withMessage('Last name is required.').isLength({ max: 100 }),
    body('email').trim().isEmail().withMessage('Please enter a valid email address.').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
    body('resumeType').optional().isIn(['technical', 'non-technical']).withMessage('Invalid resume type.'),
    body('jobTitle').optional({ values: 'falsy' }).trim().isLength({ max: 160 }),
    body('careerLevel').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  ],
  validateRequest,
  asyncHandler(authController.signup),
);

router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Please enter a valid email address.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validateRequest,
  asyncHandler(authController.login),
);

router.get('/me', requireAuth, asyncHandler(authController.me));
router.post('/logout', requireAuth, asyncHandler(authController.logout));

module.exports = router;
