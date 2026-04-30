const Sale = require('../models/Sale');

/**
 * Record a new sale
 * POST /api/sales
 * Body: {items: [{product_id, quantity}], payments: [{payment_method, amount, transaction_id}], notes}
 */
exports.recordSale = async (req, res) => {
  try {
    const { items, payments, notes } = req.body;
    const user_id = req.user.user_id; // From authenticate middleware

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid sale data',
          details: 'items array is required and must contain at least one item'
        }
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.product_id || !item.quantity) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid item data',
            details: 'Each item must have product_id and quantity'
          }
        });
      }

      if (item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid quantity',
            details: 'Quantity must be greater than 0'
          }
        });
      }
    }

    // Validate payments if provided
    if (payments) {
      if (!Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid payment data',
            details: 'payments must be an array with at least one payment method'
          }
        });
      }

      const validPaymentMethods = ['cash', 'card', 'kbzpay', 'wavepay', 'ayapay'];
      for (const payment of payments) {
        if (!payment.payment_method || !validPaymentMethods.includes(payment.payment_method)) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Invalid payment method',
              details: 'payment_method must be one of: cash, card, kbzpay, wavepay, ayapay'
            }
          });
        }

        if (!payment.amount || payment.amount <= 0) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Invalid payment amount',
              details: 'Each payment amount must be greater than 0'
            }
          });
        }
      }
    }

    const saleData = { user_id, items, payments, notes };
    const sale = await Sale.create(saleData);

    res.status(201).json({
      success: true,
      message: 'Sale recorded successfully',
      data: sale
    });
  } catch (error) {
    console.error('Record sale error:', error);

    // Handle specific error messages from Sale model
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          details: error.message
        }
      });
    }

    if (error.message.includes('Insufficient stock')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Insufficient stock',
          details: error.message
        }
      });
    }

    if (error.message.includes('must contain at least one item')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid sale data',
          details: error.message
        }
      });
    }

    if (error.message.includes('Payment total') || error.message.includes('payment method')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid payment data',
          details: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to record sale',
        details: error.message
      }
    });
  }
};

/**
 * Get all sales with pagination and filters
 * GET /api/sales?page=1&limit=50&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
exports.getAllSales = async (req, res) => {
  try {
    const { page, limit, start_date, end_date, user_id } = req.query;

    const filters = {
      page: page || 1,
      limit: limit || 50,
      start_date,
      end_date,
      user_id
    };

    const result = await Sale.findAll(filters);

    res.status(200).json({
      success: true,
      data: result.sales,
      pagination: {
        page: result.page,
        limit: result.limit,
        total_count: result.total_count,
        total_pages: result.total_pages
      }
    });
  } catch (error) {
    console.error('Get all sales error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve sales',
        details: error.message
      }
    });
  }
};

/**
 * Get single sale with line items
 * GET /api/sales/:id
 */
exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Sale not found'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error('Get sale by ID error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve sale',
        details: error.message
      }
    });
  }
};

/**
 * Get receipt data for a sale
 * GET /api/sales/:id/receipt
 */
exports.getReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const receiptData = await Sale.getReceiptData(id);

    if (!receiptData) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Sale not found'
        }
      });
    }

    // Increment print count
    await Sale.incrementPrintCount(id);

    res.status(200).json({
      success: true,
      data: {
        receipt: receiptData
      }
    });
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve receipt',
        details: error.message
      }
    });
  }
};
