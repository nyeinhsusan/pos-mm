const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { jwtSecret, jwtExpiration, bcryptRounds } = require('../config/auth');

/**
 * Register new user
 * POST /api/auth/register
 * Required: email, password, full_name
 * Optional: role (default: 'cashier')
 * Authorization: Owner only (checked by middleware)
 */
exports.register = async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;

    // Validation
    if (!email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, password, and full name are required'
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email format'
        }
      });
    }

    // Validate role
    if (role && !['owner', 'cashier'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: 'Role must be either "owner" or "cashier"'
        }
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already registered'
        }
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, bcryptRounds);

    // Create user
    const userId = await User.create({
      email,
      password_hash,
      full_name,
      role: role || 'cashier'
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user_id: userId
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create user'
      }
    });
  }
};

/**
 * User login
 * POST /api/auth/login
 * Required: email, password
 * Returns: JWT token and user info
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        }
      });
    }

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role
      },
      jwtSecret,
      { expiresIn: jwtExpiration }
    );

    // Return success response
    res.status(200).json({
      success: true,
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Login failed'
      }
    });
  }
};
