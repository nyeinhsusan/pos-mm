/**
 * Role-Based Authorization Middleware
 * Checks if authenticated user has required role
 * Must be used after authenticate middleware
 *
 * @param {Array<string>} allowedRoles - Array of allowed roles ['owner', 'cashier']
 * @returns {Function} Express middleware function
 *
 * Usage:
 *   router.post('/products', authenticate, authorize(['owner']), productController.create);
 *   router.post('/sales', authenticate, authorize(['owner', 'cashier']), saleController.create);
 */
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated (should be added by authenticate middleware)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required'
          }
        });
      }

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
          }
        });
      }

      // User is authorized, proceed to next middleware
      next();

    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Authorization failed'
        }
      });
    }
  };
};

module.exports = authorize;
