const express = require('express');
const router = express.Router();
const discountController = require('../controllers/discountController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/**
 * Discount Routes
 * All routes require authentication
 */

// Get discount settings (accessible to all authenticated users)
router.get('/settings', authenticate, discountController.getSettings);

// Update discount settings (owner only)
router.put('/settings', authenticate, authorize(['owner']), discountController.updateSettings);

// Apply discount to sale (accessible to both owner and cashier)
router.post('/sales/:sale_id/discounts', authenticate, discountController.applyDiscount);

// Get all discounts for a sale (accessible to both owner and cashier)
router.get('/sales/:sale_id/discounts', authenticate, discountController.getDiscountsBySale);

// Remove discount from sale (accessible to both owner and cashier)
router.delete('/sales/:sale_id/discounts/:discount_id', authenticate, discountController.removeDiscount);

module.exports = router;
