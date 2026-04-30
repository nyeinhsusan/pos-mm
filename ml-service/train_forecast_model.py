"""
Sales Forecasting Model Training - ARIMA/SARIMAX
Story 6.2: Train sales forecasting model for POS Myanmar

This script trains an ARIMA/SARIMAX time series model to predict future sales.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.stattools import adfuller, acf, pacf
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf
import warnings
import joblib
import os
from datetime import datetime, timedelta

warnings.filterwarnings('ignore')

# Set visualization style
plt.style.use('seaborn-v0_8-darkgrid')
sns.set_palette("husl")


class SalesForecastModel:
    """
    ARIMA/SARIMAX model for sales forecasting
    """

    def __init__(self, order=(1, 1, 1), seasonal_order=(1, 1, 1, 7)):
        """
        Initialize the forecasting model

        Args:
            order (tuple): (p, d, q) for ARIMA - (AR order, differencing, MA order)
            seasonal_order (tuple): (P, D, Q, s) for seasonal ARIMA - (seasonal AR, seasonal diff, seasonal MA, seasonality period)
        """
        self.order = order
        self.seasonal_order = seasonal_order
        self.model = None
        self.fitted_model = None
        self.training_data = None
        self.test_data = None
        self.metrics = {}

    def load_data(self, csv_path='data/daily_sales.csv'):
        """
        Load daily sales data from CSV

        Args:
            csv_path (str): Path to daily sales CSV file

        Returns:
            pandas.DataFrame: Loaded sales data
        """
        print(f"Loading data from {csv_path}...")
        df = pd.read_csv(csv_path)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)

        print(f"✓ Loaded {len(df)} days of sales data")
        print(f"  Date range: {df['date'].min().date()} to {df['date'].max().date()}")
        print(f"  Average daily sales: {df['sales'].mean():,.2f} MMK")

        return df

    def check_stationarity(self, timeseries, title=''):
        """
        Check if time series is stationary using Augmented Dickey-Fuller test

        Args:
            timeseries (pandas.Series): Time series data
            title (str): Title for the test

        Returns:
            bool: True if stationary, False otherwise
        """
        print(f"\n{'='*60}")
        print(f"STATIONARITY TEST: {title}")
        print(f"{'='*60}")

        # Augmented Dickey-Fuller test
        result = adfuller(timeseries.dropna())
        adf_statistic = result[0]
        p_value = result[1]
        critical_values = result[4]

        print(f"ADF Statistic: {adf_statistic:.6f}")
        print(f"p-value: {p_value:.6f}")
        print(f"Critical Values:")
        for key, value in critical_values.items():
            print(f"  {key}: {value:.3f}")

        is_stationary = p_value < 0.05

        if is_stationary:
            print(f"\n✓ Series IS stationary (p < 0.05)")
        else:
            print(f"\n✗ Series is NOT stationary (p >= 0.05) - differencing needed")

        return is_stationary

    def split_data(self, df, test_size=0.2):
        """
        Split data into train and test sets (time-based)

        Args:
            df (pandas.DataFrame): Sales data
            test_size (float): Proportion for test set

        Returns:
            tuple: (train_df, test_df)
        """
        split_idx = int(len(df) * (1 - test_size))
        train_df = df.iloc[:split_idx].copy()
        test_df = df.iloc[split_idx:].copy()

        self.training_data = train_df
        self.test_data = test_df

        print(f"\n{'='*60}")
        print(f"TRAIN/TEST SPLIT")
        print(f"{'='*60}")
        print(f"Train set: {len(train_df)} days ({train_df['date'].min().date()} to {train_df['date'].max().date()})")
        print(f"Test set:  {len(test_df)} days ({test_df['date'].min().date()} to {test_df['date'].max().date()})")

        return train_df, test_df

    def train(self, train_df):
        """
        Train SARIMAX model

        Args:
            train_df (pandas.DataFrame): Training data

        Returns:
            fitted model
        """
        print(f"\n{'='*60}")
        print(f"TRAINING SARIMAX MODEL")
        print(f"{'='*60}")
        print(f"Order: {self.order}")
        print(f"Seasonal Order: {self.seasonal_order}")

        # Set date as index
        train_series = train_df.set_index('date')['sales']

        # Train SARIMAX model
        print("\nTraining in progress...")
        self.model = SARIMAX(
            train_series,
            order=self.order,
            seasonal_order=self.seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False
        )

        self.fitted_model = self.model.fit(disp=False)

        print(f"✓ Model trained successfully!")
        print(f"\nModel Summary:")
        print(f"  AIC: {self.fitted_model.aic:.2f}")
        print(f"  BIC: {self.fitted_model.bic:.2f}")
        print(f"  Log Likelihood: {self.fitted_model.llf:.2f}")

        return self.fitted_model

    def evaluate(self, test_df):
        """
        Evaluate model on test set

        Args:
            test_df (pandas.DataFrame): Test data

        Returns:
            dict: Evaluation metrics (MAPE, RMSE, MAE)
        """
        print(f"\n{'='*60}")
        print(f"MODEL EVALUATION")
        print(f"{'='*60}")

        # Make predictions on test set
        test_series = test_df.set_index('date')['sales']
        predictions = self.fitted_model.forecast(steps=len(test_df))

        # Calculate metrics
        mape = np.mean(np.abs((test_series - predictions) / test_series)) * 100
        rmse = np.sqrt(np.mean((test_series - predictions) ** 2))
        mae = np.mean(np.abs(test_series - predictions))

        self.metrics = {
            'MAPE': mape,
            'RMSE': rmse,
            'MAE': mae,
            'actual_mean': test_series.mean(),
            'predicted_mean': predictions.mean()
        }

        print(f"MAPE (Mean Absolute Percentage Error): {mape:.2f}%")
        print(f"RMSE (Root Mean Squared Error): {rmse:,.2f} MMK")
        print(f"MAE (Mean Absolute Error): {mae:,.2f} MMK")
        print(f"\nActual Mean Sales: {test_series.mean():,.2f} MMK")
        print(f"Predicted Mean Sales: {predictions.mean():,.2f} MMK")

        # Visualize predictions vs actual
        self._plot_predictions(test_df, predictions)

        return self.metrics

    def _plot_predictions(self, test_df, predictions):
        """
        Plot actual vs predicted values

        Args:
            test_df (pandas.DataFrame): Test data
            predictions (pandas.Series): Predicted values
        """
        plt.figure(figsize=(14, 6))

        plt.plot(test_df['date'], test_df['sales'], label='Actual Sales', marker='o', linewidth=2)
        plt.plot(test_df['date'], predictions.values, label='Predicted Sales', marker='s', linewidth=2, linestyle='--')

        plt.title('Sales Forecast: Actual vs Predicted (Test Set)', fontsize=14, fontweight='bold')
        plt.xlabel('Date')
        plt.ylabel('Sales (MMK)')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.tight_layout()

        # Save plot
        plot_path = 'evaluation/forecast_test_predictions.png'
        os.makedirs(os.path.dirname(plot_path), exist_ok=True)
        plt.savefig(plot_path, dpi=300, bbox_inches='tight')
        print(f"\n✓ Prediction plot saved to: {plot_path}")

        plt.close()

    def forecast_future(self, days=30, confidence_level=0.95):
        """
        Forecast future sales with confidence intervals

        Args:
            days (int): Number of days to forecast
            confidence_level (float): Confidence level for intervals (default 0.95)

        Returns:
            pandas.DataFrame: Forecast with confidence intervals
        """
        print(f"\n{'='*60}")
        print(f"FORECASTING FUTURE SALES ({days} days)")
        print(f"{'='*60}")

        # Get forecast with confidence intervals
        forecast_result = self.fitted_model.get_forecast(steps=days)
        forecast_mean = forecast_result.predicted_mean
        forecast_ci = forecast_result.conf_int(alpha=1 - confidence_level)

        # Create forecast dataframe
        last_date = self.training_data['date'].max()
        forecast_dates = pd.date_range(start=last_date + timedelta(days=1), periods=days, freq='D')

        forecast_df = pd.DataFrame({
            'date': forecast_dates,
            'predicted_sales': forecast_mean.values,
            'lower_bound': forecast_ci.iloc[:, 0].values,
            'upper_bound': forecast_ci.iloc[:, 1].values
        })

        print(f"✓ Generated {days}-day forecast")
        print(f"\nForecast Summary:")
        print(f"  Average predicted sales: {forecast_df['predicted_sales'].mean():,.2f} MMK/day")
        print(f"  Total predicted revenue: {forecast_df['predicted_sales'].sum():,.2f} MMK")
        print(f"  Confidence interval range: {confidence_level*100:.0f}%")

        # Visualize forecast
        self._plot_forecast(forecast_df, days)

        return forecast_df

    def _plot_forecast(self, forecast_df, days):
        """
        Plot forecast with confidence intervals

        Args:
            forecast_df (pandas.DataFrame): Forecast data
            days (int): Number of days forecasted
        """
        # Combine historical and forecast
        historical = self.training_data[['date', 'sales']].tail(30)  # Last 30 days

        plt.figure(figsize=(14, 6))

        # Plot historical
        plt.plot(historical['date'], historical['sales'], label='Historical Sales',
                 marker='o', linewidth=2, color='steelblue')

        # Plot forecast
        plt.plot(forecast_df['date'], forecast_df['predicted_sales'], label=f'{days}-Day Forecast',
                 marker='s', linewidth=2, color='orange', linestyle='--')

        # Plot confidence interval
        plt.fill_between(forecast_df['date'], forecast_df['lower_bound'], forecast_df['upper_bound'],
                         alpha=0.3, color='orange', label='95% Confidence Interval')

        plt.title(f'Sales Forecast: {days}-Day Prediction with Confidence Intervals',
                  fontsize=14, fontweight='bold')
        plt.xlabel('Date')
        plt.ylabel('Sales (MMK)')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.tight_layout()

        # Save plot
        plot_path = f'evaluation/forecast_{days}d_prediction.png'
        plt.savefig(plot_path, dpi=300, bbox_inches='tight')
        print(f"✓ Forecast plot saved to: {plot_path}")

        plt.close()

    def save_model(self, model_path='models/sales_forecast_model.pkl'):
        """
        Save trained model to disk

        Args:
            model_path (str): Path to save model
        """
        os.makedirs(os.path.dirname(model_path), exist_ok=True)

        model_data = {
            'fitted_model': self.fitted_model,
            'order': self.order,
            'seasonal_order': self.seasonal_order,
            'metrics': self.metrics,
            'training_end_date': self.training_data['date'].max(),
            'trained_at': datetime.now().isoformat()
        }

        joblib.dump(model_data, model_path)
        print(f"\n✓ Model saved to: {model_path}")

    @staticmethod
    def load_model(model_path='models/sales_forecast_model.pkl'):
        """
        Load trained model from disk

        Args:
            model_path (str): Path to saved model

        Returns:
            SalesForecastModel: Loaded model instance
        """
        model_data = joblib.load(model_path)

        model_instance = SalesForecastModel(
            order=model_data['order'],
            seasonal_order=model_data['seasonal_order']
        )
        model_instance.fitted_model = model_data['fitted_model']
        model_instance.metrics = model_data['metrics']

        print(f"✓ Model loaded from: {model_path}")
        print(f"  Trained at: {model_data['trained_at']}")
        print(f"  Training end date: {model_data['training_end_date']}")
        print(f"  MAPE: {model_data['metrics']['MAPE']:.2f}%")

        return model_instance


def main():
    """
    Main training pipeline
    """
    print("="*60)
    print("SALES FORECASTING MODEL TRAINING - SARIMAX")
    print("Story 6.2: POS Myanmar ML Service")
    print("="*60)

    # Initialize model
    # SARIMAX parameters:
    # order=(1,1,1): ARIMA(p,d,q) - AR=1, differencing=1, MA=1
    # seasonal_order=(1,1,1,7): Seasonal(P,D,Q,s) - weekly seasonality (s=7)
    model = SalesForecastModel(
        order=(1, 1, 1),
        seasonal_order=(1, 1, 1, 7)
    )

    # Load data
    df = model.load_data('data/daily_sales.csv')

    # Check stationarity of original series
    model.check_stationarity(df['sales'], title='Original Sales Data')

    # Split data
    train_df, test_df = model.split_data(df, test_size=0.2)

    # Train model
    model.train(train_df)

    # Evaluate on test set
    metrics = model.evaluate(test_df)

    # Check if MAPE meets thesis requirement (< 20%)
    if metrics['MAPE'] < 20:
        print(f"\n✓ MODEL MEETS THESIS REQUIREMENT: MAPE ({metrics['MAPE']:.2f}%) < 20%")
    else:
        print(f"\n⚠ MAPE ({metrics['MAPE']:.2f}%) exceeds 20% - consider hyperparameter tuning")

    # Generate forecasts
    forecast_7d = model.forecast_future(days=7)
    forecast_14d = model.forecast_future(days=14)
    forecast_30d = model.forecast_future(days=30)

    # Save forecasts to CSV
    forecast_7d.to_csv('data/forecast_7d.csv', index=False)
    forecast_14d.to_csv('data/forecast_14d.csv', index=False)
    forecast_30d.to_csv('data/forecast_30d.csv', index=False)
    print("\n✓ Forecasts saved to data/ directory")

    # Save model
    model.save_model('models/sales_forecast_model.pkl')

    print("\n" + "="*60)
    print("TRAINING COMPLETE!")
    print("="*60)
    print(f"\nModel Performance:")
    print(f"  MAPE: {metrics['MAPE']:.2f}%")
    print(f"  RMSE: {metrics['RMSE']:,.2f} MMK")
    print(f"  MAE: {metrics['MAE']:,.2f} MMK")
    print(f"\nModel saved to: models/sales_forecast_model.pkl")
    print(f"Ready for API integration (Story 6.5)")


if __name__ == "__main__":
    main()
