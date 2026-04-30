/**
 * AI/ML Routes
 *
 * Exposes ML service predictions through Node.js API
 *
 * @module routes/aiRoutes
 * @author James (Dev Agent)
 * @date April 24, 2026
 */

const express = require('express');
const router = express.Router();
const mlService = require('../services/mlService');
const authenticate = require('../middleware/authenticate');

/**
 * GET /api/ai/health
 * Check ML service health and availability
 *
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = await mlService.checkHealth();

    const statusCode = health.available ? 200 : 503;

    res.status(statusCode).json({
      success: health.available,
      ml_service: health,
      circuit_breaker: mlService.getCircuitBreakerStatus()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ML_HEALTH_CHECK_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * GET /api/ai/forecast
 * Get sales forecast predictions
 *
 * Query params:
 * - days: Number of days to forecast (7, 14, or 30)
 *
 * @access Private (requires authentication)
 */
router.get('/forecast', authenticate, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    // Validate days parameter
    if (![7, 14, 30].includes(days)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DAYS_PARAMETER',
          message: 'Days must be 7, 14, or 30'
        }
      });
    }

    const forecast = await mlService.getForecast(days);

    res.json({
      success: !forecast.fallback,
      data: forecast,
      fallback: forecast.fallback || false
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FORECAST_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * GET /api/ai/inventory-insights
 * Get inventory stockout predictions and reorder recommendations
 *
 * Query params:
 * - product_id: Optional product ID to filter
 *
 * @access Private (requires authentication)
 */
router.get('/inventory-insights', authenticate, async (req, res) => {
  try {
    const productId = req.query.product_id ? parseInt(req.query.product_id) : null;

    const predictions = await mlService.getInventoryPredictions(productId);

    // Add alerts for critical inventory levels
    const alerts = predictions.predictions
      ? predictions.predictions.filter(p =>
          p.status === 'OUT_OF_STOCK' || p.status === 'LOW_STOCK'
        )
      : [];

    res.json({
      success: !predictions.fallback,
      data: predictions,
      alerts: alerts.length > 0 ? alerts : null,
      alert_count: alerts.length,
      fallback: predictions.fallback || false
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INVENTORY_PREDICTION_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * GET /api/ai/recommendations
 * Get product recommendations based on market basket analysis
 *
 * Query params:
 * - product_id: Product ID to get recommendations for (required)
 * - limit: Number of recommendations (default 5, max 10)
 *
 * @access Private (requires authentication)
 */
router.get('/recommendations', authenticate, async (req, res) => {
  try {
    const productId = parseInt(req.query.product_id);
    const limit = parseInt(req.query.limit) || 5;

    // Validate product_id
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PRODUCT_ID',
          message: 'Product ID is required'
        }
      });
    }

    // Validate limit
    if (limit < 1 || limit > 10) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LIMIT',
          message: 'Limit must be between 1 and 10'
        }
      });
    }

    const recommendations = await mlService.getRecommendations(productId, limit);

    res.json({
      success: !recommendations.fallback,
      data: recommendations,
      fallback: recommendations.fallback || false
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RECOMMENDATIONS_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * GET /api/ai/models/info
 * Get ML models metadata and performance metrics
 *
 * @access Private (requires authentication, admin only recommended)
 */
router.get('/models/info', authenticate, async (req, res) => {
  try {
    const modelsInfo = await mlService.getModelsInfo();

    res.json({
      success: !modelsInfo.error,
      data: modelsInfo
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'MODELS_INFO_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * POST /api/ai/cache/clear
 * Clear ML service cache (admin only)
 *
 * @access Private (requires authentication)
 */
router.post('/cache/clear', authenticate, async (req, res) => {
  try {
    const result = mlService.clearCache();

    res.json({
      success: true,
      message: `Cache cleared successfully`,
      cleared_entries: result.cleared
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_CLEAR_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * GET /api/ai/cache/stats
 * Get cache statistics (admin only)
 *
 * @access Private (requires authentication)
 */
router.get('/cache/stats', authenticate, async (req, res) => {
  try {
    const stats = mlService.getCacheStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_STATS_FAILED',
        message: error.message
      }
    });
  }
});

module.exports = router;
