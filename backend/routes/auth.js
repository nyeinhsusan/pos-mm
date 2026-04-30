const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/**
 * @route   POST /api/auth/login
 * @desc    User login
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Private (Owner only)
 */
router.post('/register', authenticate, authorize(['owner']), authController.register);

module.exports = router;
