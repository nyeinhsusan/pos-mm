const express = require('express');
const router = express.Router();
const vendorSettingsController = require('../controllers/vendorSettingsController');
const autoReorderController = require('../controllers/autoReorderController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/**
 * Auto-Reorder routes (Stories 32 & 33).
 * Mounted at /api/auto-reorder in server.js.
 */

// GET /status — operational health snapshot (Story 32)
router.get(
  '/status',
  authenticate,
  authorize(['owner']),
  vendorSettingsController.getAutoReorderStatus
);

// POST /run-now — manual trigger (Story 33)
router.post(
  '/run-now',
  authenticate,
  authorize(['owner']),
  autoReorderController.runAutoReorderNow
);

// GET /activity — paginated run history (Story 33)
router.get(
  '/activity',
  authenticate,
  authorize(['owner']),
  autoReorderController.getAutoReorderActivity
);

// GET /pending-approval-count — badge count (Story 33)
router.get(
  '/pending-approval-count',
  authenticate,
  authorize(['owner']),
  autoReorderController.getPendingApprovalCount
);

module.exports = router;