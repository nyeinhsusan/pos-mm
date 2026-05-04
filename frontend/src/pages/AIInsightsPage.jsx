/**
 * AI Insights Dashboard Page
 *
 * Displays ML-powered predictions and recommendations:
 * - Sales Forecasting (7/14/30-day predictions with charts)
 * - Inventory Stockout Predictions (with alerts)
 * - Product Recommendations (market basket analysis)
 *
 * @module pages/AIInsightsPage
 */

import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { useTheme } from '../context/ThemeContext';
import aiService from '../services/aiService';
import Sidebar from '../components/Sidebar';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function AIInsightsPage() {
  const { isDark, toggleTheme } = useTheme();

  // State for sales forecast
  const [forecastDays, setForecastDays] = useState(7);
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState(null);

  // State for inventory predictions
  const [inventoryData, setInventoryData] = useState(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState(null);

  // State for product recommendations
  const [selectedProductId, setSelectedProductId] = useState(1);
  const [recommendationsData, setRecommendationsData] = useState(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState(null);

  // State for ML service health
  const [mlServiceHealth, setMlServiceHealth] = useState(null);

  // Fetch forecast data
  useEffect(() => {
    fetchForecast();
  }, [forecastDays]);

  // Fetch inventory data on mount
  useEffect(() => {
    fetchInventoryPredictions();
  }, []);

  // Fetch recommendations when product changes
  useEffect(() => {
    if (selectedProductId) {
      fetchRecommendations();
    }
  }, [selectedProductId]);

  // Check ML service health on mount
  useEffect(() => {
    checkMLHealth();
  }, []);

  /**
   * Check ML service health
   */
  const checkMLHealth = async () => {
    try {
      const response = await aiService.checkMLServiceHealth();
      setMlServiceHealth(response);
    } catch (error) {
      console.error('ML health check failed:', error);
      setMlServiceHealth({ ml_service: { available: false } });
    }
  };

  /**
   * Fetch sales forecast
   */
  const fetchForecast = async () => {
    setForecastLoading(true);
    setForecastError(null);

    try {
      const response = await aiService.getForecast(forecastDays);
      setForecastData(response.data);
    } catch (error) {
      console.error('Forecast fetch failed:', error);
      setForecastError(error.response?.data?.error?.message || 'Failed to load forecast');
    } finally {
      setForecastLoading(false);
    }
  };

  /**
   * Fetch inventory predictions
   */
  const fetchInventoryPredictions = async () => {
    setInventoryLoading(true);
    setInventoryError(null);

    try {
      const response = await aiService.getInventoryInsights();
      setInventoryData(response.data);
    } catch (error) {
      console.error('Inventory fetch failed:', error);
      setInventoryError(error.response?.data?.error?.message || 'Failed to load inventory predictions');
    } finally {
      setInventoryLoading(false);
    }
  };

  /**
   * Fetch product recommendations
   */
  const fetchRecommendations = async () => {
    setRecommendationsLoading(true);
    setRecommendationsError(null);

    try {
      const response = await aiService.getRecommendations(selectedProductId, 5);
      setRecommendationsData(response.data);
    } catch (error) {
      console.error('Recommendations fetch failed:', error);
      setRecommendationsError(error.response?.data?.error?.message || 'Failed to load recommendations');
    } finally {
      setRecommendationsLoading(false);
    }
  };

  /**
   * Format currency for Myanmar Kyat
   */
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' MMK';
  };

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  /**
   * Get status badge color
   */
  const getStatusColor = (status) => {
    switch (status) {
      case 'OUT_OF_STOCK':
        return 'bg-red-600 text-white';
      case 'LOW_STOCK':
        return 'bg-red-500 text-white';
      case 'REORDER_SOON':
        return 'bg-yellow-500 text-white';
      case 'MONITOR':
        return 'bg-blue-500 text-white';
      case 'HEALTHY':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  /**
   * Prepare chart data for forecast
   */
  const prepareChartData = () => {
    if (!forecastData || !forecastData.forecast) {
      return null;
    }

    const labels = forecastData.forecast.map(f => formatDate(f.date));
    const predictions = forecastData.forecast.map(f => f.predicted_sales);
    const lowerBounds = forecastData.forecast.map(f => f.lower_bound);
    const upperBounds = forecastData.forecast.map(f => f.upper_bound);

    return {
      labels,
      datasets: [
        {
          label: 'Predicted Sales',
          data: predictions,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: false
        },
        {
          label: '95% Confidence Upper',
          data: upperBounds,
          borderColor: 'rgba(239, 68, 68, 0.3)',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          borderWidth: 1,
          borderDash: [5, 5],
          tension: 0.4,
          fill: '+1'
        },
        {
          label: '95% Confidence Lower',
          data: lowerBounds,
          borderColor: 'rgba(239, 68, 68, 0.3)',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          borderWidth: 1,
          borderDash: [5, 5],
          tension: 0.4,
          fill: '-1'
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += formatCurrency(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return (value / 1000).toFixed(0) + 'K';
          }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  const chartData = prepareChartData();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      {/* Main Content */}
      <div className="ml-0 md:ml-20 lg:ml-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6 fade-in">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">AI Insights Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Machine learning-powered predictions for sales, inventory, and recommendations
        </p>

        {/* ML Service Health Status */}
        {mlServiceHealth && (
          <div className="mt-4 fade-in-delay-1">
            {mlServiceHealth.ml_service?.available ? (
              <div className="inline-flex items-center bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 px-4 py-2 rounded-lg status-pulse border border-green-200 dark:border-green-800">
                <svg className="w-5 h-5 mr-2 bounce-slow" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">ML Service Online</span>
                <span className="ml-2 text-sm">
                  (Forecast: {mlServiceHealth.ml_service.models?.forecast ? '✓' : '✗'},
                   Inventory: {mlServiceHealth.ml_service.models?.inventory ? '✓' : '✗'},
                   Recommendations: {mlServiceHealth.ml_service.models?.recommendations ? '✓' : '✗'})
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">ML Service Offline</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sales Forecast Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 slide-in-left hover-lift">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">📈 Sales Forecast</h2>

          {/* Forecast period selector */}
          <div className="flex gap-2">
            {[7, 14, 30].map(days => (
              <button
                key={days}
                onClick={() => setForecastDays(days)}
                className={`px-4 py-2 rounded-lg font-medium transition-all btn-press ${
                  forecastDays === days
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:shadow-md'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        {forecastLoading && (
          <div className="flex flex-col justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4 flex items-center">
              Loading forecast
              <span className="loading-dot ml-1">.</span>
              <span className="loading-dot">.</span>
              <span className="loading-dot">.</span>
            </p>
          </div>
        )}

        {forecastError && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded shake">
            ⚠️ {forecastError}
          </div>
        )}

        {!forecastLoading && !forecastError && forecastData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 stagger-children">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 hover-scale transition-all">
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">💰 Total Predicted Sales</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1 count-up">
                  {formatCurrency(forecastData.summary.total_predicted_sales)}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 hover-scale transition-all">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">📊 Average Daily Sales</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1 count-up">
                  {formatCurrency(forecastData.summary.average_daily_sales)}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800 hover-scale transition-all">
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">📅 Forecast Period</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1 count-up">
                  {forecastData.summary.forecast_period}
                </p>
              </div>
            </div>

            {/* Chart */}
            {chartData && (
              <div className="h-96 chart-entrance">
                <Line data={chartData} options={chartOptions} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Inventory Predictions Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 slide-in-right hover-lift">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">📦 Inventory Stockout Predictions</h2>
          <button
            onClick={fetchInventoryPredictions}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all btn-press shadow-md hover:shadow-lg"
          >
            🔄 Refresh
          </button>
        </div>

        {inventoryLoading && (
          <div className="flex flex-col justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4 flex items-center">
              Loading inventory
              <span className="loading-dot ml-1">.</span>
              <span className="loading-dot">.</span>
              <span className="loading-dot">.</span>
            </p>
          </div>
        )}

        {inventoryError && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded shake">
            ⚠️ {inventoryError}
          </div>
        )}

        {!inventoryLoading && !inventoryError && inventoryData && (
          <>
            {/* Alert Summary */}
            {inventoryData.alerts && inventoryData.alerts.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg p-4 mb-4 shake fade-in">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400 mr-2 pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold text-red-800 dark:text-red-200">
                    ⚠️ {inventoryData.alert_count} Product{inventoryData.alert_count !== 1 ? 's' : ''} Need Immediate Attention!
                  </span>
                </div>
              </div>
            )}

            {/* Inventory Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Current Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Days Until Stockout
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Stockout Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Recommended Reorder
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 stagger-children">
                  {inventoryData.predictions && inventoryData.predictions.map((prediction) => (
                    <tr key={prediction.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:shadow-md cursor-pointer">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">📦 {prediction.product_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{prediction.current_stock} units</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{prediction.days_until_stockout.toFixed(1)} days</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{formatDate(prediction.predicted_stockout_date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">{prediction.recommended_reorder_qty} units</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(prediction.status)}`}>
                          {prediction.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Product Recommendations Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 fade-in-up hover-lift">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">🛍️ Product Recommendations</h2>

          {/* Product selector */}
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
          >
            <option value={1}>🥤 Coca-Cola 500ml</option>
            <option value={2}>🥤 Pepsi 500ml</option>
            <option value={3}>🍚 White Rice 5kg</option>
            <option value={4}>📓 Notebook A4</option>
          </select>
        </div>

        {recommendationsLoading && (
          <div className="flex flex-col justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4 flex items-center">
              Loading recommendations
              <span className="loading-dot ml-1">.</span>
              <span className="loading-dot">.</span>
              <span className="loading-dot">.</span>
            </p>
          </div>
        )}

        {recommendationsError && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded shake">
            ⚠️ {recommendationsError}
          </div>
        )}

        {!recommendationsLoading && !recommendationsError && recommendationsData && (
          <>
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 fade-in">
              <p className="text-sm text-blue-600 dark:text-blue-400">💡 Customers who bought</p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{recommendationsData.product_name}</p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">also frequently bought these products:</p>
            </div>

            {recommendationsData.recommendations && recommendationsData.recommendations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                {recommendationsData.recommendations.map((rec, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-all card-hover bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">🎯 {rec.product_name}</h3>
                      <span className="text-2xl font-bold text-blue-500 dark:text-blue-400">#{index + 1}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">📊 Confidence:</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{(rec.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">📈 Lift:</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{rec.lift.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">🤝 Support:</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{(rec.support * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    {/* Confidence bar */}
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full progress-animate shadow-sm"
                          style={{ width: `${rec.confidence * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No recommendations available for this product.
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}

export default AIInsightsPage;
