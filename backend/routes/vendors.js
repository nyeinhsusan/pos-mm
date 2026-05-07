const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const vendorController = require('../controllers/vendorController');
const vendorProductController = require('../controllers/vendorProductController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Multer config for vendor logo uploads.
// Mirrors the product image config in routes/products.js.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/vendors/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'vendor-logo-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

/**
 * Vendor Routes — all owner-only.
 * Auth chain: authenticate → authorize(['owner']) → handler
 */

// List + filter
router.get('/', authenticate, authorize(['owner']), vendorController.getAllVendors);

// Detail
router.get('/:id', authenticate, authorize(['owner']), vendorController.getVendorById);

// Create
router.post('/', authenticate, authorize(['owner']), vendorController.createVendor);

// Update
router.put('/:id', authenticate, authorize(['owner']), vendorController.updateVendor);

// Archive / Restore (soft-delete pair)
router.post('/:id/archive', authenticate, authorize(['owner']), vendorController.archiveVendor);
router.post('/:id/restore', authenticate, authorize(['owner']), vendorController.restoreVendor);

// Hard-delete (rejects if vendor has open POs once Epic 7 is in place)
router.delete('/:id', authenticate, authorize(['owner']), vendorController.deleteVendor);

// Logo upload
router.post(
  '/:id/logo',
  authenticate,
  authorize(['owner']),
  upload.single('logo'),
  vendorController.uploadVendorLogo
);

// Vendor catalog (sub-resource): products linked to this vendor
router.get(
  '/:vendorId/products',
  authenticate,
  authorize(['owner']),
  vendorProductController.getProductsByVendor
);

// Link a product to this vendor
router.post(
  '/:vendorId/products',
  authenticate,
  authorize(['owner']),
  vendorProductController.linkProductToVendor
);

module.exports = router;
