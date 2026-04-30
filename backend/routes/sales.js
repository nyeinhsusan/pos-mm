const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/**
 * Sales Routes
 * All routes require authentication
 * Sales history viewing restricted to owner
 */

// Record new sale (accessible to both owner and cashier)
router.post('/', authenticate, saleController.recordSale);

// Get all sales with pagination (owner only)
router.get('/', authenticate, authorize(['owner']), saleController.getAllSales);

// Get receipt data for a sale (accessible to both owner and cashier)
router.get('/:id/receipt', authenticate, saleController.getReceipt);

// Get single sale details (owner only)
router.get('/:id', authenticate, authorize(['owner']), saleController.getSaleById);

module.exports = router;
