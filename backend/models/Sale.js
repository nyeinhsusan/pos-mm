const { pool } = require('../config/database');
const Product = require('./Product');
const Payment = require('./Payment');

class Sale {
  /**
   * Create a new sale with transaction support
   * @param {Object} saleData - {user_id, items: [{product_id, quantity}], notes, payments: [{payment_method, amount, transaction_id}]}
   * @returns {Promise<Object>} Sale details with updated stock levels and payment information
   */
  static async create(saleData) {
    const connection = await pool.getConnection();

    try {
      // Start transaction
      await connection.beginTransaction();

      const { user_id, items, notes, payments } = saleData;

      // Validate items array
      if (!items || items.length === 0) {
        throw new Error('Sale must contain at least one item');
      }

      // Step 1: Validate all products exist and have sufficient stock
      // Lock product rows for update to prevent race conditions
      const productIds = items.map((item) => item.product_id);
      const placeholders = productIds.map(() => '?').join(',');

      const [products] = await connection.query(
        `SELECT product_id, name, price, cost_price, stock_quantity
         FROM products
         WHERE product_id IN (${placeholders})
         FOR UPDATE`, // Lock rows for update
        productIds
      );

      // Create a map for quick lookup
      const productMap = {};
      products.forEach((product) => {
        productMap[product.product_id] = product;
      });

      // Validate each item
      let total_amount = 0;
      let total_cost = 0;
      const validatedItems = [];

      for (const item of items) {
        const product = productMap[item.product_id];

        if (!product) {
          throw new Error(`Product ID ${item.product_id} not found`);
        }

        if (product.stock_quantity < item.quantity) {
          throw new Error(
            `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}, Requested: ${item.quantity}`
          );
        }

        if (item.quantity <= 0) {
          throw new Error('Item quantity must be greater than 0');
        }

        const subtotal = product.price * item.quantity;
        const item_cost = product.cost_price * item.quantity;

        total_amount += parseFloat(subtotal);
        total_cost += parseFloat(item_cost);

        validatedItems.push({
          product_id: item.product_id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: product.price,
          unit_cost: product.cost_price,
          subtotal: subtotal
        });
      }

      // Step 2: Insert sale record
      const [saleResult] = await connection.query(
        'INSERT INTO sales (user_id, total_amount, total_cost, notes) VALUES (?, ?, ?, ?)',
        [user_id, total_amount, total_cost, notes || null]
      );

      const sale_id = saleResult.insertId;

      // Step 3: Insert sale items and update stock
      for (const item of validatedItems) {
        // Insert sale item
        await connection.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost)
           VALUES (?, ?, ?, ?, ?)`,
          [sale_id, item.product_id, item.quantity, item.unit_price, item.unit_cost]
        );

        // Decrement stock quantity
        await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
      }

      // Step 4: Handle payments (if provided)
      let paymentRecords = [];
      if (payments && payments.length > 0) {
        // Validate payment total matches sale total
        Payment.validatePaymentTotal(payments, total_amount);

        // Create payment records
        paymentRecords = await Payment.create(sale_id, payments, connection);
      }

      // Commit transaction
      await connection.commit();

      // Step 5: Fetch updated product stock levels
      const [updatedProducts] = await connection.query(
        `SELECT product_id, stock_quantity FROM products WHERE product_id IN (${placeholders})`,
        productIds
      );

      const updatedStockMap = {};
      updatedProducts.forEach((p) => {
        updatedStockMap[p.product_id] = p.stock_quantity;
      });

      // Return sale details
      return {
        sale_id,
        user_id,
        total_amount: parseFloat(total_amount).toFixed(2),
        total_cost: parseFloat(total_cost).toFixed(2),
        profit: (total_amount - total_cost).toFixed(2),
        items: validatedItems.map((item) => ({
          ...item,
          updated_stock: updatedStockMap[item.product_id]
        })),
        payments: paymentRecords,
        sale_date: new Date()
      };
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get all sales with pagination and filters
   * @param {Object} filters - {page, limit, start_date, end_date, user_id}
   * @returns {Promise<Object>} {sales, total_count, page, limit}
   */
  static async findAll(filters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        start_date,
        end_date,
        user_id
      } = filters;

      const offset = (page - 1) * limit;

      let query = `
        SELECT
          s.sale_id,
          s.user_id,
          u.full_name as user_name,
          s.total_amount,
          s.total_cost,
          s.profit,
          s.sale_date,
          COUNT(si.sale_item_id) as items_count
        FROM sales s
        LEFT JOIN users u ON s.user_id = u.user_id
        LEFT JOIN sale_items si ON s.sale_id = si.sale_id
        WHERE 1=1
      `;
      const params = [];

      // Date filters
      if (start_date) {
        query += ' AND s.sale_date >= ?';
        params.push(start_date);
      }

      if (end_date) {
        query += ' AND s.sale_date <= ?';
        params.push(end_date);
      }

      // User filter
      if (user_id) {
        query += ' AND s.user_id = ?';
        params.push(user_id);
      }

      query += ' GROUP BY s.sale_id ORDER BY s.sale_date DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const [sales] = await pool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM sales WHERE 1=1';
      const countParams = [];

      if (start_date) {
        countQuery += ' AND sale_date >= ?';
        countParams.push(start_date);
      }

      if (end_date) {
        countQuery += ' AND sale_date <= ?';
        countParams.push(end_date);
      }

      if (user_id) {
        countQuery += ' AND user_id = ?';
        countParams.push(user_id);
      }

      const [countResult] = await pool.query(countQuery, countParams);
      const total_count = countResult[0].total;

      return {
        sales,
        total_count,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total_count / limit)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get single sale with line items
   * @param {number} saleId
   * @returns {Promise<Object|null>} Sale with items or null
   */
  static async findById(saleId) {
    try {
      // Get sale header
      const [sales] = await pool.query(
        `SELECT
          s.sale_id,
          s.user_id,
          u.full_name as user_name,
          s.total_amount,
          s.total_cost,
          s.profit,
          s.sale_date,
          s.notes
        FROM sales s
        LEFT JOIN users u ON s.user_id = u.user_id
        WHERE s.sale_id = ?`,
        [saleId]
      );

      if (sales.length === 0) {
        return null;
      }

      const sale = sales[0];

      // Get sale items
      const [items] = await pool.query(
        `SELECT
          si.sale_item_id,
          si.product_id,
          p.name as product_name,
          si.quantity,
          si.unit_price,
          si.unit_cost,
          si.subtotal
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.product_id
        WHERE si.sale_id = ?`,
        [saleId]
      );

      sale.items = items;

      // Get payments
      const payments = await Payment.findBySaleId(saleId);
      sale.payments = payments;

      return sale;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Sale;
