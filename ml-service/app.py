"""
ML Service REST API
Flask application serving ML model predictions

Endpoints:
- POST /ml/forecast - Sales forecasting predictions
- GET /ml/inventory/predictions - Inventory stockout predictions
- GET /ml/recommendations - Product recommendations
- GET /ml/health - Health check

Author: James (Dev Agent)
Date: April 24, 2026
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
import sys

# Add utils to path
sys.path.append(os.path.dirname(__file__))
from utils.db_connection import query_to_dataframe, test_connection
from utils.data_extraction import extract_daily_sales_aggregates, extract_product_sales_history

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for Node.js integration

# Global variables to store loaded models
forecast_model = None
forecast_params = None
inventory_model = None
inventory_metadata = None
recommendation_lookup = None
product_mapping = None
recommendation_metadata = None

# Model status
models_loaded = False
model_load_errors = []


def load_models():
    """Load all trained ML models on startup"""
    global forecast_model, forecast_params, inventory_model, inventory_metadata
    global recommendation_lookup, product_mapping, recommendation_metadata
    global models_loaded, model_load_errors

    print("\n" + "="*60)
    print("LOADING ML MODELS")
    print("="*60)

    models_dir = 'models'
    model_load_errors = []

    try:
        # Load sales forecasting model
        print("\n1. Loading sales forecasting model...")
        forecast_model = joblib.load(os.path.join(models_dir, 'sales_forecast_model.pkl'))
        forecast_params = joblib.load(os.path.join(models_dir, 'best_forecast_params.pkl'))
        print("   ✓ Sales forecasting model loaded")

    except Exception as e:
        error_msg = f"Failed to load forecasting model: {str(e)}"
        print(f"   ✗ {error_msg}")
        model_load_errors.append(error_msg)

    try:
        # Load inventory prediction model
        print("\n2. Loading inventory prediction model...")
        inventory_model = joblib.load(os.path.join(models_dir, 'inventory_model.pkl'))
        inventory_metadata = joblib.load(os.path.join(models_dir, 'inventory_metadata.pkl'))
        print("   ✓ Inventory prediction model loaded")

    except Exception as e:
        error_msg = f"Failed to load inventory model: {str(e)}"
        print(f"   ✗ {error_msg}")
        model_load_errors.append(error_msg)

    try:
        # Load product recommendation model
        print("\n3. Loading product recommendation model...")
        recommendation_lookup = joblib.load(os.path.join(models_dir, 'recommendation_lookup.pkl'))
        product_mapping = joblib.load(os.path.join(models_dir, 'product_mapping.pkl'))
        recommendation_metadata = joblib.load(os.path.join(models_dir, 'recommendation_metadata.pkl'))
        print("   ✓ Product recommendation model loaded")

    except Exception as e:
        error_msg = f"Failed to load recommendation model: {str(e)}"
        print(f"   ✗ {error_msg}")
        model_load_errors.append(error_msg)

    # Check if all models loaded successfully
    models_loaded = (
        forecast_model is not None and
        inventory_model is not None and
        recommendation_lookup is not None
    )

    print("\n" + "="*60)
    if models_loaded:
        print("✅ ALL MODELS LOADED SUCCESSFULLY")
    else:
        print("⚠️  SOME MODELS FAILED TO LOAD")
        for error in model_load_errors:
            print(f"   - {error}")
    print("="*60 + "\n")

    return models_loaded


# Load models on startup
load_models()


@app.route('/ml/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    Returns model status and system information
    """
    return jsonify({
        'status': 'healthy' if models_loaded else 'degraded',
        'timestamp': datetime.now().isoformat(),
        'models': {
            'forecast': forecast_model is not None,
            'inventory': inventory_model is not None,
            'recommendations': recommendation_lookup is not None
        },
        'errors': model_load_errors if model_load_errors else None,
        'version': '1.0.0'
    }), 200 if models_loaded else 503


@app.route('/ml/forecast', methods=['POST'])
def forecast_sales():
    """
    Sales forecasting endpoint

    Request body:
    {
        "days": 7 | 14 | 30,
        "category": "all" (optional)
    }

    Returns:
    {
        "forecast": [
            {
                "date": "2026-04-25",
                "predicted_sales": 352279.5,
                "lower_bound": 280000,
                "upper_bound": 425000
            },
            ...
        ],
        "summary": {
            "total_predicted_sales": 2466156.5,
            "average_daily_sales": 352279.5,
            "forecast_period": "7 days"
        }
    }
    """
    try:
        # Check if model is loaded
        if forecast_model is None:
            return jsonify({
                'error': 'Forecasting model not available',
                'message': 'Model failed to load on startup'
            }), 503

        # Parse request
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400

        days = data.get('days', 7)

        # Validate days parameter
        if days not in [7, 14, 30]:
            return jsonify({
                'error': 'Invalid days parameter',
                'message': 'days must be 7, 14, or 30'
            }), 400

        # Load forecast from CSV (pre-generated during training)
        forecast_file = f'data/forecast_{days}d.csv'

        if not os.path.exists(forecast_file):
            return jsonify({
                'error': 'Forecast data not available',
                'message': f'Pre-generated forecast for {days} days not found'
            }), 404

        df_forecast = pd.read_csv(forecast_file)

        # Format response
        forecast_data = []
        for _, row in df_forecast.iterrows():
            forecast_data.append({
                'date': row['date'],
                'predicted_sales': round(float(row['predicted_sales']), 2),
                'lower_bound': round(float(row['lower_bound']), 2),
                'upper_bound': round(float(row['upper_bound']), 2)
            })

        # Calculate summary
        total_sales = df_forecast['predicted_sales'].sum()
        avg_daily_sales = df_forecast['predicted_sales'].mean()

        return jsonify({
            'forecast': forecast_data,
            'summary': {
                'total_predicted_sales': round(float(total_sales), 2),
                'average_daily_sales': round(float(avg_daily_sales), 2),
                'forecast_period': f'{days} days',
                'generated_at': datetime.now().isoformat()
            }
        }), 200

    except Exception as e:
        return jsonify({
            'error': 'Forecast generation failed',
            'message': str(e)
        }), 500


@app.route('/ml/inventory/predictions', methods=['GET'])
def inventory_predictions():
    """
    Inventory stockout predictions endpoint

    Query parameters:
    - product_id (optional): Filter by specific product

    Returns:
    [
        {
            "product_id": 1,
            "product_name": "Coca-Cola 500ml",
            "current_stock": 92,
            "predicted_stockout_date": "2026-04-27",
            "days_until_stockout": 4.0,
            "recommended_reorder_qty": 253,
            "status": "REORDER_SOON"
        },
        ...
    ]
    """
    try:
        # Check if model is loaded
        if inventory_model is None:
            return jsonify({
                'error': 'Inventory model not available',
                'message': 'Model failed to load on startup'
            }), 503

        # Get query parameters
        product_id = request.args.get('product_id', type=int)

        # Load predictions from CSV (pre-generated during training)
        predictions_file = 'data/inventory_predictions.csv'

        if not os.path.exists(predictions_file):
            return jsonify({
                'error': 'Predictions not available',
                'message': 'Run train_inventory_model.py to generate predictions'
            }), 404

        df_predictions = pd.read_csv(predictions_file)

        # Filter by product_id if specified
        if product_id is not None:
            df_predictions = df_predictions[df_predictions['product_id'] == product_id]

            if df_predictions.empty:
                return jsonify({
                    'error': 'Product not found',
                    'message': f'No inventory data for product_id {product_id}'
                }), 404

        # Format response
        predictions = []
        for _, row in df_predictions.iterrows():
            predictions.append({
                'product_id': int(row['product_id']),
                'product_name': row['product_name'],
                'current_stock': int(row['current_stock']),
                'predicted_stockout_date': row['predicted_stockout_date'],
                'days_until_stockout': round(float(row['days_until_stockout']), 1),
                'daily_velocity': round(float(row['daily_velocity']), 1),
                'recommended_reorder_qty': int(row['recommended_reorder_qty']),
                'status': row['status']
            })

        return jsonify({
            'predictions': predictions,
            'generated_at': datetime.now().isoformat(),
            'count': len(predictions)
        }), 200

    except Exception as e:
        return jsonify({
            'error': 'Inventory prediction failed',
            'message': str(e)
        }), 500


@app.route('/ml/recommendations', methods=['GET'])
def product_recommendations():
    """
    Product recommendations endpoint

    Query parameters:
    - product_id (required): Product ID to get recommendations for
    - limit (optional): Number of recommendations (default 5)

    Returns:
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
            ...
        ]
    }
    """
    try:
        # Check if model is loaded
        if recommendation_lookup is None or product_mapping is None:
            return jsonify({
                'error': 'Recommendation model not available',
                'message': 'Model failed to load on startup'
            }), 503

        # Get query parameters
        product_id = request.args.get('product_id', type=int)
        limit = request.args.get('limit', default=5, type=int)

        # Validate product_id
        if product_id is None:
            return jsonify({
                'error': 'Missing required parameter',
                'message': 'product_id is required'
            }), 400

        # Validate limit
        if limit < 1 or limit > 10:
            return jsonify({
                'error': 'Invalid limit parameter',
                'message': 'limit must be between 1 and 10'
            }), 400

        # Get product name
        product_name = product_mapping.get(product_id, 'Unknown')

        # Get recommendations
        if product_id in recommendation_lookup:
            recs = recommendation_lookup[product_id][:limit]

            recommendations = []
            for rec in recs:
                recommendations.append({
                    'product_id': int(rec['product_id']),
                    'product_name': rec['product_name'],
                    'confidence': round(float(rec['confidence']), 3),
                    'lift': round(float(rec['lift']), 2),
                    'support': round(float(rec['support']), 3)
                })

            return jsonify({
                'product_id': product_id,
                'product_name': product_name,
                'recommendations': recommendations,
                'count': len(recommendations)
            }), 200

        else:
            # No recommendations for this product
            return jsonify({
                'product_id': product_id,
                'product_name': product_name,
                'recommendations': [],
                'count': 0,
                'message': 'No recommendations available for this product'
            }), 200

    except Exception as e:
        return jsonify({
            'error': 'Recommendation generation failed',
            'message': str(e)
        }), 500


@app.route('/ml/models/info', methods=['GET'])
def models_info():
    """
    Get information about loaded models

    Returns model metadata and performance metrics
    """
    try:
        info = {
            'forecast': None,
            'inventory': None,
            'recommendations': None
        }

        if forecast_model is not None and forecast_params is not None:
            info['forecast'] = {
                'loaded': True,
                'model_type': 'SARIMAX',
                'parameters': forecast_params
            }

        if inventory_model is not None and inventory_metadata is not None:
            info['inventory'] = {
                'loaded': True,
                'model_type': inventory_metadata['model_type'],
                'training_date': inventory_metadata['training_date'],
                'test_mae': inventory_metadata['metrics']['test_mae'],
                'test_r2': inventory_metadata['metrics']['test_r2']
            }

        if recommendation_lookup is not None and recommendation_metadata is not None:
            info['recommendations'] = {
                'loaded': True,
                'model_type': recommendation_metadata['model_type'],
                'training_date': recommendation_metadata['training_date'],
                'n_rules': recommendation_metadata['n_rules'],
                'n_products': recommendation_metadata['n_products_with_recommendations']
            }

        return jsonify(info), 200

    except Exception as e:
        return jsonify({
            'error': 'Failed to retrieve model info',
            'message': str(e)
        }), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'error': 'Endpoint not found',
        'message': 'The requested endpoint does not exist'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500


if __name__ == '__main__':
    print("\n" + "="*70)
    print("ML SERVICE REST API")
    print("="*70)
    print("\nAvailable endpoints:")
    print("  GET  /ml/health                    - Health check")
    print("  POST /ml/forecast                  - Sales forecasting")
    print("  GET  /ml/inventory/predictions     - Inventory stockout predictions")
    print("  GET  /ml/recommendations           - Product recommendations")
    print("  GET  /ml/models/info               - Model information")
    print("\n" + "="*70)
    print("Starting Flask server...")
    print("="*70 + "\n")

    # Run Flask app
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True
    )
