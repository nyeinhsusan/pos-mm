const PurchaseOrder = require('../models/PurchaseOrder');
const { sendPurchaseOrderById, PurchaseOrderSendError } = require('../services/purchaseOrderSendService');

const PurchaseOrderError = PurchaseOrder.PurchaseOrderError;

const ERROR_TO_STATUS = {
  NOT_FOUND: 404,
  PO_NOT_EDITABLE: 409,
  PO_NOT_CANCELLABLE: 409,
  PO_NOT_SENDABLE: 409,
  PO_NOT_SENT_YET: 409,
  PO_FULLY_RECEIVED: 409,
  PO_CANCELLED: 409,
  VENDOR_NOT_CHANGEABLE: 409,
  VENDOR_ARCHIVED: 400,
  INVALID_VENDOR: 400,
  INVALID_PRODUCT: 400,
  INVALID_QUANTITY: 400,
  INVALID_UNIT_COST: 400,
  INVALID_TAX: 400,
  INVALID_USER: 400,
  EMPTY_PO: 400,
  OVER_RECEIVE: 400,
  INVALID_ITEMS: 400
};

function handleDomainError(error, res, fallbackMessage) {
  if (error instanceof PurchaseOrderError) {
    const status = ERROR_TO_STATUS[error.code] || 500;
    return res.status(status).json({
      success: false,
      error: { code: error.code, message: error.message, ...(error.meta || {}) }
    });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({
    success: false,
    error: { message: fallbackMessage, details: error.message }
  });
}

/**
 * GET /api/purchase-orders
 */
exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const { status, vendor_id, source, date_from, date_to, search } = req.query;
    const purchaseOrders = await PurchaseOrder.findAll({
      status,
      vendor_id,
      source,
      date_from,
      date_to,
      search
    });
    res.status(200).json({
      success: true,
      count: purchaseOrders.length,
      data: purchaseOrders
    });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to retrieve purchase orders');
  }
};

/**
 * GET /api/purchase-orders/:id
 */
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Purchase order not found' }
      });
    }
    res.status(200).json({ success: true, data: po });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to retrieve purchase order');
  }
};

/**
 * POST /api/purchase-orders
 * Body: { vendor_id, notes?, source?, items: [{ product_id, quantity_ordered, unit_cost, tax_amount? }] }
 */
exports.createPurchaseOrder = async (req, res) => {
  try {
    const { vendor_id, notes, source, items } = req.body || {};
    if (vendor_id == null) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'vendor_id is required' }
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_PO', message: 'items array is required and must contain at least one entry' }
      });
    }

    const created = await PurchaseOrder.create({
      vendor_id,
      notes,
      source,
      items,
      created_by_user_id: req.user.user_id
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to create purchase order');
  }
};

/**
 * PUT /api/purchase-orders/:id
 * Body: { notes?, items? }  (vendor_id is rejected if present and different)
 */
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const { notes, items, vendor_id } = req.body || {};
    if (notes === undefined && items === undefined && vendor_id === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Provide at least one updatable field (notes or items)'
        }
      });
    }

    const updated = await PurchaseOrder.update(req.params.id, { notes, items, vendor_id });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to update purchase order');
  }
};

/**
 * POST /api/purchase-orders/:id/cancel
 * Body: { reason? }
 */
exports.cancelPurchaseOrder = async (req, res) => {
  try {
    const { reason } = req.body || {};
    const updated = await PurchaseOrder.cancel(req.params.id, { reason });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to cancel purchase order');
  }
};

/**
 * POST /api/purchase-orders/:id/send
 * Send a PO via email with PDF attachment
 */
exports.sendPurchaseOrder = async (req, res) => {
  try {
    const result = await sendPurchaseOrderById(req.params.id, req.user.user_id);
    if (result.status === 'sent') {
      return res.status(200).json({
        success: true,
        data: {
          purchase_order: result.purchase_order,
          email_log_id: result.email_log_id,
          status: 'sent'
        }
      });
    }
    return res.status(502).json({
      success: false,
      error: {
        code: 'EMAIL_FAILED',
        message: 'Failed to send email',
        email_log_id: result.email_log_id
      }
    });
  } catch (error) {
    if (error instanceof PurchaseOrderSendError) {
      const status =
        error.code === 'NOT_FOUND' ? 404 :
        error.code === 'PO_NOT_SENDABLE' ? 409 :
        400;
      return res.status(status).json({
        success: false,
        error: { code: error.code, message: error.message }
      });
    }
    return handleDomainError(error, res, 'Failed to send purchase order');
  }
};

/**
 * POST /api/purchase-orders/:id/receive
 * Receive line items and increment stock
 */
exports.receivePurchaseOrder = async (req, res) => {
  try {
    const poId = req.params.id;
    const { items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ITEMS', message: 'items array is required with at least one entry' }
      });
    }

    const updated = await PurchaseOrder.receive(poId, items, req.user.user_id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to receive purchase order');
  }
};

/**
 * GET /api/purchase-orders/:id/history
 * Get PO history
 */
exports.getPurchaseOrderHistory = async (req, res) => {
  try {
    const history = await PurchaseOrder.getHistory(req.params.id);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to get purchase order history');
  }
};
