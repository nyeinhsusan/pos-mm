const express = require('express');
const router = express.Router();
const vendorProductController = require('../controllers/vendorProductController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/**
 * Vendor-Product link routes (mounted at /api/vendor-products).
 * Sub-resource paths (/api/vendors/:id/products, /api/products/:id/vendors)
 * are wired up in their respective owning route files.
 */

// Update mutable fields on a link
router.put(
  '/:id',
  authenticate,
  authorize(['owner']),
  vendorProductController.updateVendorProduct
);

// Unlink
router.delete(
  '/:id',
  authenticate,
  authorize(['owner']),
  vendorProductController.unlinkVendorProduct
);

// Promote a link to preferred (atomic swap with any existing preferred sibling)
router.post(
  '/:id/set-preferred',
  authenticate,
  authorize(['owner']),
  vendorProductController.setPreferred
);

module.exports = router;
