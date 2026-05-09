const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/**
 * Purchase Order Routes — all owner-only.
 * Auth chain: authenticate → authorize(['owner']) → handler
 */

router.get('/', authenticate, authorize(['owner']), purchaseOrderController.getAllPurchaseOrders);
router.get('/:id', authenticate, authorize(['owner']), purchaseOrderController.getPurchaseOrderById);
router.get('/:id/history', authenticate, authorize(['owner']), purchaseOrderController.getPurchaseOrderHistory);
router.post('/', authenticate, authorize(['owner']), purchaseOrderController.createPurchaseOrder);
router.put('/:id', authenticate, authorize(['owner']), purchaseOrderController.updatePurchaseOrder);
router.post(
  '/:id/cancel',
  authenticate,
  authorize(['owner']),
  purchaseOrderController.cancelPurchaseOrder
);
router.post(
  '/:id/send',
  authenticate,
  authorize(['owner']),
  purchaseOrderController.sendPurchaseOrder
);
router.post(
  '/:id/receive',
  authenticate,
  authorize(['owner']),
  purchaseOrderController.receivePurchaseOrder
);

module.exports = router;
