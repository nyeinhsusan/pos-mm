const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotionController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/**
 * Promotion Routes
 * All routes require authentication
 * Create/Update/Delete require owner role
 */

// Get all promotions with filters (owner only)
router.get('/', authenticate, authorize(['owner']), promotionController.getAllPromotions);

// Get currently active promotions (accessible to all authenticated users)
router.get('/active', authenticate, promotionController.getActivePromotions);

// Get promotions for a specific product (accessible to all authenticated users)
router.get('/product/:productId', authenticate, promotionController.getPromotionsForProduct);

// Get single promotion by ID (owner only)
router.get('/:id', authenticate, authorize(['owner']), promotionController.getPromotionById);

// Create new promotion (owner only)
router.post('/', authenticate, authorize(['owner']), promotionController.createPromotion);

// Update promotion (owner only)
router.put('/:id', authenticate, authorize(['owner']), promotionController.updatePromotion);

// Delete promotion (owner only)
router.delete('/:id', authenticate, authorize(['owner']), promotionController.deletePromotion);

module.exports = router;
