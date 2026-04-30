const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/**
 * Product Routes
 * All routes require authentication
 * Create/Update/Delete require owner role
 */

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
