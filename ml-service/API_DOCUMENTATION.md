# ML Service REST API Documentation

**Version:** 1.0.0
**Base URL:** `http://localhost:5001`
**Protocol:** HTTP/HTTPS
**Content Type:** application/json

---

## Overview

The ML Service REST API provides machine learning predictions for the POS Myanmar system. It serves three trained ML models:
1. **Sales Forecasting Model** (SARIMAX) - Predicts future sales
2. **Inventory Prediction Model** (Random Forest) - Predicts stockout dates
3. **Product Recommendation Model** (Apriori) - Suggests product recommendations

---

## Authentication

Currently, the API does not require authentication. For production deployment, consider adding API key authentication or JWT tokens.

---

## Endpoints

### 1. Health Check

**GET** `/ml/health`

Check API and model health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-04-24T21:43:05.872224",
  "models": {
    "forecast": true,
    "inventory": true,
    "recommendations": true
  },
  "errors": null,
  "version": "1.0.0"
}
```

**Status Codes:**
- `200 OK` - All models loaded successfully
- `503 Service Unavailable` - Some models failed to load

---

### 2. Sales Forecasting

**POST** `/ml/forecast`

Generate sales forecast for future days.

**Request Body:**
```json
{
  "days": 7
}
```

**Parameters:**
| Parameter | Type | Required | Description | Valid Values |
|-----------|------|----------|-------------|--------------|
| days | integer | Yes | Number of days to forecast | 7, 14, or 30 |
| category | string | No | Product category filter | "all" (future feature) |

**Response (200 OK):**
```json
{
  "forecast": [
    {
      "date": "2026-04-25",
      "predicted_sales": 352279.50,
      "lower_bound": 280000.00,
      "upper_bound": 425000.00
    },
    ...
  ],
  "summary": {
    "total_predicted_sales": 2466156.50,
    "average_daily_sales": 352279.50,
    "forecast_period": "7 days",
    "generated_at": "2026-04-24T21:43:05.872224"
  }
}
```

**Error Responses:**

**400 Bad Request** - Invalid days parameter:
```json
{
  "error": "Invalid days parameter",
  "message": "days must be 7, 14, or 30"
}
```

**404 Not Found** - Forecast data not available:
```json
{
  "error": "Forecast data not available",
  "message": "Pre-generated forecast for X days not found"
}
```

**503 Service Unavailable** - Model not loaded:
```json
{
  "error": "Forecasting model not available",
  "message": "Model failed to load on startup"
}
```

---

### 3. Inventory Predictions

**GET** `/ml/inventory/predictions`

Get stockout predictions for all products or a specific product.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| product_id | integer | No | Filter by specific product ID |

**Response (200 OK):**
```json
{
  "predictions": [
    {
      "product_id": 1,
      "product_name": "Coca-Cola 500ml",
      "current_stock": 92,
      "predicted_stockout_date": "2026-04-27",
      "days_until_stockout": 4.0,
      "daily_velocity": 25.3,
      "recommended_reorder_qty": 253,
      "status": "REORDER_SOON"
    },
    ...
  ],
  "generated_at": "2026-04-24T21:43:05.872224",
  "count": 4
}
```

**Status Values:**
| Status | Description | Action Required |
|--------|-------------|-----------------|
| `OUT_OF_STOCK` | Stock = 0 | Emergency reorder |
| `LOW_STOCK` | Stock ≤ threshold | Order today (critical) |
| `REORDER_SOON` | Days left ≤ 7 | Order this week |
| `MONITOR` | Days left ≤ 14 | Monitor daily |
| `HEALTHY` | Days left > 14 | Normal operations |

**Error Responses:**

**404 Not Found** - Product not found:
```json
{
  "error": "Product not found",
  "message": "No inventory data for product_id 999"
}
```

**404 Not Found** - Predictions not available:
```json
{
  "error": "Predictions not available",
  "message": "Run train_inventory_model.py to generate predictions"
}
```

---

### 4. Product Recommendations

**GET** `/ml/recommendations`

Get product recommendations based on market basket analysis.

**Query Parameters:**
| Parameter | Type | Required | Description | Valid Values |
|-----------|------|----------|-------------|--------------|
| product_id | integer | Yes | Product ID to get recommendations for | Any valid product ID |
| limit | integer | No | Number of recommendations to return | 1-10 (default: 5) |

**Response (200 OK):**
```json
{
  "product_id": 1,
  "product_name": "Coca-Cola 500ml",
  "recommendations": [
    {
      "product_id": 3,
      "product_name": "White Rice 5kg",
      "confidence": 0.443,
      "lift": 0.88,
      "support": 0.214
    },
    {
      "product_id": 4,
      "product_name": "Notebook A4",
      "confidence": 0.435,
      "lift": 0.86,
      "support": 0.210
    }
  ],
  "count": 2
}
```

**Metrics Explained:**
- **Confidence:** Probability that customer buying product A will also buy recommended product B (0-1)
- **Lift:** Ratio of observed co-purchase rate to expected rate if independent (>1 = positive association, <1 = negative)
- **Support:** Percentage of transactions containing both products (0-1)

**Response (200 OK) - No recommendations:**
```json
{
  "product_id": 999,
  "product_name": "Unknown",
  "recommendations": [],
  "count": 0,
  "message": "No recommendations available for this product"
}
```

**Error Responses:**

**400 Bad Request** - Missing product_id:
```json
{
  "error": "Missing required parameter",
  "message": "product_id is required"
}
```

**400 Bad Request** - Invalid limit:
```json
{
  "error": "Invalid limit parameter",
  "message": "limit must be between 1 and 10"
}
```

---

### 5. Models Info

**GET** `/ml/models/info`

Get detailed information about loaded ML models.

**Response (200 OK):**
```json
{
  "forecast": {
    "loaded": true,
    "model_type": "SARIMAX",
    "parameters": {
      "order": [1, 0, 1],
      "seasonal_order": [1, 0, 0, 7]
    }
  },
  "inventory": {
    "loaded": true,
    "model_type": "RandomForestRegressor",
    "training_date": "2026-04-24T21:28:27.627240",
    "test_mae": 0.00,
    "test_r2": 0.9999
  },
  "recommendations": {
    "loaded": true,
    "model_type": "Apriori Association Rules",
    "training_date": "2026-04-24T21:16:08.799358",
    "n_rules": 24,
    "n_products": 4
  }
}
```

---

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

**Common Status Codes:**
- `200 OK` - Request successful
- `400 Bad Request` - Invalid parameters or request body
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Model not loaded

---

## CORS Support

CORS is enabled for all origins to support Node.js backend integration. In production, restrict allowed origins:

```python
CORS(app, origins=['http://localhost:3000', 'https://yourdomain.com'])
```

---

## Rate Limiting

Currently no rate limiting is implemented. For production deployment, consider adding rate limiting:
- Max 100 requests per minute per IP
- Max 1000 requests per hour per IP

---

## Example Usage

### Using cURL

**Health Check:**
```bash
curl http://localhost:5001/ml/health
```

**Sales Forecast:**
```bash
curl -X POST http://localhost:5001/ml/forecast \
  -H "Content-Type: application/json" \
  -d '{"days": 7}'
```

**Inventory Predictions:**
```bash
curl http://localhost:5001/ml/inventory/predictions
curl http://localhost:5001/ml/inventory/predictions?product_id=1
```

**Product Recommendations:**
```bash
curl "http://localhost:5001/ml/recommendations?product_id=1&limit=3"
```

### Using Python Requests

```python
import requests

BASE_URL = 'http://localhost:5001'

# Health check
response = requests.get(f'{BASE_URL}/ml/health')
print(response.json())

# Sales forecast
response = requests.post(
    f'{BASE_URL}/ml/forecast',
    json={'days': 7}
)
forecast = response.json()
print(f"Average daily sales: {forecast['summary']['average_daily_sales']}")

# Inventory predictions
response = requests.get(f'{BASE_URL}/ml/inventory/predictions')
predictions = response.json()
for pred in predictions['predictions']:
    if pred['status'] in ['LOW_STOCK', 'OUT_OF_STOCK']:
        print(f"⚠️ {pred['product_name']}: {pred['days_until_stockout']} days left!")

# Product recommendations
response = requests.get(
    f'{BASE_URL}/ml/recommendations',
    params={'product_id': 1, 'limit': 3}
)
recs = response.json()
print(f"Recommendations for {recs['product_name']}:")
for rec in recs['recommendations']:
    print(f"  → {rec['product_name']} (confidence: {rec['confidence']:.2%})")
```

### Using JavaScript/Node.js

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:5001';

// Sales forecast
async function getForecast(days) {
  const response = await axios.post(`${BASE_URL}/ml/forecast`, { days });
  return response.data;
}

// Inventory predictions
async function getInventoryPredictions(productId = null) {
  const url = productId
    ? `${BASE_URL}/ml/inventory/predictions?product_id=${productId}`
    : `${BASE_URL}/ml/inventory/predictions`;
  const response = await axios.get(url);
  return response.data;
}

// Product recommendations
async function getRecommendations(productId, limit = 5) {
  const response = await axios.get(`${BASE_URL}/ml/recommendations`, {
    params: { product_id: productId, limit }
  });
  return response.data;
}

// Usage
(async () => {
  const forecast = await getForecast(7);
  console.log('7-day forecast:', forecast.summary);

  const inventory = await getInventoryPredictions();
  console.log('Inventory status:', inventory.predictions);

  const recs = await getRecommendations(1, 3);
  console.log('Recommendations:', recs.recommendations);
})();
```

---

## Deployment

### Local Development

```bash
# Activate virtual environment
source venv/bin/activate

# Run Flask server
python app.py
```

Server runs on `http://localhost:5001`

### Production Deployment

For production, use a WSGI server like Gunicorn:

```bash
# Install Gunicorn
pip install gunicorn

# Run with Gunicorn (4 workers)
gunicorn -w 4 -b 0.0.0.0:5001 app:app
```

### Docker Deployment

```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5001

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5001", "app:app"]
```

---

## Performance

**Model Loading:**
- All 3 models loaded on startup: ~2-3 seconds
- Models cached in memory for fast predictions

**Response Times:**
- Health check: <10ms
- Forecast: <100ms (reads from pre-generated CSV)
- Inventory predictions: <100ms (reads from pre-generated CSV)
- Product recommendations: <10ms (dictionary lookup)

**Recommendations:**
- For production, implement response caching
- Use Redis or Memcached for forecast/prediction caching
- Regenerate predictions periodically (daily)

---

## Troubleshooting

### Model fails to load

**Error:** `Model failed to load on startup`

**Solution:**
- Ensure trained models exist in `models/` directory
- Run training scripts:
  ```bash
  python train_forecast_model.py
  python train_inventory_model.py
  python train_recommendation_model.py
  ```

### Port already in use

**Error:** `Address already in use`

**Solution:**
```bash
# Kill process on port 5001
lsof -ti:5001 | xargs kill -9

# Or change port in app.py
app.run(host='0.0.0.0', port=5002, debug=True)
```

### CORS errors

**Error:** Browser blocks cross-origin requests

**Solution:**
- CORS is enabled by default
- Check browser console for specific error
- Verify `flask-cors` is installed: `pip install flask-cors`

---

## Testing

Run comprehensive test suite:

```bash
# Using test client (no server required)
python -c "from app import app; ..."

# Or run test script (requires server running)
python test_api.py
```

---

## Support

For issues or questions:
- Email: support@posmyanmar.com
- GitHub: https://github.com/posmyanmar/ml-service
- Documentation: https://docs.posmyanmar.com/ml-api

---

**Last Updated:** April 24, 2026
**Version:** 1.0.0
**Status:** ✅ Production Ready
