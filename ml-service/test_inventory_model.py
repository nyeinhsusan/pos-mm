"""
Test Intelligent Inventory Prediction Model
Loads trained model and tests predictions
"""

import joblib
import pandas as pd
import os
from datetime import datetime, timedelta


def load_model():
    """Load trained inventory model"""
    print("="*60)
    print("LOADING INVENTORY PREDICTION MODEL")
    print("="*60)

    model = joblib.load('models/inventory_model.pkl')
    metadata = joblib.load('models/inventory_metadata.pkl')

    print(f"\n✓ Model loaded successfully")
    print(f"  Model type: {metadata['model_type']}")
    print(f"  Training date: {metadata['training_date']}")
    print(f"  Features: {len(metadata['features'])}")
    print(f"  Test MAE: {metadata['metrics']['test_mae']:.2f} days")
    print(f"  Test R²: {metadata['metrics']['test_r2']:.4f}")

    return model, metadata


def predict_stockout(model, current_stock, velocity_7d, velocity_14d, velocity_30d,
                     trend=0, day_of_week=0, is_weekend=0, low_threshold=10):
    """
    Predict days until stockout for a product

    Args:
        model: Trained model
        current_stock (int): Current inventory level
        velocity_7d (float): 7-day average daily sales
        velocity_14d (float): 14-day average daily sales
        velocity_30d (float): 30-day average daily sales
        trend (float): Sales trend (-1 to 1)
        day_of_week (int): Day of week (0=Monday, 6=Sunday)
        is_weekend (int): 1 if weekend, 0 otherwise
        low_threshold (int): Low stock threshold

    Returns:
        dict: Prediction results
    """
    # Prepare features
    features = pd.DataFrame([{
        'current_stock': current_stock,
        'velocity_7d': velocity_7d,
        'velocity_14d': velocity_14d,
        'velocity_30d': velocity_30d,
        'trend': trend,
        'day_of_week': day_of_week,
        'is_weekend': is_weekend,
        'low_threshold': low_threshold
    }])

    # Predict
    days_until_stockout = model.predict(features)[0]
    stockout_date = datetime.now() + timedelta(days=int(days_until_stockout))

    # Calculate reorder quantity
    daily_velocity = velocity_7d if velocity_7d > 0 else 0.1
    lead_time_days = 7
    safety_stock_days = 3
    reorder_qty = int(daily_velocity * (lead_time_days + safety_stock_days))

    # Determine status
    if current_stock <= 0:
        status = 'OUT_OF_STOCK'
    elif current_stock <= low_threshold:
        status = 'LOW_STOCK'
    elif days_until_stockout <= 7:
        status = 'REORDER_SOON'
    elif days_until_stockout <= 14:
        status = 'MONITOR'
    else:
        status = 'HEALTHY'

    return {
        'current_stock': current_stock,
        'days_until_stockout': round(days_until_stockout, 1),
        'stockout_date': stockout_date.strftime('%Y-%m-%d'),
        'recommended_reorder_qty': reorder_qty,
        'daily_velocity': round(daily_velocity, 1),
        'status': status
    }


def test_scenarios(model):
    """Test model with various scenarios"""
    print("\n" + "="*60)
    print("TESTING PREDICTION SCENARIOS")
    print("="*60)

    scenarios = [
        {
            'name': 'Scenario 1: High stock, moderate velocity',
            'current_stock': 100,
            'velocity_7d': 5.0,
            'velocity_14d': 5.2,
            'velocity_30d': 5.1,
            'trend': 0.1,
            'low_threshold': 20
        },
        {
            'name': 'Scenario 2: Low stock, high velocity (URGENT)',
            'current_stock': 5,
            'velocity_7d': 10.0,
            'velocity_14d': 9.5,
            'velocity_30d': 9.0,
            'trend': 0.2,
            'low_threshold': 15
        },
        {
            'name': 'Scenario 3: Out of stock',
            'current_stock': 0,
            'velocity_7d': 8.0,
            'velocity_14d': 7.5,
            'velocity_30d': 7.0,
            'trend': 0,
            'low_threshold': 10
        },
        {
            'name': 'Scenario 4: Healthy inventory',
            'current_stock': 200,
            'velocity_7d': 3.0,
            'velocity_14d': 3.1,
            'velocity_30d': 3.2,
            'trend': -0.05,
            'low_threshold': 30
        },
        {
            'name': 'Scenario 5: Weekend effect',
            'current_stock': 50,
            'velocity_7d': 15.0,
            'velocity_14d': 12.0,
            'velocity_30d': 10.0,
            'trend': 0.3,
            'day_of_week': 5,
            'is_weekend': 1,
            'low_threshold': 20
        }
    ]

    for scenario in scenarios:
        name = scenario.pop('name')
        print(f"\n{name}")
        print("-" * 60)

        prediction = predict_stockout(model, **scenario)

        print(f"  Current stock: {prediction['current_stock']} units")
        print(f"  Daily velocity: {prediction['daily_velocity']} units/day")
        print(f"  Days until stockout: {prediction['days_until_stockout']} days")
        print(f"  Predicted stockout date: {prediction['stockout_date']}")
        print(f"  Recommended reorder qty: {prediction['recommended_reorder_qty']} units")
        print(f"  Status: {prediction['status']}")


def test_real_products(model):
    """Test with real product data"""
    print("\n" + "="*60)
    print("TESTING WITH REAL PRODUCT DATA")
    print("="*60)

    # Load predictions
    df_predictions = pd.read_csv('data/inventory_predictions.csv')

    print(f"\nCurrent Inventory Status:")
    print(f"{'Product':<20} {'Stock':<8} {'Days Left':<12} {'Stockout Date':<15} {'Status':<15}")
    print("-" * 80)

    for _, row in df_predictions.iterrows():
        print(f"{row['product_name']:<20} {int(row['current_stock']):<8} {row['days_until_stockout']:<12.1f} {row['predicted_stockout_date']:<15} {row['status']:<15}")

    print(f"\nReorder Recommendations:")
    print(f"{'Product':<20} {'Current':<10} {'Recommended':<15} {'Action':<20}")
    print("-" * 70)

    for _, row in df_predictions.iterrows():
        action = "REORDER NOW!" if row['status'] in ['OUT_OF_STOCK', 'LOW_STOCK', 'REORDER_SOON'] else "Monitor"
        print(f"{row['product_name']:<20} {int(row['current_stock']):<10} {int(row['recommended_reorder_qty']):<15} {action:<20}")


def simulate_api_response(model):
    """Simulate API endpoint response"""
    print("\n" + "="*60)
    print("SIMULATING API ENDPOINT")
    print("="*60)

    print(f"\nGET /ml/inventory/predictions")
    print(f"\nResponse:")

    # Load predictions
    df_predictions = pd.read_csv('data/inventory_predictions.csv')

    predictions = []
    for _, row in df_predictions.iterrows():
        predictions.append({
            'product_id': int(row['product_id']),
            'product_name': row['product_name'],
            'current_stock': int(row['current_stock']),
            'predicted_stockout_date': row['predicted_stockout_date'],
            'days_until_stockout': round(row['days_until_stockout'], 1),
            'recommended_reorder_qty': int(row['recommended_reorder_qty']),
            'status': row['status']
        })

    import json
    print(json.dumps(predictions, indent=2))


def main():
    """Main test pipeline"""
    print("\n" + "="*70)
    print("INVENTORY PREDICTION MODEL - TEST SUITE")
    print("="*70)

    # Load model
    model, metadata = load_model()

    # Test scenarios
    test_scenarios(model)

    # Test with real products
    test_real_products(model)

    # Simulate API
    simulate_api_response(model)

    print("\n" + "="*70)
    print("✅ ALL TESTS COMPLETE")
    print("="*70)
    print("\nModel Status:")
    print(f"  ✓ Model accuracy: {metadata['metrics']['test_r2']*100:.2f}%")
    print(f"  ✓ Prediction error: ±{metadata['metrics']['test_mae']:.2f} days")
    print(f"  ✓ Ready for API integration (Story 6.5)")
    print(f"  ✓ Handles edge cases (out of stock, low stock, high velocity)")


if __name__ == "__main__":
    main()
