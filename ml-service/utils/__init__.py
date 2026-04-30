"""
ML Service Utilities Package
Provides data extraction, preprocessing, and feature engineering tools
"""

from .db_connection import (
    get_db_connection,
    close_db_connection,
    execute_query,
    query_to_dataframe,
    test_connection
)

from .data_extraction import (
    extract_sales_history,
    extract_daily_sales_aggregates,
    extract_product_sales_history,
    extract_transaction_items,
    extract_all_ml_data
)

from .preprocessing import (
    handle_missing_values,
    remove_outliers,
    normalize_column,
    create_time_features,
    create_lag_features,
    create_rolling_features,
    split_train_test,
    prepare_forecasting_data
)

from .feature_engineering import (
    calculate_sales_velocity,
    calculate_stockout_risk,
    calculate_product_popularity,
    calculate_revenue_contribution,
    calculate_seasonality_index,
    calculate_profit_margin,
    create_transaction_basket_matrix,
    calculate_customer_frequency_features,
    create_all_features
)

__all__ = [
    # Database
    'get_db_connection',
    'close_db_connection',
    'execute_query',
    'query_to_dataframe',
    'test_connection',

    # Data Extraction
    'extract_sales_history',
    'extract_daily_sales_aggregates',
    'extract_product_sales_history',
    'extract_transaction_items',
    'extract_all_ml_data',

    # Preprocessing
    'handle_missing_values',
    'remove_outliers',
    'normalize_column',
    'create_time_features',
    'create_lag_features',
    'create_rolling_features',
    'split_train_test',
    'prepare_forecasting_data',

    # Feature Engineering
    'calculate_sales_velocity',
    'calculate_stockout_risk',
    'calculate_product_popularity',
    'calculate_revenue_contribution',
    'calculate_seasonality_index',
    'calculate_profit_margin',
    'create_transaction_basket_matrix',
    'calculate_customer_frequency_features',
    'create_all_features',
]
