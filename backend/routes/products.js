const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const productController = require('../controllers/productController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Configure multer for product image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/products/');
  },
  filename: (req, file, cb) => {
    // Generate unique filename: product-image-timestamp.extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-image-' + uniqueSuffix + ext);
  }
});

// File filter - only allow images
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
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

/**
 * Product Routes
 * All routes require authentication
 * Create/Update/Delete require owner role
 */

// Upload product image (accessible to owner only)
router.post(
  '/upload',
  authenticate,
  authorize(['owner']),
  upload.single('image'),
  productController.uploadProductImage
);

// Get all categories (public for authenticated users)
router.get('/categories', authenticate, productController.getCategories);

// Get all products with filters (accessible to all authenticated users)
router.get('/', authenticate, productController.getAllProducts);

// Get single product by ID (accessible to all authenticated users)
router.get('/:id', authenticate, productController.getProductById);

// Create new product (owner only)
router.post(
  '/',
  authenticate,
  authorize(['owner']),
  productController.createProduct
);

// Update product (owner only)
router.put(
  '/:id',
  authenticate,
  authorize(['owner']),
  productController.updateProduct
);

// Delete product (owner only)
router.delete(
  '/:id',
  authenticate,
  authorize(['owner']),
  productController.deleteProduct
);

module.exports = router;
