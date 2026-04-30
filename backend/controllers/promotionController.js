const Promotion = require('../models/Promotion');

/**
 * Create a new promotion (owner only)
 * POST /api/promotions
 */
exports.createPromotion = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const promotionData = req.body;

    // Validation
    if (!promotionData.name || !promotionData.discount_type || !promotionData.discount_value) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          details: 'name, discount_type, and discount_value are required'
        }
      });
    }

    if (!promotionData.start_date || !promotionData.end_date) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing date range',
          details: 'start_date and end_date are required'
        }
      });
    }

    const promotion = await Promotion.create(promotionData, userId);

    res.status(201).json({
      success: true,
      message: 'Promotion created successfully',
      data: promotion
    });
  } catch (error) {
    console.error('Create promotion error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create promotion',
        details: error.message
      }
    });
  }
};

/**
 * Get all promotions with filters
 * GET /api/promotions?status=active&current=true
 */
exports.getAllPromotions = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      current: req.query.current,
      applies_to: req.query.applies_to
    };

    const promotions = await Promotion.findAll(filters);

    res.status(200).json({
      success: true,
      data: promotions
    });
  } catch (error) {
    console.error('Get promotions error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve promotions',
        details: error.message
      }
    });
  }
};

/**
 * Get currently active promotions
 * GET /api/promotions/active
 */
exports.getActivePromotions = async (req, res) => {
  try {
    const promotions = await Promotion.getActivePromotions();

    res.status(200).json({
      success: true,
      data: promotions
    });
  } catch (error) {
    console.error('Get active promotions error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve active promotions',
        details: error.message
      }
    });
  }
};

/**
 * Get single promotion by ID
 * GET /api/promotions/:id
 */
exports.getPromotionById = async (req, res) => {
  try {
    const { id } = req.params;

    const promotion = await Promotion.findById(parseInt(id));

    if (!promotion) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Promotion not found'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: promotion
    });
  } catch (error) {
    console.error('Get promotion error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve promotion',
        details: error.message
      }
    });
  }
};

/**
 * Update promotion (owner only)
 * PUT /api/promotions/:id
 */
exports.updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const promotion = await Promotion.update(parseInt(id), updateData);

    if (!promotion) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Promotion not found'
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Promotion updated successfully',
      data: promotion
    });
  } catch (error) {
    console.error('Update promotion error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update promotion',
        details: error.message
      }
    });
  }
};

/**
 * Delete promotion (owner only)
 * DELETE /api/promotions/:id
 */
exports.deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;

    await Promotion.delete(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'Promotion deleted successfully'
    });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete promotion',
        details: error.message
      }
    });
  }
};

/**
 * Get promotions for a specific product
 * GET /api/promotions/product/:productId
 */
exports.getPromotionsForProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { category } = req.query;

    const promotions = await Promotion.getPromotionsForProduct(
      parseInt(productId),
      category
    );

    res.status(200).json({
      success: true,
      data: promotions
    });
  } catch (error) {
    console.error('Get product promotions error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve product promotions',
        details: error.message
      }
    });
  }
};
