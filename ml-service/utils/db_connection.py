"""
Database connection utility for ML Service
Connects to MySQL database and provides helper functions
"""

import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv
import pandas as pd

# Load environment variables
load_dotenv()

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'pos_myanmar')
}


def get_db_connection():
    """
    Create and return a MySQL database connection

    Returns:
        connection: MySQL connection object or None if failed
    """
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        if connection.is_connected():
            print(f"✓ Connected to MySQL database: {DB_CONFIG['database']}")
            return connection
    except Error as e:
        print(f"✗ Error connecting to MySQL: {e}")
        return None


def close_db_connection(connection):
    """
    Close the MySQL database connection

    Args:
        connection: MySQL connection object
    """
    if connection and connection.is_connected():
        connection.close()
        print("✓ MySQL connection closed")


def execute_query(query, params=None, fetch=True):
    """
    Execute a SQL query and return results

    Args:
        query (str): SQL query string
        params (tuple): Optional parameters for prepared statement
        fetch (bool): Whether to fetch results (SELECT) or not (INSERT/UPDATE)

    Returns:
        list: Query results if fetch=True, None otherwise
    """
    connection = get_db_connection()
    if not connection:
        return None

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params or ())

        if fetch:
            results = cursor.fetchall()
            cursor.close()
            close_db_connection(connection)
            return results
        else:
            connection.commit()
            cursor.close()
            close_db_connection(connection)
            return cursor.lastrowid

    except Error as e:
        print(f"✗ Error executing query: {e}")
        close_db_connection(connection)
        return None


def query_to_dataframe(query, params=None):
    """
    Execute a SQL query and return results as a pandas DataFrame

    Args:
        query (str): SQL query string
        params (tuple): Optional parameters for prepared statement

    Returns:
        pandas.DataFrame: Query results as DataFrame
    """
    connection = get_db_connection()
    if not connection:
        return pd.DataFrame()

    try:
        df = pd.read_sql(query, connection, params=params)
        close_db_connection(connection)
        print(f"✓ Loaded {len(df)} rows into DataFrame")
        return df
    except Error as e:
        print(f"✗ Error loading data into DataFrame: {e}")
        close_db_connection(connection)
        return pd.DataFrame()


def test_connection():
    """Test database connection and print database info"""
    connection = get_db_connection()
    if connection:
        try:
            cursor = connection.cursor()
            cursor.execute("SELECT DATABASE(), VERSION()")
            db_name, version = cursor.fetchone()
            print(f"✓ Database: {db_name}")
            print(f"✓ MySQL Version: {version}")

            # Count tables
            cursor.execute("SHOW TABLES")
            tables = cursor.fetchall()
            print(f"✓ Tables found: {len(tables)}")
            for table in tables:
                print(f"  - {table[0]}")

            cursor.close()
            close_db_connection(connection)
            return True
        except Error as e:
            print(f"✗ Error testing connection: {e}")
            close_db_connection(connection)
            return False
    return False


if __name__ == "__main__":
    print("Testing database connection...")
    test_connection()
