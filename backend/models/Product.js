const { pool } = require('../config/database');

class Product {
  /**
   * Find all products with optional filters
   * @param {Object} filters - {category, low_stock, search}
   * @returns {Promise<Array>} Array of products with is_low_stock calculated field
   */
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT
          product_id,
          name,
          category,
          price,
          cost_price,
          stock_quantity,
          low_stock_threshold,
          sku,
          description,
          last_restock_date,
          restock_frequency,
          created_at,
          updated_at,
          (stock_quantity <= low_stock_threshold) AS is_low_stock
        FROM products
        WHERE 1=1
      `;
      const params = [];

      // Category filter
      if (filters.category) {
        query += ' AND category = ?';
        params.push(filters.category);
      }

      // Low stock filter
      if (filters.low_stock === 'true' || filters.low_stock === true) {
        query += ' AND stock_quantity <= low_stock_threshold';
      }

      // Search filter (name or SKU)
      if (filters.search) {
        query += ' AND (name LIKE ? OR sku LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm);
      }

      query += ' ORDER BY name ASC';

      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find product by ID
   * @param {number} productId
   * @returns {Promise<Object|null>} Product object or null
   */
  static async findById(productId) {
    try {
      const [rows] = await pool.query(
        `SELECT
          product_id,
          name,
          category,
          price,
          cost_price,
          stock_quantity,
          low_stock_threshold,
          sku,
          description,
          last_restock_date,
          restock_frequency,
          created_at,
          updated_at,
          (stock_quantity <= low_stock_threshold) AS is_low_stock
        FROM products
        WHERE product_id = ?`,
        [productId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create new product
   * @param {Object} productData - Product fields
   * @returns {Promise<number>} Inserted product_id
   */
  static async create(productData) {
    try {
      const {
        name,
        category,
        price,
        cost_price,
        stock_quantity,
        low_stock_threshold,
        sku,
        description,
        last_restock_date,
        restock_frequency
      } = productData;

      const [result] = await pool.query(
        `INSERT INTO products
        (name, category, price, cost_price, stock_quantity, low_stock_threshold, sku, description, last_restock_date, restock_frequency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          category || null,
          price,
          cost_price,
          stock_quantity || 0,
          low_stock_threshold || 10,
          sku || null,
          description || null,
          last_restock_date || null,
          restock_frequency || 30
        ]
      );
      return result.insertId;
    } catch (error) {
      // Handle duplicate SKU error
      if (error.code === 'ER_DUP_ENTRY') {
        const duplicateError = new Error('SKU already exists');
        duplicateError.code = 'DUPLICATE_SKU';
        throw duplicateError;
      }
      throw error;
    }
  }

  /**
   * Update product
   * @param {number} productId
   * @param {Object} productData - Fields to update
   * @returns {Promise<number>} Affected rows count
   */
  static async update(productId, productData) {
    try {
      const fields = [];
      const values = [];

      // Build dynamic update query
      const allowedFields = [
        'name',
        'category',
        'price',
        'cost_price',
        'stock_quantity',
        'low_stock_threshold',
        'sku',
        'description',
        'last_restock_date',
        'restock_frequency'
      ];

      allowedFields.forEach((field) => {
        if (productData.hasOwnProperty(field)) {
          fields.push(`${field} = ?`);
          values.push(productData[field]);
        }
      });

      if (fields.length === 0) {
        return 0; // No fields to update
      }

      values.push(productId);

      const [result] = await pool.query(
        `UPDATE products SET ${fields.join(', ')} WHERE product_id = ?`,
        values
      );

      return result.affectedRows;
    } catch (error) {
      // Handle duplicate SKU error
      if (error.code === 'ER_DUP_ENTRY') {
        const duplicateError = new Error('SKU already exists');
        duplicateError.code = 'DUPLICATE_SKU';
        throw duplicateError;
      }
      throw error;
    }
  }

  /**
   * Delete product
   * @param {number} productId
   * @returns {Promise<number>} Affected rows count
   */
  static async delete(productId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM products WHERE product_id = ?',
        [productId]
      );
      return result.affectedRows;
    } catch (error) {
      // Handle foreign key constraint error (product has sales history)
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        const constraintError = new Error(
          'Cannot delete product with existing sales history'
        );
        constraintError.code = 'HAS_SALES_HISTORY';
        throw constraintError;
      }
      throw error;
    }
  }

  /**
   * Get historical stock data for ML training
   * @param {number} productId
   * @param {number} days - Number of days of history
   * @returns {Promise<Array>} Historical data points
   */
  static async getHistoricalStockData(productId, days = 90) {
    try {
      const [rows] = await pool.query(
        `SELECT
          DATE(sale_date) as date,
          SUM(si.quantity) as quantity_sold
        FROM sales s
        JOIN sale_items si ON s.sale_id = si.sale_id
        WHERE si.product_id = ?
          AND sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(sale_date)
        ORDER BY date ASC`,
        [productId, days]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique categories
   * @returns {Promise<Array>} Array of category names
   */
  static async getCategories() {
    try {
      const [rows] = await pool.query(
        'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category ASC'
      );
      return rows.map((row) => row.category);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Product;
