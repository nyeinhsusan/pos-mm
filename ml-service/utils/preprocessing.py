"""
Data Preprocessing Utilities for ML Models
Handles missing values, outliers, and data cleaning
"""

import pandas as pd
import numpy as np
from scipy import stats


def handle_missing_values(df, strategy='forward_fill'):
    """
    Handle missing values in the dataset

    Args:
        df (pandas.DataFrame): Input dataframe
        strategy (str): Strategy to handle missing values
            - 'forward_fill': Forward fill missing values
            - 'backward_fill': Backward fill missing values
            - 'mean': Fill with column mean (numeric only)
            - 'median': Fill with column median (numeric only)
            - 'zero': Fill with zeros
            - 'drop': Drop rows with missing values

    Returns:
        pandas.DataFrame: DataFrame with handled missing values
    """
    df_clean = df.copy()

    print(f"Missing values before: {df_clean.isnull().sum().sum()}")

    if strategy == 'forward_fill':
        df_clean = df_clean.fillna(method='ffill')
    elif strategy == 'backward_fill':
        df_clean = df_clean.fillna(method='bfill')
    elif strategy == 'mean':
        numeric_cols = df_clean.select_dtypes(include=[np.number]).columns
        df_clean[numeric_cols] = df_clean[numeric_cols].fillna(df_clean[numeric_cols].mean())
    elif strategy == 'median':
        numeric_cols = df_clean.select_dtypes(include=[np.number]).columns
        df_clean[numeric_cols] = df_clean[numeric_cols].fillna(df_clean[numeric_cols].median())
    elif strategy == 'zero':
        df_clean = df_clean.fillna(0)
    elif strategy == 'drop':
        df_clean = df_clean.dropna()

    print(f"Missing values after:  {df_clean.isnull().sum().sum()}")

    return df_clean


def remove_outliers(df, column, method='iqr', threshold=1.5):
    """
    Remove outliers from a specific column

    Args:
        df (pandas.DataFrame): Input dataframe
        column (str): Column name to check for outliers
        method (str): Method to detect outliers
            - 'iqr': Interquartile Range method
            - 'zscore': Z-score method
        threshold (float): Threshold for outlier detection
            - For IQR: typically 1.5 (default)
            - For Z-score: typically 3

    Returns:
        pandas.DataFrame: DataFrame with outliers removed
    """
    df_clean = df.copy()
    initial_count = len(df_clean)

    if method == 'iqr':
        Q1 = df_clean[column].quantile(0.25)
        Q3 = df_clean[column].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - threshold * IQR
        upper_bound = Q3 + threshold * IQR
        df_clean = df_clean[(df_clean[column] >= lower_bound) & (df_clean[column] <= upper_bound)]

    elif method == 'zscore':
        z_scores = np.abs(stats.zscore(df_clean[column]))
        df_clean = df_clean[z_scores < threshold]

    removed_count = initial_count - len(df_clean)
    print(f"Removed {removed_count} outliers from '{column}' ({removed_count/initial_count*100:.1f}%)")

    return df_clean


def normalize_column(df, column, method='minmax'):
    """
    Normalize a numeric column

    Args:
        df (pandas.DataFrame): Input dataframe
        column (str): Column name to normalize
        method (str): Normalization method
            - 'minmax': Min-Max scaling to [0, 1]
            - 'zscore': Z-score standardization (mean=0, std=1)

    Returns:
        pandas.DataFrame: DataFrame with normalized column
    """
    df_normalized = df.copy()

    if method == 'minmax':
        min_val = df_normalized[column].min()
        max_val = df_normalized[column].max()
        df_normalized[f'{column}_normalized'] = (df_normalized[column] - min_val) / (max_val - min_val)

    elif method == 'zscore':
        mean_val = df_normalized[column].mean()
        std_val = df_normalized[column].std()
        df_normalized[f'{column}_normalized'] = (df_normalized[column] - mean_val) / std_val

    print(f"✓ Normalized '{column}' using {method} method")

    return df_normalized


def create_time_features(df, date_column='date'):
    """
    Create time-based features from a date column

    Args:
        df (pandas.DataFrame): Input dataframe
        date_column (str): Name of the date column

    Returns:
        pandas.DataFrame: DataFrame with added time features
    """
    df_features = df.copy()

    # Ensure datetime type
    if not pd.api.types.is_datetime64_any_dtype(df_features[date_column]):
        df_features[date_column] = pd.to_datetime(df_features[date_column])

    # Extract time features
    df_features['year'] = df_features[date_column].dt.year
    df_features['month'] = df_features[date_column].dt.month
    df_features['day'] = df_features[date_column].dt.day
    df_features['day_of_week'] = df_features[date_column].dt.dayofweek  # 0=Monday
    df_features['week_of_year'] = df_features[date_column].dt.isocalendar().week
    df_features['quarter'] = df_features[date_column].dt.quarter

    # Boolean features
    df_features['is_weekend'] = df_features['day_of_week'].isin([5, 6]).astype(int)
    df_features['is_month_start'] = (df_features['day'] <= 7).astype(int)
    df_features['is_month_end'] = (df_features['day'] >= 25).astype(int)

    print(f"✓ Created time features from '{date_column}'")

    return df_features


def create_lag_features(df, column, lags=[1, 7, 30]):
    """
    Create lag features for time series data

    Args:
        df (pandas.DataFrame): Input dataframe (must be sorted by time)
        column (str): Column to create lags for
        lags (list): List of lag periods

    Returns:
        pandas.DataFrame: DataFrame with lag features
    """
    df_lagged = df.copy()

    for lag in lags:
        df_lagged[f'{column}_lag_{lag}'] = df_lagged[column].shift(lag)

    print(f"✓ Created lag features for '{column}': lags={lags}")

    return df_lagged


def create_rolling_features(df, column, windows=[7, 14, 30]):
    """
    Create rolling window features (moving averages, etc.)

    Args:
        df (pandas.DataFrame): Input dataframe (must be sorted by time)
        column (str): Column to create rolling features for
        windows (list): List of window sizes (in days/rows)

    Returns:
        pandas.DataFrame: DataFrame with rolling features
    """
    df_rolling = df.copy()

    for window in windows:
        df_rolling[f'{column}_rolling_mean_{window}'] = df_rolling[column].rolling(window=window).mean()
        df_rolling[f'{column}_rolling_std_{window}'] = df_rolling[column].rolling(window=window).std()
        df_rolling[f'{column}_rolling_min_{window}'] = df_rolling[column].rolling(window=window).min()
        df_rolling[f'{column}_rolling_max_{window}'] = df_rolling[column].rolling(window=window).max()

    print(f"✓ Created rolling features for '{column}': windows={windows}")

    return df_rolling


def split_train_test(df, test_size=0.2, time_based=True, date_column='date'):
    """
    Split data into train and test sets

    Args:
        df (pandas.DataFrame): Input dataframe
        test_size (float): Proportion of data to use for testing (0-1)
        time_based (bool): If True, use time-based split (last N% as test)
                           If False, use random split
        date_column (str): Date column for time-based split

    Returns:
        tuple: (train_df, test_df)
    """
    if time_based:
        # Sort by date
        df_sorted = df.sort_values(by=date_column).reset_index(drop=True)
        split_idx = int(len(df_sorted) * (1 - test_size))
        train_df = df_sorted.iloc[:split_idx]
        test_df = df_sorted.iloc[split_idx:]

        print(f"✓ Time-based split: Train={len(train_df)}, Test={len(test_df)}")
        print(f"  Train date range: {train_df[date_column].min()} to {train_df[date_column].max()}")
        print(f"  Test date range:  {test_df[date_column].min()} to {test_df[date_column].max()}")
    else:
        # Random split
        from sklearn.model_selection import train_test_split
        train_df, test_df = train_test_split(df, test_size=test_size, random_state=42)

        print(f"✓ Random split: Train={len(train_df)}, Test={len(test_df)}")

    return train_df, test_df


def prepare_forecasting_data(df, target_column='sales', date_column='date'):
    """
    Prepare data specifically for time series forecasting

    Args:
        df (pandas.DataFrame): Input dataframe
        target_column (str): Target variable to forecast
        date_column (str): Date column

    Returns:
        pandas.DataFrame: Prepared forecasting dataframe
    """
    df_forecast = df.copy()

    # Ensure datetime
    df_forecast[date_column] = pd.to_datetime(df_forecast[date_column])

    # Sort by date
    df_forecast = df_forecast.sort_values(by=date_column).reset_index(drop=True)

    # Create time features
    df_forecast = create_time_features(df_forecast, date_column)

    # Create lag features
    df_forecast = create_lag_features(df_forecast, target_column, lags=[1, 7, 14, 30])

    # Create rolling features
    df_forecast = create_rolling_features(df_forecast, target_column, windows=[7, 14, 30])

    # Handle missing values (from lag/rolling operations)
    df_forecast = handle_missing_values(df_forecast, strategy='backward_fill')

    print(f"✓ Prepared forecasting data: {len(df_forecast)} rows, {len(df_forecast.columns)} columns")

    return df_forecast


if __name__ == "__main__":
    # Example usage
    print("Preprocessing utilities loaded successfully!")
    print("\nAvailable functions:")
    print("  - handle_missing_values()")
    print("  - remove_outliers()")
    print("  - normalize_column()")
    print("  - create_time_features()")
    print("  - create_lag_features()")
    print("  - create_rolling_features()")
    print("  - split_train_test()")
    print("  - prepare_forecasting_data()")
