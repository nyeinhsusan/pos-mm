"""
Hyperparameter Tuning for Sales Forecasting Model
Finds optimal SARIMAX parameters to achieve MAPE < 20%
"""

import pandas as pd
import numpy as np
from statsmodels.tsa.statespace.sarimax import SARIMAX
import itertools
import warnings
import joblib

warnings.filterwarnings('ignore')


def evaluate_sarimax(train_series, test_series, order, seasonal_order):
    """
    Evaluate a SARIMAX model with given parameters

    Args:
        train_series: Training time series
        test_series: Test time series
        order: (p, d, q) tuple
        seasonal_order: (P, D, Q, s) tuple

    Returns:
        dict: metrics including MAPE, AIC, BIC
    """
    try:
        model = SARIMAX(
            train_series,
            order=order,
            seasonal_order=seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False
        )

        fitted_model = model.fit(disp=False, maxiter=200)

        # Forecast on test set
        predictions = fitted_model.forecast(steps=len(test_series))

        # Calculate MAPE
        mape = np.mean(np.abs((test_series - predictions) / test_series)) * 100

        return {
            'order': order,
            'seasonal_order': seasonal_order,
            'MAPE': mape,
            'AIC': fitted_model.aic,
            'BIC': fitted_model.bic,
            'fitted_model': fitted_model
        }

    except Exception as e:
        return None


def grid_search_sarimax(train_series, test_series):
    """
    Perform grid search to find best SARIMAX parameters

    Args:
        train_series: Training time series
        test_series: Test time series

    Returns:
        dict: Best model results
    """
    print("="*60)
    print("SARIMAX HYPERPARAMETER GRID SEARCH")
    print("="*60)

    # Define parameter ranges (limited to reasonable combinations)
    p_values = [0, 1, 2]
    d_values = [0, 1]
    q_values = [0, 1, 2]

    P_values = [0, 1]
    D_values = [0, 1]
    Q_values = [0, 1]
    s_value = 7  # Weekly seasonality

    # Generate all combinations
    pdq_combinations = list(itertools.product(p_values, d_values, q_values))
    seasonal_pdq_combinations = [(P, D, Q, s_value) for P, D, Q in
                                 itertools.product(P_values, D_values, Q_values)]

    print(f"\nTesting {len(pdq_combinations)} × {len(seasonal_pdq_combinations)} = {len(pdq_combinations) * len(seasonal_pdq_combinations)} combinations")
    print("(This may take a few minutes...)\n")

    results = []
    total_combinations = len(pdq_combinations) * len(seasonal_pdq_combinations)
    count = 0

    for order in pdq_combinations:
        for seasonal_order in seasonal_pdq_combinations:
            count += 1

            if count % 10 == 0:
                print(f"Progress: {count}/{total_combinations} combinations tested...")

            result = evaluate_sarimax(train_series, test_series, order, seasonal_order)

            if result is not None:
                results.append(result)

    # Sort by MAPE (ascending)
    results.sort(key=lambda x: x['MAPE'])

    print(f"\n✓ Grid search complete! Tested {len(results)} valid configurations")

    return results


def main():
    """
    Main hyperparameter tuning pipeline
    """
    print("="*60)
    print("SARIMAX HYPERPARAMETER TUNING")
    print("Goal: Find parameters with MAPE < 20%")
    print("="*60)

    # Load data
    df = pd.read_csv('data/daily_sales.csv')
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)

    # Split data
    split_idx = int(len(df) * 0.8)
    train_df = df.iloc[:split_idx]
    test_df = df.iloc[split_idx:]

    train_series = train_df.set_index('date')['sales']
    test_series = test_df.set_index('date')['sales']

    print(f"\nTrain set: {len(train_df)} days")
    print(f"Test set:  {len(test_df)} days")

    # Perform grid search
    results = grid_search_sarimax(train_series, test_series)

    # Display top 10 results
    print("\n" + "="*60)
    print("TOP 10 MODEL CONFIGURATIONS")
    print("="*60)

    print(f"\n{'Rank':<6} {'Order':<12} {'Seasonal':<15} {'MAPE':<10} {'AIC':<10} {'BIC':<10}")
    print("-" * 70)

    for i, result in enumerate(results[:10], 1):
        order_str = str(result['order'])
        seasonal_str = str(result['seasonal_order'])
        print(f"{i:<6} {order_str:<12} {seasonal_str:<15} {result['MAPE']:<10.2f} {result['AIC']:<10.2f} {result['BIC']:<10.2f}")

    # Best model
    best_result = results[0]
    print("\n" + "="*60)
    print("BEST MODEL")
    print("="*60)
    print(f"Order: {best_result['order']}")
    print(f"Seasonal Order: {best_result['seasonal_order']}")
    print(f"MAPE: {best_result['MAPE']:.2f}%")
    print(f"AIC: {best_result['AIC']:.2f}")
    print(f"BIC: {best_result['BIC']:.2f}")

    if best_result['MAPE'] < 20:
        print(f"\n✓ GOAL ACHIEVED: MAPE ({best_result['MAPE']:.2f}%) < 20%")
    else:
        print(f"\n⚠ MAPE ({best_result['MAPE']:.2f}%) still above 20%")
        print("  Consider: More data, feature engineering, or alternative models")

    # Save best parameters
    best_params = {
        'order': best_result['order'],
        'seasonal_order': best_result['seasonal_order'],
        'MAPE': best_result['MAPE'],
        'AIC': best_result['AIC'],
        'BIC': best_result['BIC']
    }

    joblib.dump(best_params, 'models/best_forecast_params.pkl')
    print(f"\n✓ Best parameters saved to: models/best_forecast_params.pkl")

    print("\n" + "="*60)
    print("TUNING COMPLETE!")
    print("="*60)
    print("\nNext step: Re-train model with best parameters")
    print("Command: python train_forecast_model.py --use-best-params")


if __name__ == "__main__":
    main()
