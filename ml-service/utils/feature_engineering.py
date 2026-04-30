"""
Feature Engineering Utilities for ML Models
Creates derived features for better model performance
"""

import pandas as pd
import numpy as np


def calculate_sales_velocity(df, product_id_col='product_id', date_col='date', units_col='units_sold', windows=[7, 30]):
    """
    Calculate sales velocity (units sold per day) for products

    Args:
        df (pandas.DataFrame): Product sales history
        product_id_col (str): Product ID column name
        date_col (str): Date column name
        units_col (str): Units sold column name
        windows (list): List of rolling window sizes

    Returns:
        pandas.DataFrame: DataFrame with sales velocity features
    """
    df_velocity = df.copy()

    # Ensure sorted by product and date
    df_velocity = df_velocity.sort_values(by=[product_id_col, date_col]).reset_index(drop=True)

    # Calculate rolling velocities for each product
    for window in windows:
        df_velocity[f'velocity_{window}d'] = df_velocity.groupby(product_id_col)[units_col]\
            .transform(lambda x: x.rolling(window=window, min_periods=1).mean())

    print(f"✓ Calculated sales velocity features: windows={windows}")

    return df_velocity


def calculate_stockout_risk(df, stock_col='current_stock', velocity_col='velocity_7d'):
    """
    Calculate days until stockout based on current stock and sales velocity

    Args:
        df (pandas.DataFrame): Product data with stock and velocity
        stock_col (str): Current stock column name
        velocity_col (str): Sales velocity column name

    Returns:
        pandas.DataFrame: DataFrame with stockout risk features
    """
    df_risk = df.copy()

    # Days until stockout = current_stock / daily_velocity
    df_risk['days_until_stockout'] = df_risk.apply(
        lambda row: row[stock_col] / row[velocity_col] if row[velocity_col] > 0 else 9999,
        axis=1
    )

    # Clip to reasonable max (e.g., 365 days)
    df_risk['days_until_stockout'] = df_risk['days_until_stockout'].clip(upper=365)

    # Risk categories
    df_risk['stockout_risk'] = pd.cut(
        df_risk['days_until_stockout'],
        bins=[-np.inf, 7, 14, 30, np.inf],
        labels=['high', 'medium', 'low', 'none']
    )

    print(f"✓ Calculated stockout risk features")

    return df_risk


def calculate_product_popularity(df, product_id_col='product_id', transactions_col='transactions'):
    """
    Calculate product popularity scores based on transaction frequency

    Args:
        df (pandas.DataFrame): Product sales data
        product_id_col (str): Product ID column name
        transactions_col (str): Transaction count column name

    Returns:
        pandas.DataFrame: DataFrame with popularity features
    """
    df_popular = df.copy()

    # Calculate total transactions per product
    product_totals = df_popular.groupby(product_id_col)[transactions_col].sum().reset_index()
    product_totals.columns = [product_id_col, 'total_transactions']

    # Calculate popularity percentile
    product_totals['popularity_score'] = product_totals['total_transactions'].rank(pct=True)

    # Merge back
    df_popular = df_popular.merge(product_totals[[product_id_col, 'total_transactions', 'popularity_score']],
                                   on=product_id_col, how='left')

    print(f"✓ Calculated product popularity features")

    return df_popular


def calculate_revenue_contribution(df, product_id_col='product_id', revenue_col='revenue'):
    """
    Calculate each product's contribution to total revenue

    Args:
        df (pandas.DataFrame): Product sales data
        product_id_col (str): Product ID column name
        revenue_col (str): Revenue column name

    Returns:
        pandas.DataFrame: DataFrame with revenue contribution features
    """
    df_contrib = df.copy()

    # Calculate total revenue per product
    product_revenue = df_contrib.groupby(product_id_col)[revenue_col].sum().reset_index()
    product_revenue.columns = [product_id_col, 'total_revenue']

    # Calculate revenue contribution percentage
    total_revenue = product_revenue['total_revenue'].sum()
    product_revenue['revenue_contribution_pct'] = (product_revenue['total_revenue'] / total_revenue * 100)

    # Merge back
    df_contrib = df_contrib.merge(product_revenue[[product_id_col, 'total_revenue', 'revenue_contribution_pct']],
                                   on=product_id_col, how='left')

    # ABC classification (Pareto principle)
    product_revenue_sorted = product_revenue.sort_values('total_revenue', ascending=False)
    product_revenue_sorted['cumulative_revenue_pct'] = product_revenue_sorted['total_revenue'].cumsum() / total_revenue * 100

    product_revenue_sorted['abc_class'] = pd.cut(
        product_revenue_sorted['cumulative_revenue_pct'],
        bins=[-np.inf, 80, 95, np.inf],
        labels=['A', 'B', 'C']
    )

    # Merge ABC class
    df_contrib = df_contrib.merge(product_revenue_sorted[[product_id_col, 'abc_class']],
                                   on=product_id_col, how='left')

    print(f"✓ Calculated revenue contribution features")

    return df_contrib


def calculate_seasonality_index(df, date_col='date', sales_col='sales'):
    """
    Calculate seasonality index for each month/day-of-week

    Args:
        df (pandas.DataFrame): Time series sales data
        date_col (str): Date column name
        sales_col (str): Sales column name

    Returns:
        pandas.DataFrame: DataFrame with seasonality features
    """
    df_season = df.copy()

    # Ensure datetime
    df_season[date_col] = pd.to_datetime(df_season[date_col])

    # Extract time components if not already present
    if 'month' not in df_season.columns:
        df_season['month'] = df_season[date_col].dt.month
    if 'day_of_week' not in df_season.columns:
        df_season['day_of_week'] = df_season[date_col].dt.dayofweek

    # Calculate average sales
    overall_avg = df_season[sales_col].mean()

    # Monthly seasonality index
    monthly_avg = df_season.groupby('month')[sales_col].mean()
    df_season['monthly_seasonality_index'] = df_season['month'].map(monthly_avg / overall_avg)

    # Day-of-week seasonality index
    dow_avg = df_season.groupby('day_of_week')[sales_col].mean()
    df_season['dow_seasonality_index'] = df_season['day_of_week'].map(dow_avg / overall_avg)

    print(f"✓ Calculated seasonality indices")

    return df_season


def calculate_profit_margin(df, revenue_col='total_amount', cost_col='total_cost'):
    """
    Calculate profit margin percentage

    Args:
        df (pandas.DataFrame): Sales data
        revenue_col (str): Revenue column name
        cost_col (str): Cost column name

    Returns:
        pandas.DataFrame: DataFrame with profit margin features
    """
    df_margin = df.copy()

    df_margin['profit_margin_pct'] = ((df_margin[revenue_col] - df_margin[cost_col]) /
                                       df_margin[revenue_col] * 100)

    # Handle division by zero
    df_margin['profit_margin_pct'] = df_margin['profit_margin_pct'].replace([np.inf, -np.inf], 0).fillna(0)

    print(f"✓ Calculated profit margin features")

    return df_margin


def create_transaction_basket_matrix(df, transaction_col='sale_id', product_col='product_id'):
    """
    Create a transaction-product matrix for market basket analysis

    Args:
        df (pandas.DataFrame): Transaction items data
        transaction_col (str): Transaction ID column name
        product_col (str): Product ID column name

    Returns:
        pandas.DataFrame: Binary matrix (transactions x products)
    """
    # Create pivot table with binary values (1 if product in transaction, 0 otherwise)
    basket_matrix = df.groupby([transaction_col, product_col]).size().unstack(fill_value=0)

    # Convert to binary (in case of multiple quantities)
    basket_matrix = (basket_matrix > 0).astype(int)

    print(f"✓ Created transaction basket matrix: {basket_matrix.shape[0]} transactions × {basket_matrix.shape[1]} products")

    return basket_matrix


def calculate_customer_frequency_features(df, transaction_col='sale_id', date_col='date'):
    """
    Calculate transaction frequency features (transactions per day/week)

    Args:
        df (pandas.DataFrame): Sales data
        transaction_col (str): Transaction ID column
        date_col (str): Date column

    Returns:
        pandas.DataFrame: DataFrame with frequency features
    """
    df_freq = df.copy()

    # Ensure datetime
    df_freq[date_col] = pd.to_datetime(df_freq[date_col])

    # Count transactions per day
    daily_txn = df_freq.groupby(df_freq[date_col].dt.date)[transaction_col].nunique().reset_index()
    daily_txn.columns = ['date', 'transactions_per_day']
    daily_txn['date'] = pd.to_datetime(daily_txn['date'])

    # Calculate rolling averages
    daily_txn['txn_7d_avg'] = daily_txn['transactions_per_day'].rolling(window=7, min_periods=1).mean()
    daily_txn['txn_30d_avg'] = daily_txn['transactions_per_day'].rolling(window=30, min_periods=1).mean()

    # Merge back to original dataframe
    df_freq[date_col] = pd.to_datetime(df_freq[date_col].dt.date)
    df_freq = df_freq.merge(daily_txn, left_on=date_col, right_on='date', how='left', suffixes=('', '_freq'))

    print(f"✓ Calculated transaction frequency features")

    return df_freq


def create_all_features(sales_df, product_sales_df, daily_sales_df):
    """
    Create all feature engineering transformations

    Args:
        sales_df (pandas.DataFrame): Sales history
        product_sales_df (pandas.DataFrame): Product-level sales
        daily_sales_df (pandas.DataFrame): Daily aggregated sales

    Returns:
        dict: Dictionary with all featured dataframes
    """
    print("="*60)
    print("FEATURE ENGINEERING - CREATING ALL FEATURES")
    print("="*60)

    # Sales features
    sales_featured = calculate_profit_margin(sales_df)
    sales_featured = calculate_customer_frequency_features(sales_featured)

    # Product sales features
    product_featured = calculate_sales_velocity(product_sales_df)
    product_featured = calculate_stockout_risk(product_featured)
    product_featured = calculate_product_popularity(product_featured)
    product_featured = calculate_revenue_contribution(product_featured)

    # Daily sales features
    daily_featured = calculate_seasonality_index(daily_sales_df)

    print("\n" + "="*60)
    print("FEATURE ENGINEERING COMPLETE")
    print("="*60)

    return {
        'sales_featured': sales_featured,
        'product_featured': product_featured,
        'daily_featured': daily_featured
    }


if __name__ == "__main__":
    print("Feature engineering utilities loaded successfully!")
    print("\nAvailable functions:")
    print("  - calculate_sales_velocity()")
    print("  - calculate_stockout_risk()")
    print("  - calculate_product_popularity()")
    print("  - calculate_revenue_contribution()")
    print("  - calculate_seasonality_index()")
    print("  - calculate_profit_margin()")
    print("  - create_transaction_basket_matrix()")
    print("  - calculate_customer_frequency_features()")
    print("  - create_all_features()")
