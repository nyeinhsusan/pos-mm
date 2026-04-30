const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

/**
 * JWT Authentication Middleware
 * Verifies JWT token from Authorization header
 * Attaches decoded user info to req.user
 */
const authenticate = (req, res, next) => {
  try {
    // Extract token from Authorization header (Bearer format)
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Authentication required. No token provided.'
        }
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Token has expired. Please login again.'
            }
          });
        }

        if (err.name === 'JsonWebTokenError') {
          return res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token. Authentication failed.'
            }
          });
        }

        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: 'Authentication failed.'
          }
        });
      }

      // Attach user info to request object
      req.user = {
        user_id: decoded.user_id,
        email: decoded.email,
        role: decoded.role
      };

      next();
    });

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Authentication failed.'
      }
    });
  }
};

module.exports = authenticate;
