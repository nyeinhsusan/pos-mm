/**
 * ML Service Integration Layer
 *
 * Provides interface to Python ML Service for AI predictions
 * Includes error handling, retry logic, caching, and circuit breaker
 *
 * @module services/mlService
 * @author James (Dev Agent)
 * @date April 24, 2026
 */

const axios = require('axios');

// ML Service configuration
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const ML_REQUEST_TIMEOUT = parseInt(process.env.ML_REQUEST_TIMEOUT) || 5000; // 5 seconds
const ML_RETRY_ATTEMPTS = parseInt(process.env.ML_RETRY_ATTEMPTS) || 2;
const ML_RETRY_DELAY = parseInt(process.env.ML_RETRY_DELAY) || 1000; // 1 second

// In-memory cache (for production, use Redis)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// Circuit breaker state
let circuitBreakerState = {
  failures: 0,
  lastFailureTime: null,
  isOpen: false,
  threshold: 5, // Open circuit after 5 consecutive failures
  resetTimeout: 60000 // Reset after 1 minute
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if circuit breaker is open
 */
function isCircuitOpen() {
  if (!circuitBreakerState.isOpen) {
    return false;
  }

  // Check if enough time has passed to reset
  const now = Date.now();
  if (now - circuitBreakerState.lastFailureTime > circuitBreakerState.resetTimeout) {
    console.log('Circuit breaker: Attempting to close (reset timeout reached)');
    circuitBreakerState.isOpen = false;
    circuitBreakerState.failures = 0;
    return false;
  }

  return true;
}

/**
 * Record circuit breaker failure
 */
function recordFailure() {
  circuitBreakerState.failures++;
  circuitBreakerState.lastFailureTime = Date.now();

  if (circuitBreakerState.failures >= circuitBreakerState.threshold) {
    circuitBreakerState.isOpen = true;
    console.error(`Circuit breaker: OPEN (${circuitBreakerState.failures} consecutive failures)`);
  }
}

/**
 * Record circuit breaker success
 */
function recordSuccess() {
  if (circuitBreakerState.failures > 0) {
    console.log('Circuit breaker: Resetting failure count');
  }
  circuitBreakerState.failures = 0;
  circuitBreakerState.isOpen = false;
}

/**
 * Get cached value if available and not expired
 */
function getCachedValue(key) {
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  console.log(`Cache hit: ${key}`);
  return cached.value;
}

/**
 * Set cache value
 */
function setCachedValue(key, value) {
  cache.set(key, {
    value,
    timestamp: Date.now()
  });
  console.log(`Cache set: ${key}`);
}

/**
 * Make HTTP request to ML service with retry logic
 */
async function makeMLRequest(endpoint, method = 'GET', data = null, retries = ML_RETRY_ATTEMPTS) {
  // Check circuit breaker
  if (isCircuitOpen()) {
    throw new Error('ML Service circuit breaker is OPEN - service temporarily unavailable');
  }

  const url = `${ML_SERVICE_URL}${endpoint}`;
  const config = {
    method,
    url,
    timeout: ML_REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (data && method !== 'GET') {
    config.data = data;
  } else if (data && method === 'GET') {
    config.params = data;
  }

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`ML Service request: ${method} ${endpoint} (attempt ${attempt + 1}/${retries + 1})`);

      const response = await axios(config);

      // Success - record for circuit breaker
      recordSuccess();

      return response.data;

    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (client errors)
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        console.error(`ML Service client error (${error.response.status}): ${endpoint}`);
        throw new Error(`ML Service error: ${error.response.data?.message || error.message}`);
      }

      // Log error and retry
      console.error(`ML Service request failed (attempt ${attempt + 1}): ${error.message}`);

      // Wait before retrying
      if (attempt < retries) {
        await sleep(ML_RETRY_DELAY * (attempt + 1)); // Exponential backoff
      }
    }
  }

  // All retries failed - record failure
  recordFailure();

  // Throw error
  const errorMessage = lastError.response?.data?.message || lastError.message || 'ML Service unavailable';
  throw new Error(`ML Service request failed after ${retries + 1} attempts: ${errorMessage}`);
}

/**
 * Check ML Service health
 *
 * @returns {Promise<Object>} Health status
 */
async function checkHealth() {
  try {
    const data = await makeMLRequest('/ml/health', 'GET', null, 0); // No retries for health check
    return {
      available: data.status === 'healthy',
      status: data.status,
      models: data.models,
      version: data.version
    };
  } catch (error) {
    return {
      available: false,
      status: 'unavailable',
      error: error.message
    };
  }
}

/**
 * Get sales forecast
 *
 * @param {number} days - Number of days to forecast (7, 14, or 30)
 * @returns {Promise<Object>} Forecast data
 */
async function getForecast(days = 7) {
  // Validate days parameter
  if (![7, 14, 30].includes(days)) {
    throw new Error('Days must be 7, 14, or 30');
  }

  // Check cache
  const cacheKey = `forecast_${days}d`;
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const data = await makeMLRequest('/ml/forecast', 'POST', { days });

    // Cache result
    setCachedValue(cacheKey, data);

    return data;

  } catch (error) {
    console.error('getForecast error:', error.message);

    // Return fallback/mock data if ML service is down
    return {
      forecast: [],
      summary: {
        total_predicted_sales: 0,
        average_daily_sales: 0,
        forecast_period: `${days} days`,
        generated_at: new Date().toISOString()
      },
      error: 'ML Service unavailable - using fallback data',
      fallback: true
    };
  }
}

/**
 * Get inventory predictions
 *
 * @param {number|null} productId - Optional product ID to filter
 * @returns {Promise<Object>} Inventory predictions
 */
async function getInventoryPredictions(productId = null) {
  // Check cache
  const cacheKey = productId ? `inventory_${productId}` : 'inventory_all';
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = productId ? { product_id: productId } : null;
    const data = await makeMLRequest('/ml/inventory/predictions', 'GET', params);

    // Cache result
    setCachedValue(cacheKey, data);

    return data;

  } catch (error) {
    console.error('getInventoryPredictions error:', error.message);

    // Return fallback data
    return {
      predictions: [],
      generated_at: new Date().toISOString(),
      count: 0,
      error: 'ML Service unavailable - using fallback data',
      fallback: true
    };
  }
}

/**
 * Get product recommendations
 *
 * @param {number} productId - Product ID to get recommendations for
 * @param {number} limit - Number of recommendations to return (default 5, max 10)
 * @returns {Promise<Object>} Product recommendations
 */
async function getRecommendations(productId, limit = 5) {
  // Validate parameters
  if (!productId) {
    throw new Error('Product ID is required');
  }

  if (limit < 1 || limit > 10) {
    throw new Error('Limit must be between 1 and 10');
  }

  // Check cache
  const cacheKey = `recommendations_${productId}_${limit}`;
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = { product_id: productId, limit };
    const data = await makeMLRequest('/ml/recommendations', 'GET', params);

    // Cache result
    setCachedValue(cacheKey, data);

    return data;

  } catch (error) {
    console.error('getRecommendations error:', error.message);

    // Return fallback data
    return {
      product_id: productId,
      product_name: 'Unknown',
      recommendations: [],
      count: 0,
      error: 'ML Service unavailable - using fallback data',
      fallback: true
    };
  }
}

/**
 * Get model information
 *
 * @returns {Promise<Object>} Model metadata
 */
async function getModelsInfo() {
  // Check cache
  const cacheKey = 'models_info';
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const data = await makeMLRequest('/ml/models/info', 'GET');

    // Cache result (longer TTL for model info)
    setCachedValue(cacheKey, data);

    return data;

  } catch (error) {
    console.error('getModelsInfo error:', error.message);

    return {
      forecast: null,
      inventory: null,
      recommendations: null,
      error: 'ML Service unavailable'
    };
  }
}

/**
 * Clear cache (for manual invalidation)
 */
function clearCache() {
  const size = cache.size;
  cache.clear();
  console.log(`ML Service cache cleared (${size} entries removed)`);
  return { cleared: size };
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  const entries = [];
  const now = Date.now();

  for (const [key, value] of cache.entries()) {
    const age = now - value.timestamp;
    const ttl = CACHE_TTL - age;
    entries.push({
      key,
      age: Math.round(age / 1000), // seconds
      ttl: Math.round(ttl / 1000), // seconds
      expired: ttl <= 0
    });
  }

  return {
    size: cache.size,
    ttl: CACHE_TTL / 1000, // seconds
    entries
  };
}

/**
 * Get circuit breaker status
 */
function getCircuitBreakerStatus() {
  return {
    isOpen: circuitBreakerState.isOpen,
    failures: circuitBreakerState.failures,
    threshold: circuitBreakerState.threshold,
    lastFailureTime: circuitBreakerState.lastFailureTime
      ? new Date(circuitBreakerState.lastFailureTime).toISOString()
      : null
  };
}

module.exports = {
  checkHealth,
  getForecast,
  getInventoryPredictions,
  getRecommendations,
  getModelsInfo,
  clearCache,
  getCacheStats,
  getCircuitBreakerStatus
};
