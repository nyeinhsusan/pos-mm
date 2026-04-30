const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/**
 * Reports Routes
 * All routes require authentication and owner role
 */

// Daily sales report
router.get(
  '/daily',
  authenticate,
  authorize(['owner']),
  reportController.getDailySalesReport
);

// Monthly sales report with date range
router.get(
  '/monthly',
  authenticate,
  authorize(['owner']),
  reportController.getMonthlySalesReport
);

// Inventory status report
router.get(
  '/inventory',
  authenticate,
  authorize(['owner']),
  reportController.getInventoryStatusReport
);

// Payment method breakdown report
router.get(
  '/payment-methods',
  authenticate,
  authorize(['owner']),
  reportController.getPaymentMethodsReport
);

// Payment trends report
router.get(
  '/payment-trends',
  authenticate,
  authorize(['owner']),
  reportController.getPaymentTrendsReport
);

module.exports = router;
