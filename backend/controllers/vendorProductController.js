const VendorProduct = require('../models/VendorProduct');

/**
 * GET /api/vendors/:vendorId/products
 * List products linked to a vendor.
 */
exports.getProductsByVendor = async (req, res) => {
  try {
    const rows = await VendorProduct.findByVendor(req.params.vendorId);
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Get products by vendor error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve vendor catalog', details: error.message }
    });
  }
};

/**
 * GET /api/products/:productId/vendors
 * List vendors linked to a product (preferred first).
 */
exports.getVendorsByProduct = async (req, res) => {
  try {
    const rows = await VendorProduct.findByProduct(req.params.productId);
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Get vendors by product error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve product vendors', details: error.message }
    });
  }
};

/**
 * POST /api/vendors/:vendorId/products
 * Link a product to a vendor.
 */
exports.linkProductToVendor = async (req, res) => {
  try {
    const vendor_id = parseInt(req.params.vendorId, 10);
    const {
      product_id,
      vendor_cost_price,
      default_reorder_qty,
      min_order_qty,
      is_preferred
    } = req.body;

    // Validation
    const errors = [];
    if (!product_id || isNaN(parseInt(product_id, 10))) errors.push('product_id is required');
    if (vendor_cost_price == null || isNaN(Number(vendor_cost_price)) || Number(vendor_cost_price) < 0) {
      errors.push('vendor_cost_price must be a non-negative number');
    }
    if (default_reorder_qty != null) {
      const n = Number(default_reorder_qty);
      if (!Number.isInteger(n) || n < 1) errors.push('default_reorder_qty must be a positive integer');
    }
    if (min_order_qty != null) {
      const n = Number(min_order_qty);
      if (!Number.isInteger(n) || n < 1) errors.push('min_order_qty must be a positive integer');
    }
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', details: errors.join('; ') }
      });
    }

    const id = await VendorProduct.link({
      vendor_id,
      product_id: parseInt(product_id, 10),
      vendor_cost_price: Number(vendor_cost_price),
      default_reorder_qty: default_reorder_qty != null ? Number(default_reorder_qty) : 1,
      min_order_qty: min_order_qty != null ? Number(min_order_qty) : 1,
      is_preferred: !!is_preferred
    });

    res.status(201).json({ success: true, data: { vendor_product_id: id } });
  } catch (error) {
    if (error.code === 'DUPLICATE_LINK') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_LINK', message: error.message }
      });
    }
    console.error('Link product to vendor error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to link product', details: error.message }
    });
  }
};

/**
 * PUT /api/vendor-products/:id
 * Update mutable fields on a link row. vendor_id / product_id rejected.
 */
exports.updateVendorProduct = async (req, res) => {
  try {
    if (req.body.vendor_id !== undefined || req.body.product_id !== undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'IMMUTABLE_FIELD',
          message: 'vendor_id and product_id cannot be changed; unlink and re-link instead'
        }
      });
    }

    const errors = [];
    if (req.body.vendor_cost_price != null && Number(req.body.vendor_cost_price) < 0) {
      errors.push('vendor_cost_price must be non-negative');
    }
    if (req.body.default_reorder_qty != null) {
      const n = Number(req.body.default_reorder_qty);
      if (!Number.isInteger(n) || n < 1) errors.push('default_reorder_qty must be a positive integer');
    }
    if (req.body.min_order_qty != null) {
      const n = Number(req.body.min_order_qty);
      if (!Number.isInteger(n) || n < 1) errors.push('min_order_qty must be a positive integer');
    }
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', details: errors.join('; ') }
      });
    }

    const affected = await VendorProduct.update(req.params.id, req.body);
    if (affected === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Vendor-product link not found or no changes' }
      });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Update vendor-product error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update vendor-product link', details: error.message }
    });
  }
};

/**
 * DELETE /api/vendor-products/:id
 */
exports.unlinkVendorProduct = async (req, res) => {
  try {
    const affected = await VendorProduct.unlink(req.params.id);
    if (affected === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Vendor-product link not found' }
      });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Unlink vendor-product error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to unlink vendor-product', details: error.message }
    });
  }
};

/**
 * POST /api/vendor-products/:id/set-preferred
 */
exports.setPreferred = async (req, res) => {
  try {
    const affected = await VendorProduct.setPreferred(req.params.id);
    if (affected === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Vendor-product link not found' }
      });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Set preferred error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to set preferred vendor', details: error.message }
    });
  }
};
