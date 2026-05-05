import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import Sidebar from '../components/Sidebar';

const ReportsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

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
      <div className="min-h-screen bg-page">
        <Sidebar isDark={isDark} toggleTheme={toggleTheme} />
        <div className="ml-0 md:ml-20 lg:ml-28 flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-accent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      {/* Main Content */}
      <div className="ml-0 md:ml-20 lg:ml-28 px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-primary mb-6 fade-in">
          📊 Business Reports & Analytics
        </h2>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6 shake">
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
              <h3 className="text-2xl font-bold text-primary fade-in">
                💳 Payment Analytics
              </h3>
              <div className="flex items-center gap-3">
                <select
                  value={paymentDateRange}
                  onChange={(e) => setPaymentDateRange(e.target.value)}
                  className="px-4 py-2 border border-default bg-surface text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                >
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 3 Months</option>
                  <option value="180">Last 6 Months</option>
                  <option value="365">Last Year</option>
                </select>
                <button
                  onClick={handleExportPaymentReport}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full transition-all btn-press hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent flex items-center"
                >
                  📥 Export CSV
                </button>
              </div>
            </div>

            {/* Date Range Display */}
            <div className="text-sm text-muted mb-4 text-center">
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
  // Left border accent — semantic color hint, mode-aware so it's visible on both surfaces.
  const accentClasses = {
    blue: 'border-l-blue-500 dark:border-l-blue-400',
    green: 'border-l-emerald-500 dark:border-l-emerald-400',
    orange: 'border-l-orange-500 dark:border-l-orange-400',
    purple: 'border-l-purple-500 dark:border-l-purple-400'
  };

  return (
    <div className={`bg-surface border border-default border-l-4 ${accentClasses[color]} rounded-lg shadow-md p-6 hover-scale transition-all`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted">{title}</h3>
        <span className="text-2xl bounce-slow">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-primary mb-1 count-up">{value}</div>
      <div className="text-sm text-muted">{subtitle}</div>
    </div>
  );
};

// Top Products Chart Component (Simple Bar Visualization)
const TopProductsChart = ({ topProducts }) => {
  const maxRevenue = Math.max(...topProducts.map((p) => parseFloat(p.revenue)), 1);

  return (
    <div className="bg-surface border border-default rounded-lg shadow-md p-6 hover-lift transition-all">
      <h3 className="text-xl font-bold text-primary mb-4">🏆 Top Products Today</h3>
      {topProducts.length === 0 ? (
        <p className="text-muted text-center py-8">No sales today</p>
      ) : (
        <div className="space-y-4">
          {topProducts.map((product) => {
            const widthPercent = (parseFloat(product.revenue) / maxRevenue) * 100;
            return (
              <div key={product.product_id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-primary">{product.name}</span>
                  <span className="text-muted">{product.quantity_sold} sold</span>
                </div>
                <div className="w-full bg-elevated rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${widthPercent}%` }}
                  ></div>
                </div>
                <div className="text-xs text-muted mt-1">
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
    <div className="bg-surface border border-default rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold text-primary mb-4">Low Stock Alert</h3>
      {products.length === 0 ? (
        <p className="text-emerald-700 dark:text-emerald-400 text-center py-8">✅ All products well-stocked!</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {products.map((product) => (
            <div
              key={product.product_id}
              className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
            >
              <div>
                <div className="font-medium text-primary">{product.name}</div>
                <div className="text-sm text-muted">{product.category}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-red-700 dark:text-red-400">{product.stock_quantity}</div>
                <div className="text-xs text-muted">/ {product.low_stock_threshold}</div>
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
    <div className="bg-surface border border-default rounded-lg shadow-md p-6 mb-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-primary">Sales Trend</h3>
        <select
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value)}
          className="px-4 py-2 border border-default bg-surface text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
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
                  <div className="text-xs text-muted mt-2 transform -rotate-45">
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
          <div className="font-semibold text-blue-700 dark:text-blue-400">Revenue</div>
          <div className="text-primary">
            {monthlyData.reduce((sum, d) => sum + parseFloat(d.sales), 0).toLocaleString()} MMK
          </div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-emerald-700 dark:text-emerald-400">Profit</div>
          <div className="text-primary">
            {monthlyData.reduce((sum, d) => sum + parseFloat(d.profit), 0).toLocaleString()} MMK
          </div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-purple-700 dark:text-purple-400">Transactions</div>
          <div className="text-primary">
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
    <div className="bg-surface border border-default rounded-lg shadow-md p-6 hover-lift transition-all">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-primary">🧾 Recent Sales</h3>
        <button
          onClick={onExport}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full transition-all btn-press hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent flex items-center text-sm"
        >
          📥 Export
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--color-default)]">
          <thead className="bg-section">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">
                Sale ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">
                Date/Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">
                Cashier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">
                Profit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-[var(--color-default)]">
            {sales.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-muted">
                  No sales recorded yet
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale.sale_id} className="hover:bg-section">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                    #{sale.sale_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                    {new Date(sale.sale_date).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                    {sale.user_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                    {sale.items_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary">
                    {parseInt(sale.total_amount).toLocaleString()} MMK
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-700 dark:text-emerald-400">
                    {parseInt(sale.profit).toLocaleString()} MMK
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => onViewDetails(sale.sale_id)}
                      className="text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 focus:outline-none focus:ring-2 focus:ring-accent rounded"
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
  // Left border accent — semantic color hint, mode-aware.
  const accentClasses = {
    blue: 'border-l-blue-500 dark:border-l-blue-400',
    green: 'border-l-emerald-500 dark:border-l-emerald-400',
    purple: 'border-l-purple-500 dark:border-l-purple-400',
    orange: 'border-l-orange-500 dark:border-l-orange-400'
  };

  return (
    <div className={`bg-surface border border-default border-l-4 ${accentClasses[color]} rounded-lg shadow-md p-6 hover-scale transition-all`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted">{title}</h3>
        <span className="text-2xl bounce-slow">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-primary mb-1 count-up">{value}</div>
      <div className="text-sm text-muted">{subtitle}</div>
    </div>
  );
};

// Payment Methods Chart Component (Visual Pie Chart)
const PaymentMethodsChart = ({ breakdown }) => {
  if (!breakdown || breakdown.length === 0) {
    return (
      <div className="bg-surface border border-default rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-xl font-bold text-primary mb-4">💳 Payment Methods Breakdown</h3>
        <p className="text-muted text-center py-8">No payment data available</p>
      </div>
    );
  }

  // Bar color (semantic, mode-agnostic) and label color (mode-aware for AA contrast).
  const paymentMethodColors = {
    cash: { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
    card: { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
    mobile: { bg: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-400' },
    other: { bg: 'bg-slate-500', text: 'text-slate-700 dark:text-slate-400' }
  };

  // Calculate total for percentage
  const total = breakdown.reduce((sum, item) => sum + parseFloat(item.total_amount), 0);

  return (
    <div className="bg-surface border border-default rounded-lg shadow-md p-6 mb-8 hover-lift transition-all">
      <h3 className="text-xl font-bold text-primary mb-6">💳 Payment Methods Breakdown</h3>

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
                    <span className="font-medium text-primary capitalize flex items-center">
                      <span className={`w-3 h-3 rounded-full ${color.bg} mr-2`}></span>
                      {method.payment_method}
                    </span>
                    <span className="text-muted">{percentage}%</span>
                  </div>
                  <div className="relative w-full bg-elevated rounded-full h-8">
                    <div
                      className={`${color.bg} h-8 rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(percentage, 5)}%` }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className="text-xs text-primary font-semibold">
                        {method.transaction_count} transactions
                      </span>
                      <span className="text-xs font-bold text-primary bg-surface/90 px-2 py-0.5 rounded">
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
          <div className="bg-section rounded-lg p-4">
            <h4 className="font-semibold text-primary mb-3">Payment Summary</h4>
            <div className="space-y-2">
              {breakdown.map((method) => {
                const color = paymentMethodColors[method.payment_method] || paymentMethodColors.other;
                return (
                  <div key={method.payment_method} className="flex justify-between items-center py-2 border-b border-default last:border-0">
                    <span className={`font-medium capitalize ${color.text}`}>
                      {method.payment_method}
                    </span>
                    <div className="text-right">
                      <div className="font-bold text-primary">
                        {parseInt(method.total_amount).toLocaleString()} MMK
                      </div>
                      <div className="text-xs text-muted">
                        Avg: {parseInt(method.avg_amount).toLocaleString()} MMK
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t-2 border-default">
              <div className="flex justify-between items-center">
                <span className="font-bold text-primary">Total</span>
                <span className="font-bold text-xl text-blue-700 dark:text-blue-400">
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
      <div className="bg-elevated border border-default rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto fade-in-up hover-lift">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-default">
            <h3 className="text-2xl font-bold flex items-center text-primary">
              <span className="mr-3 text-3xl pulse">🧾</span>
              Sale #{sale.sale_id} Details
            </h3>
            <button
              onClick={onClose}
              className="text-muted hover:text-red-500 text-2xl transition-all btn-press hover:rotate-90 focus:outline-none focus:ring-2 focus:ring-accent rounded"
            >
              ✕
            </button>
          </div>

          {/* Sale Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 stagger-children">
            <div className="fade-in bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-muted flex items-center">
                <span className="mr-2">📅</span>
                Date/Time
              </div>
              <div className="font-medium text-primary">{new Date(sale.sale_date).toLocaleString()}</div>
            </div>
            <div className="fade-in bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-sm text-muted flex items-center">
                <span className="mr-2">👤</span>
                Cashier
              </div>
              <div className="font-medium text-primary">{sale.user_name}</div>
            </div>
            <div className="fade-in bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="text-sm text-muted flex items-center">
                <span className="mr-2">💰</span>
                Total Amount
              </div>
              <div className="font-medium text-blue-700 dark:text-blue-400 count-up">
                {parseInt(sale.total_amount).toLocaleString()} MMK
              </div>
            </div>
            <div className="fade-in bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="text-sm text-muted flex items-center">
                <span className="mr-2">📈</span>
                Profit
              </div>
              <div className="font-medium text-emerald-700 dark:text-emerald-400 count-up">
                {parseInt(sale.profit).toLocaleString()} MMK
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-6 fade-in">
            <h4 className="font-semibold text-primary mb-3 flex items-center">
              <span className="mr-2">🛒</span>
              Items Sold
            </h4>
            <div className="overflow-x-auto rounded-lg border border-default">
              <table className="min-w-full divide-y divide-[var(--color-default)]">
                <thead className="bg-section">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted">
                      📦 Product
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted">
                      🔢 Quantity
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted">
                      💵 Unit Price
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted">
                      💰 Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-default)] stagger-children">
                  {sale.items?.map((item) => (
                    <tr key={item.sale_item_id} className="hover:bg-section transition-all fade-in">
                      <td className="px-4 py-2 text-sm font-medium text-primary">{item.product_name}</td>
                      <td className="px-4 py-2 text-sm text-muted">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm text-muted">
                        {parseInt(item.unit_price).toLocaleString()} MMK
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400">
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
              <h4 className="font-semibold text-primary mb-2 flex items-center">
                <span className="mr-2">📝</span>
                Notes
              </h4>
              <p className="text-muted text-sm bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                {sale.notes}
              </p>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full bg-btn-primary-bg hover:opacity-90 text-btn-primary-text py-3 rounded-full font-medium transition-all btn-press shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent"
          >
            ✅ Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
