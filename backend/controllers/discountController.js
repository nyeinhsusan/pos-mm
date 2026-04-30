const Discount = require('../models/Discount');

/**
 * Apply discount to a sale (cart-level or item-level)
 * POST /api/sales/:sale_id/discounts
 * Body: {type, value, reason, sale_item_id (optional)}
 */
exports.applyDiscount = async (req, res) => {
  try {
    const { sale_id } = req.params;
    const { type, value, reason, sale_item_id } = req.body;
    const user_id = req.user.user_id;

    // Validation
    if (!type || !['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid discount type',
          details: 'type must be either "percentage" or "fixed"'
        }
      });
    }

    if (!value || value <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid discount value',
          details: 'value must be a positive number'
        }
      });
    }

    if (type === 'percentage' && value > 100) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid percentage',
          details: 'Percentage cannot exceed 100'
        }
      });
    }

    const discountData = {
      type,
      value: parseFloat(value),
      reason: reason || 'Manual discount',
      applied_by: user_id
    };

    let result;

    // Apply cart-level or item-level discount
    if (sale_item_id) {
      result = await Discount.applyToItem(parseInt(sale_id), parseInt(sale_item_id), discountData);
    } else {
      result = await Discount.applyToSale(parseInt(sale_id), discountData);
    }

    res.status(201).json({
      success: true,
      message: result.requires_approval
        ? 'Discount applied successfully (requires manager approval)'
        : 'Discount applied successfully',
      data: result
    });
  } catch (error) {
    console.error('Apply discount error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Not found',
          details: error.message
        }
      });
    }

    if (error.message.includes('exceeds')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Discount validation failed',
          details: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to apply discount',
        details: error.message
      }
    });
  }
};

/**
 * Remove a discount from a sale
 * DELETE /api/sales/:sale_id/discounts/:discount_id
 */
exports.removeDiscount = async (req, res) => {
  try {
    const { sale_id, discount_id } = req.params;

    const result = await Discount.remove(parseInt(discount_id), parseInt(sale_id));

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Remove discount error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Discount not found',
          details: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to remove discount',
        details: error.message
      }
    });
  }
};

/**
 * Get all discounts for a sale
 * GET /api/sales/:sale_id/discounts
 */
exports.getDiscountsBySale = async (req, res) => {
  try {
    const { sale_id } = req.params;

    const discounts = await Discount.getBySaleId(parseInt(sale_id));

    res.status(200).json({
      success: true,
      data: discounts
    });
  } catch (error) {
    console.error('Get discounts error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve discounts',
        details: error.message
      }
    });
  }
};

/**
 * Get discount settings
 * GET /api/discounts/settings
 */
exports.getSettings = async (req, res) => {
  try {
    const settings = await Discount.getSettings();

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get discount settings error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve discount settings',
        details: error.message
      }
    });
  }
};

/**
 * Update discount settings (owner only)
 * PUT /api/discounts/settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const settings = req.body;

    // Validation
    if (settings.max_discount_percentage && (settings.max_discount_percentage < 0 || settings.max_discount_percentage > 100)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid max discount percentage',
          details: 'Must be between 0 and 100'
        }
      });
    }

    if (settings.require_approval_threshold && (settings.require_approval_threshold < 0 || settings.require_approval_threshold > 100)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid approval threshold',
          details: 'Must be between 0 and 100'
        }
      });
    }

    const updatedSettings = await Discount.updateSettings(settings, user_id);

    res.status(200).json({
      success: true,
      message: 'Discount settings updated successfully',
      data: updatedSettings
    });
  } catch (error) {
    console.error('Update discount settings error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update discount settings',
        details: error.message
      }
    });
  }
};
