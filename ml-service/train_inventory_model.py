"""
Intelligent Inventory Prediction Model Training Script
Uses Random Forest/Gradient Boosting to predict stockout dates

This script:
1. Extracts product-level sales and inventory data
2. Engineers features: sales velocity, seasonality, trends
3. Trains ML model to predict "days until stockout"
4. Calculates recommended reorder quantities
5. Evaluates model performance (MAE, RMSE)
6. Saves trained model to disk

Model Type: Random Forest Regressor / Gradient Boosting Regressor
Target: Predict days until stockout for each product
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
import sys
import joblib
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib.pyplot as plt
import seaborn as sns

# Add utils to path
sys.path.append(os.path.dirname(__file__))
from utils.data_extraction import extract_product_sales_history
from utils.db_connection import test_connection, query_to_dataframe


def get_current_inventory():
    """
    Get current inventory levels for all products

    Returns:
        DataFrame: Product inventory data
    """
    query = """
        SELECT
            product_id,
            name as product_name,
            category,
            price,
            cost_price,
            stock_quantity,
            low_stock_threshold
        FROM products
    """

    df = query_to_dataframe(query)
    return df


def calculate_sales_velocity(df_sales):
    """
    Calculate sales velocity metrics for each product

    Args:
        df_sales (DataFrame): Product sales history

    Returns:
        DataFrame: Sales velocity metrics per product
    """
    print("\n" + "="*60)
    print("CALCULATING SALES VELOCITY METRICS")
    print("="*60)

    # Group by product and calculate velocity
    velocity_metrics = []

    for product_id in df_sales['product_id'].unique():
        df_product = df_sales[df_sales['product_id'] == product_id].copy()
        df_product = df_product.sort_values('date')

        # Calculate daily sales
        df_product['units_sold'] = df_product['units_sold'].fillna(0)

        # 7-day average velocity
        velocity_7d = df_product.tail(7)['units_sold'].mean()

        # 14-day average velocity
        velocity_14d = df_product.tail(14)['units_sold'].mean()

        # 30-day average velocity
        velocity_30d = df_product.tail(30)['units_sold'].mean()

        # Overall average
        velocity_overall = df_product['units_sold'].mean()

        # Trend (last 7 days vs previous 7 days)
        last_7d = df_product.tail(7)['units_sold'].mean()
        prev_7d = df_product.tail(14).head(7)['units_sold'].mean()
        trend = (last_7d - prev_7d) / prev_7d if prev_7d > 0 else 0

        # Seasonality indicators
        df_product['day_of_week'] = pd.to_datetime(df_product['date']).dt.dayofweek
        weekend_avg = df_product[df_product['day_of_week'].isin([5, 6])]['units_sold'].mean()
        weekday_avg = df_product[~df_product['day_of_week'].isin([5, 6])]['units_sold'].mean()

        velocity_metrics.append({
            'product_id': product_id,
            'product_name': df_product['product_name'].iloc[0],
            'category': df_product['category'].iloc[0],
            'velocity_7d': velocity_7d,
            'velocity_14d': velocity_14d,
            'velocity_30d': velocity_30d,
            'velocity_overall': velocity_overall,
            'trend': trend,
            'weekend_avg': weekend_avg if not pd.isna(weekend_avg) else 0,
            'weekday_avg': weekday_avg if not pd.isna(weekday_avg) else 0,
            'days_of_data': len(df_product)
        })

    df_velocity = pd.DataFrame(velocity_metrics)

    print(f"\n✓ Calculated velocity metrics for {len(df_velocity)} products")
    print(f"\nVelocity Summary:")
    print(df_velocity[['product_name', 'velocity_7d', 'velocity_30d', 'trend']].to_string(index=False))

    return df_velocity


def prepare_training_data(df_sales, df_inventory):
    """
    Prepare training dataset for inventory prediction

    Creates features and target variable:
    - Features: velocity metrics, current stock, day of week, seasonality
    - Target: days until stockout (simulated from historical data)

    Args:
        df_sales (DataFrame): Product sales history
        df_inventory (DataFrame): Current inventory levels

    Returns:
        DataFrame: Training data with features and target
    """
    print("\n" + "="*60)
    print("PREPARING TRAINING DATA")
    print("="*60)

    training_data = []

    for product_id in df_sales['product_id'].unique():
        df_product = df_sales[df_sales['product_id'] == product_id].copy()
        df_product = df_product.sort_values('date')

        # Get current inventory for this product
        product_inv = df_inventory[df_inventory['product_id'] == product_id]

        if product_inv.empty:
            print(f"  ⚠️  No inventory data for product {product_id}, skipping")
            continue

        current_stock = product_inv['stock_quantity'].iloc[0]
        low_threshold = product_inv['low_stock_threshold'].iloc[0]
        product_name = product_inv['product_name'].iloc[0]
        category = product_inv['category'].iloc[0]

        # Simulate historical stockout scenarios
        # For each day in history, calculate "days until stockout" if we had that stock level
        for idx in range(len(df_product) - 30):  # Use data up to 30 days before end
            window_start = idx
            window_end = idx + 30

            # Features from current window
            window_data = df_product.iloc[window_start:window_end]

            # Calculate velocity from this window
            velocity_7d = window_data.tail(7)['units_sold'].mean()
            velocity_14d = window_data.tail(14)['units_sold'].mean()
            velocity_30d = window_data['units_sold'].mean()

            # Trend
            last_7d = window_data.tail(7)['units_sold'].mean()
            prev_7d = window_data.tail(14).head(7)['units_sold'].mean()
            trend = (last_7d - prev_7d) / prev_7d if prev_7d > 0 else 0

            # Seasonality
            date = window_data.iloc[-1]['date']
            day_of_week = pd.to_datetime(date).dayofweek
            is_weekend = 1 if day_of_week in [5, 6] else 0

            # Simulate stock level (assume we had X units at this point)
            # Use a range of stock levels for training diversity
            for simulated_stock in [10, 20, 30, 50, 75, 100]:
                # Calculate days until stockout
                # Target: how many days until stock runs out at current velocity
                if velocity_7d > 0:
                    days_until_stockout = simulated_stock / velocity_7d
                else:
                    days_until_stockout = 999  # Very high if no sales

                # Cap at reasonable maximum
                days_until_stockout = min(days_until_stockout, 180)

                training_data.append({
                    'product_id': product_id,
                    'product_name': product_name,
                    'category': category,
                    'current_stock': simulated_stock,
                    'velocity_7d': velocity_7d,
                    'velocity_14d': velocity_14d,
                    'velocity_30d': velocity_30d,
                    'trend': trend,
                    'day_of_week': day_of_week,
                    'is_weekend': is_weekend,
                    'low_threshold': low_threshold,
                    'days_until_stockout': days_until_stockout
                })

    df_training = pd.DataFrame(training_data)

    print(f"\n✓ Created {len(df_training)} training examples")
    print(f"  Products: {df_training['product_id'].nunique()}")
    print(f"  Features: {df_training.shape[1] - 1}")  # Exclude target
    print(f"\nTarget Variable Statistics:")
    print(f"  Mean days until stockout: {df_training['days_until_stockout'].mean():.1f}")
    print(f"  Median: {df_training['days_until_stockout'].median():.1f}")
    print(f"  Min: {df_training['days_until_stockout'].min():.1f}")
    print(f"  Max: {df_training['days_until_stockout'].max():.1f}")

    return df_training


def train_model(df_training, model_type='random_forest'):
    """
    Train inventory prediction model

    Args:
        df_training (DataFrame): Training data
        model_type (str): 'random_forest' or 'gradient_boosting'

    Returns:
        model: Trained model
        dict: Training metrics
    """
    print("\n" + "="*60)
    print(f"TRAINING {model_type.upper().replace('_', ' ')} MODEL")
    print("="*60)

    # Prepare features and target
    feature_cols = ['current_stock', 'velocity_7d', 'velocity_14d', 'velocity_30d',
                    'trend', 'day_of_week', 'is_weekend', 'low_threshold']

    X = df_training[feature_cols]
    y = df_training['days_until_stockout']

    print(f"\nFeatures ({len(feature_cols)}):")
    for col in feature_cols:
        print(f"  - {col}")

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print(f"\nDataset Split:")
    print(f"  Training set: {len(X_train)} examples")
    print(f"  Test set: {len(X_test)} examples")

    # Initialize model
    if model_type == 'random_forest':
        model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
    else:  # gradient_boosting
        model = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42
        )

    print(f"\nModel: {model.__class__.__name__}")
    print(f"Parameters: {model.get_params()}")

    # Train model
    print(f"\nTraining...")
    model.fit(X_train, y_train)
    print(f"✓ Training complete")

    # Predictions
    y_train_pred = model.predict(X_train)
    y_test_pred = model.predict(X_test)

    # Evaluate
    train_mae = mean_absolute_error(y_train, y_train_pred)
    test_mae = mean_absolute_error(y_test, y_test_pred)

    train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))
    test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))

    train_r2 = r2_score(y_train, y_train_pred)
    test_r2 = r2_score(y_test, y_test_pred)

    print(f"\n{'='*60}")
    print("MODEL PERFORMANCE")
    print(f"{'='*60}")
    print(f"\nTraining Set:")
    print(f"  MAE:  {train_mae:.2f} days")
    print(f"  RMSE: {train_rmse:.2f} days")
    print(f"  R²:   {train_r2:.4f}")

    print(f"\nTest Set:")
    print(f"  MAE:  {test_mae:.2f} days")
    print(f"  RMSE: {test_rmse:.2f} days")
    print(f"  R²:   {test_r2:.4f}")

    # Feature importance
    if hasattr(model, 'feature_importances_'):
        print(f"\nFeature Importance:")
        importances = pd.DataFrame({
            'feature': feature_cols,
            'importance': model.feature_importances_
        }).sort_values('importance', ascending=False)

        for _, row in importances.iterrows():
            print(f"  {row['feature']:<20} {row['importance']:.4f}")

    metrics = {
        'train_mae': train_mae,
        'test_mae': test_mae,
        'train_rmse': train_rmse,
        'test_rmse': test_rmse,
        'train_r2': train_r2,
        'test_r2': test_r2,
        'feature_importances': dict(zip(feature_cols, model.feature_importances_)) if hasattr(model, 'feature_importances_') else {}
    }

    return model, metrics, X_test, y_test, y_test_pred


def calculate_reorder_quantity(daily_velocity, lead_time_days=7, safety_stock_days=3):
    """
    Calculate recommended reorder quantity

    Formula: (daily_velocity * lead_time) + (daily_velocity * safety_stock_days)

    Args:
        daily_velocity (float): Average daily sales velocity
        lead_time_days (int): Days to receive new stock
        safety_stock_days (int): Extra days of buffer stock

    Returns:
        int: Recommended reorder quantity
    """
    reorder_qty = daily_velocity * (lead_time_days + safety_stock_days)
    return int(np.ceil(reorder_qty))


def predict_inventory(model, df_inventory, df_velocity):
    """
    Generate inventory predictions for all products

    Args:
        model: Trained model
        df_inventory (DataFrame): Current inventory
        df_velocity (DataFrame): Sales velocity metrics

    Returns:
        DataFrame: Predictions with stockout dates and reorder quantities
    """
    print("\n" + "="*60)
    print("GENERATING INVENTORY PREDICTIONS")
    print("="*60)

    predictions = []

    # Merge inventory with velocity
    df_merged = df_inventory.merge(df_velocity, on='product_id', how='left')

    for _, row in df_merged.iterrows():
        product_id = row['product_id']
        product_name = row['product_name_x']
        current_stock = row['stock_quantity']
        velocity_7d = row.get('velocity_7d', 0)
        velocity_14d = row.get('velocity_14d', 0)
        velocity_30d = row.get('velocity_30d', 0)
        trend = row.get('trend', 0)
        low_threshold = row['low_stock_threshold']

        # Current day of week
        today_dow = datetime.now().weekday()
        is_weekend = 1 if today_dow in [5, 6] else 0

        # Prepare features
        features = pd.DataFrame([{
            'current_stock': current_stock,
            'velocity_7d': velocity_7d if not pd.isna(velocity_7d) else 0,
            'velocity_14d': velocity_14d if not pd.isna(velocity_14d) else 0,
            'velocity_30d': velocity_30d if not pd.isna(velocity_30d) else 0,
            'trend': trend if not pd.isna(trend) else 0,
            'day_of_week': today_dow,
            'is_weekend': is_weekend,
            'low_threshold': low_threshold
        }])

        # Predict days until stockout
        days_until_stockout = model.predict(features)[0]

        # Calculate stockout date
        stockout_date = datetime.now() + timedelta(days=int(days_until_stockout))

        # Calculate recommended reorder quantity
        daily_velocity = velocity_7d if velocity_7d > 0 else 0.1
        reorder_qty = calculate_reorder_quantity(daily_velocity)

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

        predictions.append({
            'product_id': product_id,
            'product_name': product_name,
            'current_stock': current_stock,
            'daily_velocity': daily_velocity,
            'days_until_stockout': round(days_until_stockout, 1),
            'predicted_stockout_date': stockout_date.strftime('%Y-%m-%d'),
            'recommended_reorder_qty': reorder_qty,
            'status': status
        })

    df_predictions = pd.DataFrame(predictions)

    print(f"\n✓ Generated predictions for {len(df_predictions)} products")
    print(f"\nInventory Status Summary:")
    print(df_predictions['status'].value_counts().to_string())

    print(f"\nPredictions:")
    print(df_predictions[['product_name', 'current_stock', 'days_until_stockout', 'status']].to_string(index=False))

    return df_predictions


def save_model(model, metrics, feature_cols, output_dir='models'):
    """
    Save trained model and metadata

    Args:
        model: Trained model
        metrics (dict): Performance metrics
        feature_cols (list): Feature column names
        output_dir (str): Output directory
    """
    print("\n" + "="*60)
    print("SAVING MODEL TO DISK")
    print("="*60)

    os.makedirs(output_dir, exist_ok=True)

    # Save model
    model_path = os.path.join(output_dir, 'inventory_model.pkl')
    joblib.dump(model, model_path)
    print(f"✓ Saved model: {model_path}")

    # Save metadata
    metadata = {
        'model_type': model.__class__.__name__,
        'training_date': datetime.now().isoformat(),
        'features': feature_cols,
        'metrics': metrics,
        'lead_time_days': 7,
        'safety_stock_days': 3
    }

    metadata_path = os.path.join(output_dir, 'inventory_metadata.pkl')
    joblib.dump(metadata, metadata_path)
    print(f"✓ Saved metadata: {metadata_path}")

    print(f"\n✅ MODEL SAVED SUCCESSFULLY")


def main():
    """Main training pipeline"""
    print("\n" + "="*70)
    print("INTELLIGENT INVENTORY PREDICTION MODEL - TRAINING SCRIPT")
    print("Algorithm: Random Forest Regressor")
    print("="*70)

    # Test database connection
    print("\n1. Testing database connection...")
    if not test_connection():
        print("❌ Database connection failed!")
        return

    # Extract data
    print("\n2. Extracting product sales history...")
    df_sales = extract_product_sales_history(days=180, export_csv=True)

    if df_sales.empty:
        print("❌ No sales data found!")
        return

    print("\n3. Getting current inventory levels...")
    df_inventory = get_current_inventory()
    print(f"✓ Retrieved inventory for {len(df_inventory)} products")

    # Calculate velocity metrics
    print("\n4. Calculating sales velocity metrics...")
    df_velocity = calculate_sales_velocity(df_sales)

    # Prepare training data
    print("\n5. Preparing training data...")
    df_training = prepare_training_data(df_sales, df_inventory)

    # Train model
    print("\n6. Training model...")
    model, metrics, X_test, y_test, y_test_pred = train_model(df_training, model_type='random_forest')

    # Generate predictions for current inventory
    print("\n7. Generating inventory predictions...")
    df_predictions = predict_inventory(model, df_inventory, df_velocity)

    # Save model
    feature_cols = ['current_stock', 'velocity_7d', 'velocity_14d', 'velocity_30d',
                    'trend', 'day_of_week', 'is_weekend', 'low_threshold']
    print("\n8. Saving model...")
    save_model(model, metrics, feature_cols)

    # Save predictions
    predictions_path = 'data/inventory_predictions.csv'
    df_predictions.to_csv(predictions_path, index=False)
    print(f"\n✓ Saved predictions: {predictions_path}")

    print("\n" + "="*70)
    print("✅ TRAINING COMPLETE")
    print("="*70)
    print("\nModel Performance:")
    print(f"  Test MAE:  {metrics['test_mae']:.2f} days")
    print(f"  Test RMSE: {metrics['test_rmse']:.2f} days")
    print(f"  Test R²:   {metrics['test_r2']:.4f}")
    print("\nNext steps:")
    print("  1. Review model performance metrics")
    print("  2. Integrate with Flask API (Story 6.5)")
    print("  3. Test predictions with real inventory data")


if __name__ == "__main__":
    main()
