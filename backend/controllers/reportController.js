const { pool } = require('../config/database');

/**
 * Get daily sales report (today)
 * GET /api/reports/daily
 */
exports.getDailySalesReport = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's sales summary
    const [salesSummary] = await pool.query(
      `SELECT
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(profit), 0) as total_profit,
        COUNT(*) as transactions_count,
        COALESCE(SUM((SELECT SUM(quantity) FROM sale_items WHERE sale_id = sales.sale_id)), 0) as items_sold
      FROM sales
      WHERE DATE(sale_date) = CURDATE()`,
      []
    );

    // Get top 5 products sold today
    const [topProducts] = await pool.query(
      `SELECT
        p.product_id,
        p.name,
        p.category,
        SUM(si.quantity) as quantity_sold,
        SUM(si.subtotal) as revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.product_id
      JOIN sales s ON si.sale_id = s.sale_id
      WHERE DATE(s.sale_date) = CURDATE()
      GROUP BY p.product_id, p.name, p.category
      ORDER BY quantity_sold DESC
      LIMIT 5`,
      []
    );

    // Get hourly sales breakdown for today
    const [hourlySales] = await pool.query(
      `SELECT
        HOUR(sale_date) as hour,
        COUNT(*) as transactions,
        SUM(total_amount) as sales
      FROM sales
      WHERE DATE(sale_date) = CURDATE()
      GROUP BY HOUR(sale_date)
      ORDER BY hour ASC`,
      []
    );

    const report = {
      date: new Date().toISOString().split('T')[0],
      summary: {
        total_sales: parseFloat(salesSummary[0].total_sales || 0).toFixed(2),
        total_cost: parseFloat(salesSummary[0].total_cost || 0).toFixed(2),
        total_profit: parseFloat(salesSummary[0].total_profit || 0).toFixed(2),
        transactions_count: salesSummary[0].transactions_count,
        items_sold: parseInt(salesSummary[0].items_sold || 0)
      },
      top_products: topProducts.map((p) => ({
        product_id: p.product_id,
        name: p.name,
        category: p.category,
        quantity_sold: p.quantity_sold,
        revenue: parseFloat(p.revenue).toFixed(2)
      })),
      hourly_breakdown: hourlySales.map((h) => ({
        hour: h.hour,
        transactions: h.transactions,
        sales: parseFloat(h.sales).toFixed(2)
      }))
    };

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get daily sales report error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve daily sales report',
        details: error.message
      }
    });
  }
};

/**
 * Get monthly sales report with daily breakdown
 * GET /api/reports/monthly?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
exports.getMonthlySalesReport = async (req, res) => {
  try {
    let { start_date, end_date } = req.query;

    // Default to last 30 days if not provided
    if (!end_date) {
      end_date = new Date().toISOString().split('T')[0];
    }

    if (!start_date) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      start_date = thirtyDaysAgo.toISOString().split('T')[0];
    }

    // Get daily sales breakdown
    const [dailySales] = await pool.query(
      `SELECT
        DATE(sale_date) as date,
        COUNT(*) as transactions,
        COALESCE(SUM(total_amount), 0) as sales,
        COALESCE(SUM(profit), 0) as profit
      FROM sales
      WHERE DATE(sale_date) BETWEEN ? AND ?
      GROUP BY DATE(sale_date)
      ORDER BY date ASC`,
      [start_date, end_date]
    );

    // Generate full date range (including days with zero sales)
    const dateRange = [];
    const currentDate = new Date(start_date);
    const endDateObj = new Date(end_date);

    while (currentDate <= endDateObj) {
      dateRange.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Create map of sales by date
    const salesMap = {};
    dailySales.forEach((day) => {
      const dateStr = new Date(day.date).toISOString().split('T')[0];
      salesMap[dateStr] = {
        transactions: day.transactions,
        sales: parseFloat(day.sales).toFixed(2),
        profit: parseFloat(day.profit).toFixed(2)
      };
    });

    // Fill in missing dates with zeros
    const dailyBreakdown = dateRange.map((date) => ({
      date,
      transactions: salesMap[date]?.transactions || 0,
      sales: salesMap[date]?.sales || '0.00',
      profit: salesMap[date]?.profit || '0.00'
    }));

    // Calculate period totals
    const totalSales = dailyBreakdown.reduce((sum, day) => sum + parseFloat(day.sales), 0);
    const totalProfit = dailyBreakdown.reduce((sum, day) => sum + parseFloat(day.profit), 0);
    const totalTransactions = dailyBreakdown.reduce((sum, day) => sum + day.transactions, 0);

    const report = {
      period: {
        start_date,
        end_date
      },
      totals: {
        total_sales: totalSales.toFixed(2),
        total_profit: totalProfit.toFixed(2),
        total_transactions: totalTransactions
      },
      daily_breakdown: dailyBreakdown
    };

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get monthly sales report error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve monthly sales report',
        details: error.message
      }
    });
  }
};

/**
 * Get inventory status report
 * GET /api/reports/inventory
 */
exports.getInventoryStatusReport = async (req, res) => {
  try {
    // Get inventory summary
    const [summary] = await pool.query(
      `SELECT
        COUNT(*) as total_products,
        SUM(CASE WHEN stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count,
        COALESCE(SUM(stock_quantity * cost_price), 0) as total_inventory_value
      FROM products`,
      []
    );

    // Get low stock products
    const [lowStockProducts] = await pool.query(
      `SELECT
        product_id,
        name,
        category,
        sku,
        stock_quantity,
        low_stock_threshold,
        price,
        cost_price
      FROM products
      WHERE stock_quantity <= low_stock_threshold AND stock_quantity > 0
      ORDER BY stock_quantity ASC`,
      []
    );

    // Get out of stock products
    const [outOfStockProducts] = await pool.query(
      `SELECT
        product_id,
        name,
        category,
        sku,
        price,
        cost_price
      FROM products
      WHERE stock_quantity = 0
      ORDER BY name ASC`,
      []
    );

    // Get top value products (by inventory value)
    const [topValueProducts] = await pool.query(
      `SELECT
        product_id,
        name,
        category,
        stock_quantity,
        cost_price,
        (stock_quantity * cost_price) as inventory_value
      FROM products
      WHERE stock_quantity > 0
      ORDER BY inventory_value DESC
      LIMIT 10`,
      []
    );

    const report = {
      summary: {
        total_products: summary[0].total_products,
        low_stock_count: summary[0].low_stock_count,
        out_of_stock_count: summary[0].out_of_stock_count,
        total_inventory_value: parseFloat(summary[0].total_inventory_value).toFixed(2)
      },
      low_stock_products: lowStockProducts.map((p) => ({
        product_id: p.product_id,
        name: p.name,
        category: p.category,
        sku: p.sku,
        stock_quantity: p.stock_quantity,
        low_stock_threshold: p.low_stock_threshold,
        price: parseFloat(p.price).toFixed(2),
        cost_price: parseFloat(p.cost_price).toFixed(2)
      })),
      out_of_stock_products: outOfStockProducts.map((p) => ({
        product_id: p.product_id,
        name: p.name,
        category: p.category,
        sku: p.sku,
        price: parseFloat(p.price).toFixed(2),
        cost_price: parseFloat(p.cost_price).toFixed(2)
      })),
      top_value_products: topValueProducts.map((p) => ({
        product_id: p.product_id,
        name: p.name,
        category: p.category,
        stock_quantity: p.stock_quantity,
        cost_price: parseFloat(p.cost_price).toFixed(2),
        inventory_value: parseFloat(p.inventory_value).toFixed(2)
      }))
    };

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get inventory status report error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve inventory status report',
        details: error.message
      }
    });
  }
};

/**
 * Get payment method breakdown report
 * GET /api/reports/payment-methods?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
exports.getPaymentMethodsReport = async (req, res) => {
  try {
    let { start_date, end_date } = req.query;

    // Default to last 30 days if not provided
    if (!end_date) {
      end_date = new Date().toISOString().split('T')[0];
    }

    if (!start_date) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      start_date = thirtyDaysAgo.toISOString().split('T')[0];
    }

    // Get payment method breakdown
    const [paymentBreakdown] = await pool.query(
      `SELECT
        p.payment_method,
        COUNT(DISTINCT p.sale_id) as transaction_count,
        COALESCE(SUM(p.amount), 0) as total_amount,
        COALESCE(AVG(p.amount), 0) as avg_amount
      FROM payments p
      JOIN sales s ON p.sale_id = s.sale_id
      WHERE DATE(s.sale_date) BETWEEN ? AND ?
      GROUP BY p.payment_method
      ORDER BY total_amount DESC`,
      [start_date, end_date]
    );

    // Calculate totals
    const totalTransactions = paymentBreakdown.reduce((sum, p) => sum + parseInt(p.transaction_count), 0);
    const totalAmount = paymentBreakdown.reduce((sum, p) => sum + parseFloat(p.total_amount), 0);

    // Add percentages
    const breakdown = paymentBreakdown.map((p) => ({
      payment_method: p.payment_method,
      transaction_count: parseInt(p.transaction_count),
      total_amount: parseFloat(p.total_amount).toFixed(2),
      avg_amount: parseFloat(p.avg_amount).toFixed(2),
      percentage: totalAmount > 0 ? ((parseFloat(p.total_amount) / totalAmount) * 100).toFixed(2) : '0.00'
    }));

    // Calculate cash vs cashless
    const cashAmount = breakdown.find(p => p.payment_method === 'cash')?.total_amount || '0.00';
    const cashlessAmount = breakdown
      .filter(p => p.payment_method !== 'cash')
      .reduce((sum, p) => sum + parseFloat(p.total_amount), 0);

    const report = {
      period: {
        start_date,
        end_date
      },
      summary: {
        total_transactions: totalTransactions,
        total_amount: totalAmount.toFixed(2),
        cash_amount: cashAmount,
        cashless_amount: cashlessAmount.toFixed(2),
        cash_percentage: totalAmount > 0 ? ((parseFloat(cashAmount) / totalAmount) * 100).toFixed(2) : '0.00',
        cashless_percentage: totalAmount > 0 ? ((cashlessAmount / totalAmount) * 100).toFixed(2) : '0.00'
      },
      breakdown
    };

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get payment methods report error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve payment methods report',
        details: error.message
      }
    });
  }
};

/**
 * Get payment trends over time
 * GET /api/reports/payment-trends?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&interval=daily
 */
exports.getPaymentTrendsReport = async (req, res) => {
  try {
    let { start_date, end_date, interval } = req.query;

    // Default to last 30 days if not provided
    if (!end_date) {
      end_date = new Date().toISOString().split('T')[0];
    }

    if (!start_date) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      start_date = thirtyDaysAgo.toISOString().split('T')[0];
    }

    // Default interval to daily
    interval = interval || 'daily';

    // Build date grouping based on interval
    let dateGrouping = 'DATE(s.sale_date)';
    if (interval === 'weekly') {
      dateGrouping = 'YEARWEEK(s.sale_date, 1)';
    } else if (interval === 'monthly') {
      dateGrouping = 'DATE_FORMAT(s.sale_date, "%Y-%m")';
    }

    // Get payment trends grouped by date and payment method
    const [trends] = await pool.query(
      `SELECT
        ${dateGrouping} as period,
        p.payment_method,
        COUNT(DISTINCT p.sale_id) as transaction_count,
        COALESCE(SUM(p.amount), 0) as total_amount
      FROM payments p
      JOIN sales s ON p.sale_id = s.sale_id
      WHERE DATE(s.sale_date) BETWEEN ? AND ?
      GROUP BY period, p.payment_method
      ORDER BY period ASC, p.payment_method ASC`,
      [start_date, end_date]
    );

    // Transform data for easier charting
    const trendData = {};
    trends.forEach((t) => {
      const period = t.period.toString();
      if (!trendData[period]) {
        trendData[period] = {
          period,
          total: 0,
          methods: {}
        };
      }
      trendData[period].methods[t.payment_method] = {
        transaction_count: parseInt(t.transaction_count),
        amount: parseFloat(t.total_amount)
      };
      trendData[period].total += parseFloat(t.total_amount);
    });

    const report = {
      period: {
        start_date,
        end_date
      },
      interval,
      trends: Object.values(trendData).map(t => ({
        ...t,
        total: t.total.toFixed(2)
      }))
    };

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get payment trends report error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve payment trends report',
        details: error.message
      }
    });
  }
};
