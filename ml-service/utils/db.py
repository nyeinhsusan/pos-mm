"""
Database connection utility for ML Service
"""
import mysql.connector
from mysql.connector import Error
import os
from dotenv import load_dotenv
import pandas as pd

# Load environment variables
load_dotenv()

def get_db_connection():
    """
    Create and return a MySQL database connection
    """
    try:
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'pos_myanmar')
        )

        if connection.is_connected():
            return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

def execute_query(query, params=None):
    """
    Execute a query and return results as pandas DataFrame

    Args:
        query: SQL query string
        params: Query parameters (tuple)

    Returns:
        pandas.DataFrame: Query results
    """
    connection = get_db_connection()
    if not connection:
        raise Exception("Failed to connect to database")

    try:
        df = pd.read_sql(query, connection, params=params)
        return df
    except Error as e:
        print(f"Error executing query: {e}")
        raise
    finally:
        if connection.is_connected():
            connection.close()

def test_connection():
    """
    Test database connection
    """
    connection = get_db_connection()
    if connection and connection.is_connected():
        print("✅ Database connection successful!")
        db_info = connection.get_server_info()
        print(f"MySQL Server version: {db_info}")

        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM sales")
        sales_count = cursor.fetchone()[0]
        print(f"Total sales in database: {sales_count}")

        cursor.close()
        connection.close()
        return True
    else:
        print("❌ Database connection failed!")
        return False

if __name__ == "__main__":
    test_connection()
