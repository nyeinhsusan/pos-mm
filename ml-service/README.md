# ML Service - POS Myanmar AI/ML Intelligence Features

**Version:** 1.0.0
**Date:** April 24, 2026
**Developer:** James (Dev Agent)

## Overview

This ML service provides AI-powered features for the POS Myanmar system:
- **Sales Forecasting**: Predict future sales using ARIMA/SARIMAX time series models
- **Inventory Optimization**: Predict stockout dates and recommend reorder quantities
- **Product Recommendations**: Suggest frequently-bought-together products using association rules

---

## Project Structure

```
ml-service/
├── venv/                          # Python virtual environment
├── data/                          # Training data (CSV exports)
│   ├── sales_history.csv
│   ├── daily_sales.csv
│   ├── product_sales.csv
│   └── transaction_items.csv
├── models/                        # Trained ML models (saved as .pkl)
│   ├── sales_forecast_model.pkl
│   ├── inventory_prediction_model.pkl
│   └── product_recommendations.pkl
├── notebooks/                     # Jupyter notebooks for EDA
│   └── 01_exploratory_data_analysis.ipynb
├── evaluation/                    # Model evaluation scripts and results
├── utils/                         # Utility modules
│   ├── __init__.py
│   ├── db_connection.py           # Database connection utilities
│   ├── data_extraction.py         # Extract data from MySQL
│   ├── preprocessing.py           # Data preprocessing utilities
│   └── feature_engineering.py     # Feature engineering functions
├── .env                           # Environment variables (not committed)
├── .env.example                   # Environment variables template
├── requirements.txt               # Python dependencies
└── README.md                      # This file
```

---

## Setup Instructions

### 1. Prerequisites
- Python 3.9+ installed
- MySQL database with historical sales data (3-6 months)
- Node.js backend running (optional, for integration)

### 2. Create Virtual Environment

```bash
cd ml-service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

**Installed packages:**
- pandas, numpy - Data manipulation
- scikit-learn - Machine learning algorithms
- statsmodels - Time series forecasting (ARIMA/SARIMAX)
- mlxtend - Market basket analysis (Apriori)
- Flask, flask-cors - REST API
- mysql-connector-python - Database connection
- matplotlib, seaborn - Visualization
- jupyter, notebook - Interactive analysis

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
nano .env  # Edit configuration
```

**Required variables:**
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=pos_myanmar
ML_SERVICE_PORT=5002
```

### 5. Test Database Connection

```bash
source venv/bin/activate
python utils/db_connection.py
```

Expected output:
```
✓ Connected to MySQL database: pos_myanmar
✓ Database: pos_myanmar
✓ MySQL Version: 8.0.x
✓ Tables found: 4
```

---

## Data Extraction & Preparation

### Extract Training Data

```bash
source venv/bin/activate
python utils/data_extraction.py
```

This will:
- Extract 180 days (6 months) of historical sales data
- Create 4 CSV files in `data/` directory:
  - `sales_history.csv` - Individual transaction records
  - `daily_sales.csv` - Daily aggregated sales
  - `product_sales.csv` - Product-level sales history
  - `transaction_items.csv` - Transaction line items

### Run Exploratory Data Analysis

```bash
jupyter notebook notebooks/01_exploratory_data_analysis.ipynb
```

This notebook provides:
- Data quality assessment
- Temporal pattern analysis
- Product performance insights
- Market basket analysis
- Summary statistics

---

## Utility Modules

### 1. Database Connection (`utils/db_connection.py`)

```python
from utils.db_connection import query_to_dataframe

# Execute SQL and get pandas DataFrame
df = query_to_dataframe("SELECT * FROM sales LIMIT 100")
```

### 2. Data Extraction (`utils/data_extraction.py`)

```python
from utils.data_extraction import extract_all_ml_data

# Extract all datasets for ML training
data = extract_all_ml_data(days=180)
# Returns: {
#   'sales_history': DataFrame,
#   'daily_sales': DataFrame,
#   'product_sales': DataFrame,
#   'transaction_items': DataFrame
# }
```

### 3. Preprocessing (`utils/preprocessing.py`)

```python
from utils.preprocessing import (
    handle_missing_values,
    create_time_features,
    split_train_test,
    prepare_forecasting_data
)

# Handle missing values
df_clean = handle_missing_values(df, strategy='forward_fill')

# Create time-based features
df_featured = create_time_features(df, date_column='date')

# Split data
train_df, test_df = split_train_test(df, test_size=0.2, time_based=True)

# Prepare data for forecasting
forecast_df = prepare_forecasting_data(df, target_column='sales')
```

### 4. Feature Engineering (`utils/feature_engineering.py`)

```python
from utils.feature_engineering import (
    calculate_sales_velocity,
    calculate_stockout_risk,
    calculate_product_popularity,
    create_transaction_basket_matrix
)

# Calculate sales velocity
df_velocity = calculate_sales_velocity(df, windows=[7, 30])

# Calculate stockout risk
df_risk = calculate_stockout_risk(df)

# Create market basket matrix
basket_matrix = create_transaction_basket_matrix(transaction_items)
```

---

## Model Training (Next Steps - Stories 6.2-6.4)

### 1. Sales Forecasting Model (ARIMA/SARIMAX)
- **Script:** `train_forecast_model.py` (to be created in Story 6.2)
- **Input:** `data/daily_sales.csv`
- **Output:** `models/sales_forecast_model.pkl`
- **Metrics:** MAPE < 20%, RMSE

### 2. Inventory Prediction Model (Random Forest)
- **Script:** `train_inventory_model.py` (to be created in Story 6.4)
- **Input:** `data/product_sales.csv`
- **Output:** `models/inventory_prediction_model.pkl`
- **Metrics:** MAE, 80%+ accuracy for 7-day predictions

### 3. Product Recommendation Model (Apriori)
- **Script:** `train_recommendation_model.py` (to be created in Story 6.3)
- **Input:** `data/transaction_items.csv`
- **Output:** `models/product_recommendations.pkl`
- **Metrics:** Support, Confidence, Lift

---

## API Server (Story 6.5)

Flask REST API to serve ML predictions (to be implemented):

```bash
python app.py  # Starts Flask server on port 5002
```

**Endpoints:**
- `POST /ml/forecast` - Sales forecasting
- `GET /ml/inventory/predictions` - Stockout predictions
- `GET /ml/recommendations?product_id=X` - Product recommendations
- `GET /ml/health` - Health check
- `POST /ml/retrain` - Trigger model retraining

---

## Development Workflow

### 1. Data Pipeline
```bash
# Extract latest data
python utils/data_extraction.py

# Run EDA notebook
jupyter notebook notebooks/01_exploratory_data_analysis.ipynb
```

### 2. Model Training (Stories 6.2-6.4)
```bash
# Train forecasting model
python train_forecast_model.py

# Train inventory model
python train_inventory_model.py

# Train recommendation model
python train_recommendation_model.py
```

### 3. Model Evaluation (Story 6.10)
```bash
# Run evaluation scripts
python evaluation/evaluate_models.py
```

### 4. Start API Server (Story 6.5)
```bash
python app.py
```

---

## Technical Decisions

### Why ARIMA/SARIMAX Instead of Prophet?

**Original Plan:** Facebook Prophet
**Replacement:** statsmodels ARIMA/SARIMAX

**Reason:** Prophet compilation fails on macOS ARM (M1/M2) due to C++ dependency issues.

**Academic Validity:**
- ARIMA/SARIMAX equally valid for time series forecasting
- Widely cited in academic literature
- Supports seasonality, trends, and confidence intervals
- Lighter weight, no compilation required

**Benefits:**
- ✅ Proven statistical methods
- ✅ No C++ compilation issues
- ✅ Excellent documentation
- ✅ Widely used in research
- ✅ Supports exogenous variables (SARIMAX)

---

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
python utils/db_connection.py

# Check MySQL is running
mysql -u root -p

# Verify database exists
SHOW DATABASES;
USE pos_myanmar;
SHOW TABLES;
```

### Missing Data
```bash
# Ensure historical data is seeded
mysql -u root -p pos_myanmar < ../database/generate-historical-sales.sql
```

### Package Installation Issues
```bash
# Upgrade pip
pip install --upgrade pip

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

---

## Contributing

This ML service is part of the BSc thesis project for NYE24639263 (Nyein Hsu San).

**Development Standards:**
- Follow PEP 8 style guidelines
- Add docstrings to all functions
- Write unit tests for critical functions
- Document model performance metrics
- Version control trained models

---

## Story 6.1 Completion Status

**STORY-6.1: ML Development Environment & Data Pipeline**

### ✅ Completed:
- [x] Python 3.9 virtual environment created
- [x] requirements.txt with all ML dependencies
- [x] Core packages installed (scikit-learn, mlxtend, Flask, etc.)
- [x] statsmodels installed (Prophet alternative)
- [x] Database connection utility created (`utils/db_connection.py`)
- [x] Data extraction scripts created (`utils/data_extraction.py`)
- [x] Feature engineering pipeline created (`utils/feature_engineering.py`)
- [x] Data preprocessing utilities created (`utils/preprocessing.py`)
- [x] Jupyter notebook for EDA created
- [x] Train/test/validation split strategy defined
- [x] Data export to CSV for model training implemented

### ⏳ Pending:
- [ ] Generate 3-6 months of historical sales data (requires running SQL script)
- [ ] Run EDA notebook on actual data

---

## License

Internal use for BSc Project - Leap Technology Ltd.

---

**Next Steps:** Complete Stories 6.2-6.4 (Model Training)
