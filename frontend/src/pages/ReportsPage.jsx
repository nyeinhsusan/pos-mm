import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

const ReportsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [dailyReport, setDailyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [inventoryReport, setInventoryReport] = useState(null);
  const [paymentReport, setPaymentReport] = useState(null);
  const [salesHistory, setSalesHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('30'); // days
  const [paymentDateRange, setPaymentDateRange] = useState('30'); // days for payment analytics
  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    if (user?.role !== 'owner') {
      navigate('/pos');
      return;
    }
    fetchAllReports();
  }, [user, navigate, dateRange]);

  useEffect(() => {
    if (user?.role === 'owner') {
      fetchPaymentReport();
    }
  }, [paymentDateRange]);

  const fetchAllReports = async () => {
    try {
      setLoading(true);
      setError('');

      // Calculate date range
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));
      const startDateStr = startDate.toISOString().split('T')[0];

      // Fetch all reports in parallel (except payment which has its own date range)
      const [dailyRes, monthlyRes, inventoryRes, salesRes] = await Promise.all([
        api.get('/reports/daily'),
        api.get(`/reports/monthly?start_date=${startDateStr}&end_date=${endDate}`),
        api.get('/reports/inventory'),
        api.get('/sales?page=1&limit=20')
      ]);

      if (dailyRes.data.success) setDailyReport(dailyRes.data.data);
      if (monthlyRes.data.success) setMonthlyReport(monthlyRes.data.data);
      if (inventoryRes.data.success) setInventoryReport(inventoryRes.data.data);
      if (salesRes.data.success) setSalesHistory(salesRes.data.data);

      // Fetch payment report with its own date range
      await fetchPaymentReport();
    } catch (err) {
      console.error('Fetch reports error:', err);
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const fetchPaymentReport = async () => {
    try {
      // Calculate date range for payment analytics
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(paymentDateRange));
      const startDateStr = startDate.toISOString().split('T')[0];

      const paymentRes = await api.get(`/reports/payment-methods?start_date=${startDateStr}&end_date=${endDate}`);
      if (paymentRes.data.success) {
        setPaymentReport(paymentRes.data.data);
      }
    } catch (err) {
      console.error('Fetch payment report error:', err);
    }
  };

  const viewSaleDetails = async (saleId) => {
    try {
      const response = await api.get(`/sales/${saleId}`);
      if (response.data.success) {
        setSelectedSale(response.data.data);
      }
    } catch (err) {
      console.error('Fetch sale details error:', err);
    }
  };

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    // Convert array of objects to CSV
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        // Escape values with commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPaymentReport = () => {
    if (!paymentReport || !paymentReport.breakdown) {
      alert('No payment data to export');
      return;
    }

    const exportData = paymentReport.breakdown.map(item => ({
      'Payment Method': item.payment_method,
      'Transaction Count': item.transaction_count,
      'Total Amount (MMK)': item.total_amount,
      'Average Amount (MMK)': item.avg_amount,
      'Percentage': item.percentage + '%'
    }));

    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(exportData, `payment-report-${dateStr}.csv`);
  };

  const handleExportSalesHistory = () => {
    if (!salesHistory || salesHistory.length === 0) {
      alert('No sales data to export');
      return;
    }

    const exportData = salesHistory.map(sale => ({
      'Sale ID': sale.sale_id,
      'Date': new Date(sale.sale_date).toLocaleString(),
      'Cashier': sale.user_name,
      'Items Count': sale.items_count,
      'Total Amount (MMK)': sale.total_amount,
      'Profit (MMK)': sale.profit
    }));

    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(exportData, `sales-history-${dateStr}.csv`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Navigation Bar */}
      <nav className="bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-blue-600">POS Myanmar</h1>
              <div className="hidden md:flex space-x-4">
                <button
                  onClick={() => navigate('/pos')}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md transition-all hover-lift"
                >
                  🛒 POS
                </button>
                <button
                  onClick={() => navigate('/products')}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md transition-all hover-lift"
                >
                  📦 Products
                </button>
                <button
                  onClick={() => navigate('/reports')}
                  className="text-blue-600 font-medium px-3 py-2 rounded-md bg-blue-50 shadow-md"
                >
                  📊 Reports
                </button>
                <button
                  onClick={() => navigate('/ai-insights')}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md transition-all hover-lift"
                >
                  ✨ AI Insights
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className="text-gray-700 dark:text-gray-300">
                <strong>{user?.full_name}</strong> ({user?.role})
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all btn-press hover:shadow-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6 fade-in">
          📊 Business Reports & Analytics
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 shake">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 stagger-children">
          <SummaryCard
            title="Today's Revenue"
            value={`${parseInt(dailyReport?.summary.total_sales || 0).toLocaleString()} MMK`}
            subtitle={`${dailyReport?.summary.transactions_count || 0} transactions`}
            icon="💰"
            color="blue"
          />
          <SummaryCard
            title="Today's Profit"
            value={`${parseInt(dailyReport?.summary.total_profit || 0).toLocaleString()} MMK`}
            subtitle={`${dailyReport?.summary.items_sold || 0} items sold`}
            icon="📈"
            color="green"
          />
          <SummaryCard
            title="Low Stock Items"
            value={inventoryReport?.summary.low_stock_count || 0}
            subtitle={`${inventoryReport?.summary.out_of_stock_count || 0} out of stock`}
            icon="⚠️"
            color="orange"
          />
          <SummaryCard
            title="Inventory Value"
            value={`${parseInt(inventoryReport?.summary.total_inventory_value || 0).toLocaleString()} MMK`}
            subtitle={`${inventoryReport?.summary.total_products || 0} products`}
            icon="📦"
            color="purple"
          />
        </div>

        {/* Charts and Tables Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Products Chart */}
          <TopProductsChart topProducts={dailyReport?.top_products || []} />

          {/* Low Stock Products */}
          <LowStockProducts products={inventoryReport?.low_stock_products || []} />
        </div>

        {/* Sales Trend Chart */}
        <SalesTrendChart
          monthlyData={monthlyReport?.daily_breakdown || []}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* Payment Analytics Section */}
        {paymentReport && (
          <>
            <div className="flex justify-between items-center mb-4 mt-8">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 fade-in">
                💳 Payment Analytics
              </h3>
              <div className="flex items-center gap-3">
                <select
                  value={paymentDateRange}
                  onChange={(e) => setPaymentDateRange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 3 Months</option>
                  <option value="180">Last 6 Months</option>
                  <option value="365">Last Year</option>
                </select>
                <button
                  onClick={handleExportPaymentReport}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-all btn-press hover:shadow-lg flex items-center"
                >
                  📥 Export CSV
                </button>
              </div>
            </div>

            {/* Date Range Display */}
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
              Period: {paymentReport.period.start_date} to {paymentReport.period.end_date}
            </div>

            {/* Payment Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <PaymentSummaryCard
                title="Total Transactions"
                value={paymentReport.summary.total_transactions}
                subtitle={`${parseInt(paymentReport.summary.total_amount).toLocaleString()} MMK`}
                icon="🧾"
                color="blue"
              />
              <PaymentSummaryCard
                title="Cash Payments"
                value={`${paymentReport.summary.cash_percentage}%`}
                subtitle={`${parseInt(paymentReport.summary.cash_amount).toLocaleString()} MMK`}
                icon="💵"
                color="green"
              />
              <PaymentSummaryCard
                title="Cashless Payments"
                value={`${paymentReport.summary.cashless_percentage}%`}
                subtitle={`${parseInt(paymentReport.summary.cashless_amount).toLocaleString()} MMK`}
                icon="💳"
                color="purple"
              />
            </div>

            {/* Payment Methods Chart */}
            <PaymentMethodsChart breakdown={paymentReport.breakdown} />
          </>
        )}

        {/* Sales History Table */}
        <SalesHistoryTable
          sales={salesHistory}
          onViewDetails={viewSaleDetails}
          onExport={handleExportSalesHistory}
        />
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <SaleDetailsModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
        />
      )}
    </div>
  );
};

// Summary Card Component
const SummaryCard = ({ title, value, subtitle, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800'
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 hover-scale transition-all ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
        <span className="text-2xl bounce-slow">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 count-up">{value}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>
    </div>
  );
};

// Top Products Chart Component (Simple Bar Visualization)
const TopProductsChart = ({ topProducts }) => {
  const maxRevenue = Math.max(...topProducts.map((p) => parseFloat(p.revenue)), 1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover-lift transition-all">
      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">🏆 Top Products Today</h3>
      {topProducts.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No sales today</p>
      ) : (
        <div className="space-y-4">
          {topProducts.map((product) => {
            const widthPercent = (parseFloat(product.revenue) / maxRevenue) * 100;
            return (
              <div key={product.product_id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{product.name}</span>
                  <span className="text-gray-600 dark:text-gray-400">{product.quantity_sold} sold</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${widthPercent}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Revenue: {parseInt(product.revenue).toLocaleString()} MMK
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Low Stock Products Component
const LowStockProducts = ({ products }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Low Stock Alert</h3>
      {products.length === 0 ? (
        <p className="text-green-600 text-center py-8">✅ All products well-stocked!</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {products.map((product) => (
            <div
              key={product.product_id}
              className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
            >
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{product.name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{product.category}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-red-600 dark:text-red-400">{product.stock_quantity}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">/ {product.low_stock_threshold}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Sales Trend Chart Component (Simple Line Visualization)
const SalesTrendChart = ({ monthlyData, dateRange, onDateRangeChange }) => {
  const maxSales = Math.max(...monthlyData.map((d) => parseFloat(d.sales)), 1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Sales Trend</h3>
        <select
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="7">Last 7 Days</option>
          <option value="14">Last 14 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="60">Last 60 Days</option>
        </select>
      </div>

      <div className="relative h-64">
        <div className="flex items-end justify-between h-full space-x-1">
          {monthlyData.slice(-parseInt(dateRange)).map((day, index) => {
            const heightPercent = (parseFloat(day.sales) / maxSales) * 100;
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="w-full flex items-end justify-center" style={{ height: '200px' }}>
                  <div
                    className="w-full bg-blue-600 rounded-t hover:bg-blue-700 transition-all cursor-pointer"
                    style={{ height: `${heightPercent}%` }}
                    title={`${day.date}: ${parseInt(day.sales).toLocaleString()} MMK`}
                  ></div>
                </div>
                {index % Math.floor(parseInt(dateRange) / 7) === 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 transform -rotate-45">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="font-semibold text-blue-600">Revenue</div>
          <div className="text-gray-900 dark:text-gray-100">
            {monthlyData.reduce((sum, d) => sum + parseFloat(d.sales), 0).toLocaleString()} MMK
          </div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-green-600">Profit</div>
          <div className="text-gray-900 dark:text-gray-100">
            {monthlyData.reduce((sum, d) => sum + parseFloat(d.profit), 0).toLocaleString()} MMK
          </div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-purple-600">Transactions</div>
          <div className="text-gray-900 dark:text-gray-100">
            {monthlyData.reduce((sum, d) => sum + d.transactions, 0)}
          </div>
        </div>
      </div>
    </div>
  );
};

// Sales History Table Component
const SalesHistoryTable = ({ sales, onViewDetails, onExport }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover-lift transition-all">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">🧾 Recent Sales</h3>
        <button
          onClick={onExport}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-all btn-press hover:shadow-lg flex items-center text-sm"
        >
          📥 Export
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Sale ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Date/Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Cashier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Profit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sales.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No sales recorded yet
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale.sale_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    #{sale.sale_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {new Date(sale.sale_date).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {sale.user_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {sale.items_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {parseInt(sale.total_amount).toLocaleString()} MMK
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                    {parseInt(sale.profit).toLocaleString()} MMK
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => onViewDetails(sale.sale_id)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Payment Summary Card Component
const PaymentSummaryCard = ({ title, value, subtitle, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-400'
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 hover-scale transition-all ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
        <span className="text-2xl bounce-slow">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 count-up">{value}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>
    </div>
  );
};

// Payment Methods Chart Component (Visual Pie Chart)
const PaymentMethodsChart = ({ breakdown }) => {
  if (!breakdown || breakdown.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">💳 Payment Methods Breakdown</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No payment data available</p>
      </div>
    );
  }

  const paymentMethodColors = {
    cash: { bg: 'bg-green-500', text: 'text-green-500' },
    card: { bg: 'bg-blue-500', text: 'text-blue-500' },
    mobile: { bg: 'bg-purple-500', text: 'text-purple-500' },
    other: { bg: 'bg-gray-500', text: 'text-gray-500' }
  };

  // Calculate total for percentage
  const total = breakdown.reduce((sum, item) => sum + parseFloat(item.total_amount), 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 hover-lift transition-all">
      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">💳 Payment Methods Breakdown</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visual Pie Chart (Horizontal Bars) */}
        <div>
          <div className="space-y-4">
            {breakdown.map((method) => {
              const color = paymentMethodColors[method.payment_method] || paymentMethodColors.other;
              const percentage = parseFloat(method.percentage);

              return (
                <div key={method.payment_method}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300 capitalize flex items-center">
                      <span className={`w-3 h-3 rounded-full ${color.bg} mr-2`}></span>
                      {method.payment_method}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">{percentage}%</span>
                  </div>
                  <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-8">
                    <div
                      className={`${color.bg} h-8 rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(percentage, 5)}%` }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-semibold">
                        {method.transaction_count} transactions
                      </span>
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100 bg-white/90 dark:bg-gray-800/90 px-2 py-0.5 rounded">
                        {parseInt(method.total_amount).toLocaleString()} MMK
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Table */}
        <div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Payment Summary</h4>
            <div className="space-y-2">
              {breakdown.map((method) => {
                const color = paymentMethodColors[method.payment_method] || paymentMethodColors.other;
                return (
                  <div key={method.payment_method} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600 last:border-0">
                    <span className={`font-medium capitalize ${color.text}`}>
                      {method.payment_method}
                    </span>
                    <div className="text-right">
                      <div className="font-bold text-gray-900 dark:text-gray-100">
                        {parseInt(method.total_amount).toLocaleString()} MMK
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Avg: {parseInt(method.avg_amount).toLocaleString()} MMK
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t-2 border-gray-300 dark:border-gray-600">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800 dark:text-gray-100">Total</span>
                <span className="font-bold text-xl text-blue-600 dark:text-blue-400">
                  {parseInt(total).toLocaleString()} MMK
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sale Details Modal Component
const SaleDetailsModal = ({ sale, onClose }) => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-500/30 via-purple-500/30 to-pink-500/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto fade-in-up hover-lift">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-gradient-to-r from-blue-400 to-purple-400">
            <h3 className="text-2xl font-bold flex items-center">
              <span className="mr-3 text-3xl pulse">🧾</span>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Sale #{sale.sale_id} Details
              </span>
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-red-500 text-2xl transition-all btn-press hover:rotate-90"
            >
              ✕
            </button>
          </div>

          {/* Sale Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 stagger-children">
            <div className="fade-in bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                <span className="mr-2">📅</span>
                Date/Time
              </div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{new Date(sale.sale_date).toLocaleString()}</div>
            </div>
            <div className="fade-in bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                <span className="mr-2">👤</span>
                Cashier
              </div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{sale.user_name}</div>
            </div>
            <div className="fade-in bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                <span className="mr-2">💰</span>
                Total Amount
              </div>
              <div className="font-medium text-blue-600 dark:text-blue-400 count-up">
                {parseInt(sale.total_amount).toLocaleString()} MMK
              </div>
            </div>
            <div className="fade-in bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                <span className="mr-2">📈</span>
                Profit
              </div>
              <div className="font-medium text-green-600 dark:text-green-400 count-up">
                {parseInt(sale.profit).toLocaleString()} MMK
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-6 fade-in">
            <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center">
              <span className="mr-2">🛒</span>
              Items Sold
            </h4>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      📦 Product
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      🔢 Quantity
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      💵 Unit Price
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      💰 Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 stagger-children">
                  {sale.items?.map((item) => (
                    <tr key={item.sale_item_id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-all fade-in">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{item.product_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {parseInt(item.unit_price).toLocaleString()} MMK
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                        {parseInt(item.subtotal).toLocaleString()} MMK
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {sale.notes && (
            <div className="mb-6 fade-in">
              <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center">
                <span className="mr-2">📝</span>
                Notes
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                {sale.notes}
              </p>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 rounded-lg font-medium transition-all btn-press shadow-md hover:shadow-lg"
          >
            ✅ Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
