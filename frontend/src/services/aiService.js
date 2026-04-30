/**
 * AI/ML Service API Client
 *
 * Provides interface to AI prediction endpoints:
 * - Sales forecasting (7/14/30-day predictions)
 * - Inventory predictions (stockout dates, reorder quantities)
 * - Product recommendations (market basket analysis)
 *
 * @module services/aiService
 */

import api from './api';

/**
 * Check ML service health status
 * @returns {Promise<Object>} Health status and model availability
 */
export const checkMLServiceHealth = async () => {
  try {
    const response = await api.get('/ai/health');
    return response.data;
  } catch (error) {
    console.error('ML Service health check failed:', error);
    throw error;
  }
};

/**
 * Get sales forecast predictions
 * @param {number} days - Forecast horizon (7, 14, or 30 days)
 * @returns {Promise<Object>} Forecast data with predictions and confidence intervals
 */
export const getForecast = async (days = 7) => {
  if (![7, 14, 30].includes(days)) {
    throw new Error('Days must be 7, 14, or 30');
  }

  try {
    const response = await api.get(`/ai/forecast?days=${days}`);
    return response.data;
  } catch (error) {
    console.error(`Get forecast (${days} days) failed:`, error);
    throw error;
  }
};

/**
 * Get inventory stockout predictions and reorder recommendations
 * @param {number|null} productId - Optional product ID to filter (null for all products)
 * @returns {Promise<Object>} Inventory predictions with stockout dates and alerts
 */
export const getInventoryInsights = async (productId = null) => {
  try {
    const url = productId
      ? `/ai/inventory-insights?product_id=${productId}`
      : '/ai/inventory-insights';

    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Get inventory insights failed:', error);
    throw error;
  }
};

/**
 * Get product recommendations based on market basket analysis
 * @param {number} productId - Product ID to get recommendations for
 * @param {number} limit - Number of recommendations to return (default 5, max 10)
 * @returns {Promise<Object>} Product recommendations with confidence and lift metrics
 */
export const getRecommendations = async (productId, limit = 5) => {
  if (!productId) {
    throw new Error('Product ID is required');
  }

  if (limit < 1 || limit > 10) {
    throw new Error('Limit must be between 1 and 10');
  }

  try {
    const response = await api.get(`/ai/recommendations?product_id=${productId}&limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error(`Get recommendations for product ${productId} failed:`, error);
    throw error;
  }
};

/**
 * Get ML models metadata and performance metrics
 * @returns {Promise<Object>} Model information and performance stats
 */
export const getModelsInfo = async () => {
  try {
    const response = await api.get('/ai/models/info');
    return response.data;
  } catch (error) {
    console.error('Get models info failed:', error);
    throw error;
  }
};

/**
 * Clear ML service cache (admin only)
 * @returns {Promise<Object>} Cache clear confirmation
 */
export const clearMLCache = async () => {
  try {
    const response = await api.post('/ai/cache/clear');
    return response.data;
  } catch (error) {
    console.error('Clear ML cache failed:', error);
    throw error;
  }
};

/**
 * Get ML service cache statistics (admin only)
 * @returns {Promise<Object>} Cache statistics
 */
export const getCacheStats = async () => {
  try {
    const response = await api.get('/ai/cache/stats');
    return response.data;
  } catch (error) {
    console.error('Get cache stats failed:', error);
    throw error;
  }
};

// Export all functions as default object
const aiService = {
  checkMLServiceHealth,
  getForecast,
  getInventoryInsights,
  getRecommendations,
  getModelsInfo,
  clearMLCache,
  getCacheStats
};

export default aiService;
