"""
Data Extraction Utilities for ML Training
Extracts historical sales data from MySQL for model training
"""

import pandas as pd
from datetime import datetime, timedelta
from .db_connection import query_to_dataframe
import os


def extract_sales_history(days=180, export_csv=True):
    """
    Extract sales history for the specified number of days

    Args:
        days (int): Number of days of history to extract
        export_csv (bool): Whether to export to CSV file

    Returns:
        pandas.DataFrame: Sales history data
    """
    query = """
        SELECT
            s.sale_id,
            s.sale_date,
            s.total_amount,
            s.total_cost,
            s.profit,
            s.user_id,
            u.full_name as cashier_name,
            COUNT(si.sale_item_id) as items_count
        FROM sales s
        LEFT JOIN users u ON s.user_id = u.user_id
        LEFT JOIN sale_items si ON s.sale_id = si.sale_id
        WHERE s.sale_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
        GROUP BY s.sale_id
        ORDER BY s.sale_date ASC
    """

    print(f"Extracting sales history for last {days} days...")
    df = query_to_dataframe(query, (days,))

    if not df.empty:
        # Convert sale_date to datetime
        df['sale_date'] = pd.to_datetime(df['sale_date'])

        # Extract date features
        df['date'] = df['sale_date'].dt.date
        df['year'] = df['sale_date'].dt.year
        df['month'] = df['sale_date'].dt.month
        df['day'] = df['sale_date'].dt.day
        df['day_of_week'] = df['sale_date'].dt.dayofweek  # 0=Monday, 6=Sunday
        df['week_of_year'] = df['sale_date'].dt.isocalendar().week
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)

        print(f"✓ Extracted {len(df)} sales records")
        print(f"  Date range: {df['sale_date'].min()} to {df['sale_date'].max()}")
        print(f"  Total revenue: {df['total_amount'].sum():,.2f} MMK")

        if export_csv:
            output_path = os.path.join(os.path.dirname(__file__), '../data/sales_history.csv')
            df.to_csv(output_path, index=False)
            print(f"✓ Exported to: {output_path}")

    return df


def extract_daily_sales_aggregates(days=180, export_csv=True):
    """
    Extract daily aggregated sales data (for forecasting)

    Args:
        days (int): Number of days of history to extract
        export_csv (bool): Whether to export to CSV file

    Returns:
        pandas.DataFrame: Daily sales aggregates
    """
    query = """
        SELECT
            DATE(sale_date) as date,
            COUNT(sale_id) as transactions,
            SUM(total_amount) as sales,
            SUM(total_cost) as costs,
            SUM(profit) as profit,
            AVG(total_amount) as avg_transaction_value
        FROM sales
        WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
        GROUP BY DATE(sale_date)
        ORDER BY date ASC
    """

    print(f"Extracting daily sales aggregates for last {days} days...")
    df = query_to_dataframe(query, (days,))

    if not df.empty:
        # Convert date to datetime
        df['date'] = pd.to_datetime(df['date'])

        # Add time features
        df['day_of_week'] = df['date'].dt.dayofweek
        df['month'] = df['date'].dt.month
        df['week_of_year'] = df['date'].dt.isocalendar().week
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        df['is_month_end'] = (df['date'].dt.day >= 25).astype(int)

        print(f"✓ Extracted {len(df)} days of sales data")
        print(f"  Average daily sales: {df['sales'].mean():,.2f} MMK")
        print(f"  Average transactions/day: {df['transactions'].mean():.1f}")

        if export_csv:
            output_path = os.path.join(os.path.dirname(__file__), '../data/daily_sales.csv')
            df.to_csv(output_path, index=False)
            print(f"✓ Exported to: {output_path}")

    return df


def extract_product_sales_history(days=180, export_csv=True):
    """
    Extract product-level sales history (for inventory prediction)

    Args:
        days (int): Number of days of history to extract
        export_csv (bool): Whether to export to CSV file

    Returns:
        pandas.DataFrame: Product sales history
    """
    query = """
        SELECT
            p.product_id,
            p.name as product_name,
            p.category,
            p.price,
            p.cost_price,
            p.stock_quantity as current_stock,
            p.low_stock_threshold,
            DATE(s.sale_date) as date,
            SUM(si.quantity) as units_sold,
            COUNT(DISTINCT s.sale_id) as transactions,
            SUM(si.subtotal) as revenue
        FROM products p
        LEFT JOIN sale_items si ON p.product_id = si.product_id
        LEFT JOIN sales s ON si.sale_id = s.sale_id
        WHERE s.sale_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
        GROUP BY p.product_id, DATE(s.sale_date)
        ORDER BY p.product_id, date ASC
    """

    print(f"Extracting product sales history for last {days} days...")
    df = query_to_dataframe(query, (days,))

    if not df.empty:
        # Convert date to datetime
        df['date'] = pd.to_datetime(df['date'])

        # Add time features
        df['day_of_week'] = df['date'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)

        print(f"✓ Extracted {len(df)} product-day records")
        print(f"  Unique products: {df['product_id'].nunique()}")

        if export_csv:
            output_path = os.path.join(os.path.dirname(__file__), '../data/product_sales.csv')
            df.to_csv(output_path, index=False)
            print(f"✓ Exported to: {output_path}")

    return df


def extract_transaction_items(days=180, export_csv=True):
    """
    Extract transaction line items (for market basket analysis / recommendations)

    Args:
        days (int): Number of days of history to extract
        export_csv (bool): Whether to export to CSV file

    Returns:
        pandas.DataFrame: Transaction items data
    """
    query = """
        SELECT
            s.sale_id,
            DATE(s.sale_date) as date,
            si.product_id,
            p.name as product_name,
            p.category,
            si.quantity,
            si.unit_price
        FROM sales s
        JOIN sale_items si ON s.sale_id = si.sale_id
        JOIN products p ON si.product_id = p.product_id
        WHERE s.sale_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
        ORDER BY s.sale_id, si.sale_item_id
    """

    print(f"Extracting transaction items for last {days} days...")
    df = query_to_dataframe(query, (days,))

    if not df.empty:
        print(f"✓ Extracted {len(df)} sale items")
        print(f"  Unique transactions: {df['sale_id'].nunique()}")
        print(f"  Unique products: {df['product_id'].nunique()}")

        if export_csv:
            output_path = os.path.join(os.path.dirname(__file__), '../data/transaction_items.csv')
            df.to_csv(output_path, index=False)
            print(f"✓ Exported to: {output_path}")

    return df


def extract_all_ml_data(days=180):
    """
    Extract all datasets needed for ML training

    Args:
        days (int): Number of days of history to extract

    Returns:
        dict: Dictionary containing all extracted datasets
    """
    print("="*60)
    print("EXTRACTING ALL ML TRAINING DATA")
    print("="*60)

    data = {
        'sales_history': extract_sales_history(days),
        'daily_sales': extract_daily_sales_aggregates(days),
        'product_sales': extract_product_sales_history(days),
        'transaction_items': extract_transaction_items(days)
    }

    print("\n" + "="*60)
    print("DATA EXTRACTION COMPLETE")
    print("="*60)
    print("\nExtracted datasets:")
    for name, df in data.items():
        print(f"  - {name}: {len(df)} rows")

    return data


if __name__ == "__main__":
    # Extract all data for the last 180 days (6 months)
    extract_all_ml_data(days=180)
