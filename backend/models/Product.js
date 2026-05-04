const { pool } = require('../config/database');
const Promotion = require('./Promotion');

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
          image,
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
          image,
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
        image,
        last_restock_date,
        restock_frequency
      } = productData;

      const [result] = await pool.query(
        `INSERT INTO products
        (name, category, price, cost_price, stock_quantity, low_stock_threshold, sku, description, image, last_restock_date, restock_frequency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          category || null,
          price,
          cost_price,
          stock_quantity || 0,
          low_stock_threshold || 10,
          sku || null,
          description || null,
          image || null,
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
        'image',
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

  /**
   * Find all products with active promotions applied
   * @param {Object} filters - {category, low_stock, search}
   * @returns {Promise<Array>} Array of products with promotion info
   */
  static async findAllWithPromotions(filters = {}) {
    try {
      // Get all products
      const products = await this.findAll(filters);

      // Get all active promotions
      const activePromotions = await Promotion.getActivePromotions();
      console.log('🎁 Active promotions found:', activePromotions.length);
      if (activePromotions.length > 0) {
        console.log('📋 Promotions:', activePromotions.map(p => ({
          id: p.promotion_id,
          name: p.name,
          applies_to: p.applies_to,
          is_active: p.is_active,
          dates: `${p.start_date} to ${p.end_date}`,
          times: `${p.start_time} to ${p.end_time}`
        })));
      }

      // Apply promotions to products
      const productsWithPromotions = products.map((product) => {
        // Find applicable promotions for this product
        const applicablePromotions = activePromotions.filter((promo) => {
          // Check if promotion applies to this product
          if (promo.applies_to === 'all') {
            return true;
          } else if (promo.applies_to === 'products') {
            // Check if product is in promotion's product list
            return promo.products && promo.products.some(p => p.product_id === product.product_id);
          } else if (promo.applies_to === 'categories') {
            // Check if product's category is in promotion's category list
            return promo.categories && promo.categories.includes(product.category);
          }
          return false;
        });

        // If there are applicable promotions, apply the best one (highest priority, then highest discount)
        if (applicablePromotions.length > 0) {
          // Sort by priority (desc) then by discount amount (desc)
          applicablePromotions.sort((a, b) => {
            if (b.priority !== a.priority) {
              return b.priority - a.priority;
            }
            // Calculate discount amounts for comparison
            const discountA = Promotion.calculatePromotionDiscount(a, product.price);
            const discountB = Promotion.calculatePromotionDiscount(b, product.price);
            return discountB - discountA;
          });

          const bestPromotion = applicablePromotions[0];
          const discountAmount = Promotion.calculatePromotionDiscount(bestPromotion, product.price);
          const promotionalPrice = product.price - discountAmount;

          return {
            ...product,
            has_promotion: true,
            promotion: {
              promotion_id: bestPromotion.promotion_id,
              name: bestPromotion.name,
              discount_type: bestPromotion.discount_type,
              discount_value: bestPromotion.discount_value,
              discount_amount: discountAmount
            },
            original_price: product.price,
            promotional_price: promotionalPrice,
            price: promotionalPrice // Override price with promotional price
          };
        }

        // No promotion applies
        return {
          ...product,
          has_promotion: false
        };
      });

      return productsWithPromotions;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Product;
