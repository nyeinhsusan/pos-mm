const { pool } = require('../config/database');

class Promotion {
  /**
   * Check if promotion is currently active based on dates/times
   * @param {Object} promotion - Promotion object
   * @returns {boolean} True if promotion is active now
   */
  static isPromotionActive(promotion) {
    console.log(`\n🔍 Checking promotion: ${promotion.name} (ID: ${promotion.promotion_id})`);

    if (!promotion.is_active) {
      console.log(`❌ Promotion is_active = false`);
      return false;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format

    console.log(`📅 Today: ${today}, Current Time: ${currentTime}`);
    console.log(`📅 Promotion dates: ${promotion.start_date} to ${promotion.end_date}`);
    console.log(`⏰ Promotion times: ${promotion.start_time} to ${promotion.end_time}`);

    // Check date range
    if (today < promotion.start_date || today > promotion.end_date) {
      console.log(`❌ Date out of range: ${today} < ${promotion.start_date} || ${today} > ${promotion.end_date}`);
      return false;
    }

    // Check time range (if specified)
    if (promotion.start_time && promotion.end_time) {
      // Convert times to HH:MM format for comparison
      const startTime = promotion.start_time.substring(0, 5);
      const endTime = promotion.end_time.substring(0, 5);

      console.log(`⏰ Comparing: ${currentTime} vs ${startTime} - ${endTime}`);

      if (currentTime < startTime || currentTime > endTime) {
        console.log(`❌ Time out of range`);
        return false;
      }
    }

    console.log(`✅ Promotion is ACTIVE!`);
    return true;
  }

  /**
   * Create a new promotion
   * @param {Object} promotionData - Promotion details
   * @param {number} userId - User creating the promotion
   * @returns {Promise<Object>} Created promotion
   */
  static async create(promotionData, userId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const {
        name,
        description,
        discount_type,
        discount_value,
        start_date,
        end_date,
        start_time,
        end_time,
        applies_to,
        product_ids,
        categories,
        min_purchase_amount,
        max_discount_amount,
        is_active,
        priority
      } = promotionData;

      // Format dates from ISO to YYYY-MM-DD if provided
      const formattedStartDate = start_date ? start_date.split('T')[0] : start_date;
      const formattedEndDate = end_date ? end_date.split('T')[0] : end_date;

      // Insert promotion
      const [result] = await connection.query(
        `INSERT INTO promotions
        (name, description, discount_type, discount_value, start_date, end_date,
         start_time, end_time, applies_to, min_purchase_amount, max_discount_amount,
         is_active, priority, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          description || null,
          discount_type,
          discount_value,
          formattedStartDate,
          formattedEndDate,
          start_time || '00:00:00',
          end_time || '23:59:59',
          applies_to,
          min_purchase_amount || 0,
          max_discount_amount || null,
          is_active !== undefined ? is_active : true,
          priority || 0,
          userId
        ]
      );

      const promotion_id = result.insertId;

      // Link products if applies_to is 'products'
      if (applies_to === 'products' && product_ids && product_ids.length > 0) {
        const productValues = product_ids.map(pid => [promotion_id, pid]);
        await connection.query(
          'INSERT INTO promotion_products (promotion_id, product_id) VALUES ?',
          [productValues]
        );
      }

      // Link categories if applies_to is 'categories'
      if (applies_to === 'categories' && categories && categories.length > 0) {
        const categoryValues = categories.map(cat => [promotion_id, cat]);
        await connection.query(
          'INSERT INTO promotion_categories (promotion_id, category) VALUES ?',
          [categoryValues]
        );
      }

      await connection.commit();

      // Fetch and return created promotion with relations
      return await this.findById(promotion_id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get all promotions with filters
   * @param {Object} filters - {status, current, applies_to}
   * @returns {Promise<Array>} List of promotions
   */
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT
          p.*,
          u.full_name as created_by_name
        FROM promotions p
        LEFT JOIN users u ON p.created_by = u.user_id
        WHERE 1=1
      `;
      const params = [];

      // Filter by active status
      if (filters.status === 'active') {
        query += ' AND p.is_active = TRUE';
      } else if (filters.status === 'inactive') {
        query += ' AND p.is_active = FALSE';
      }

      // Filter by current (date/time based)
      if (filters.current === 'true' || filters.current === true) {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toTimeString().split(' ')[0].substring(0, 8);

        query += ' AND p.start_date <= ? AND p.end_date >= ?';
        params.push(today, today);

        query += ' AND p.start_time <= ? AND p.end_time >= ?';
        params.push(now, now);
      }

      // Filter by applies_to
      if (filters.applies_to) {
        query += ' AND p.applies_to = ?';
        params.push(filters.applies_to);
      }

      query += ' ORDER BY p.priority DESC, p.created_at DESC';

      const [promotions] = await pool.query(query, params);

      // Fetch related products and categories for each promotion
      for (const promotion of promotions) {
        // Format dates to YYYY-MM-DD for frontend
        if (promotion.start_date) {
          promotion.start_date = promotion.start_date.toISOString().split('T')[0];
        }
        if (promotion.end_date) {
          promotion.end_date = promotion.end_date.toISOString().split('T')[0];
        }

        if (promotion.applies_to === 'products') {
          const [products] = await pool.query(
            `SELECT pp.product_id, pr.name as product_name
             FROM promotion_products pp
             LEFT JOIN products pr ON pp.product_id = pr.product_id
             WHERE pp.promotion_id = ?`,
            [promotion.promotion_id]
          );
          promotion.products = products;
        } else if (promotion.applies_to === 'categories') {
          const [categories] = await pool.query(
            'SELECT category FROM promotion_categories WHERE promotion_id = ?',
            [promotion.promotion_id]
          );
          promotion.categories = categories.map(c => c.category);
        }
      }

      return promotions;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get active promotions for current date/time
   * @returns {Promise<Array>} Currently active promotions
   */
  static async getActivePromotions() {
    try {
      const allPromotions = await this.findAll({ status: 'active' });

      // Filter by current date/time
      return allPromotions.filter(promo => this.isPromotionActive(promo));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find promotion by ID
   * @param {number} promotionId - Promotion ID
   * @returns {Promise<Object|null>} Promotion or null
   */
  static async findById(promotionId) {
    try {
      const [rows] = await pool.query(
        `SELECT
          p.*,
          u.full_name as created_by_name
         FROM promotions p
         LEFT JOIN users u ON p.created_by = u.user_id
         WHERE p.promotion_id = ?`,
        [promotionId]
      );

      if (rows.length === 0) return null;

      const promotion = rows[0];

      // Format dates to YYYY-MM-DD for frontend
      if (promotion.start_date) {
        promotion.start_date = promotion.start_date.toISOString().split('T')[0];
      }
      if (promotion.end_date) {
        promotion.end_date = promotion.end_date.toISOString().split('T')[0];
      }

      // Fetch related products if applies_to is 'products'
      if (promotion.applies_to === 'products') {
        const [products] = await pool.query(
          `SELECT pp.product_id, pr.name as product_name, pr.price
           FROM promotion_products pp
           LEFT JOIN products pr ON pp.product_id = pr.product_id
           WHERE pp.promotion_id = ?`,
          [promotionId]
        );
        promotion.products = products;
      }

      // Fetch related categories if applies_to is 'categories'
      if (promotion.applies_to === 'categories') {
        const [categories] = await pool.query(
          'SELECT category FROM promotion_categories WHERE promotion_id = ?',
          [promotionId]
        );
        promotion.categories = categories.map(c => c.category);
      }

      return promotion;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update promotion
   * @param {number} promotionId - Promotion ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated promotion
   */
  static async update(promotionId, updateData) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const {
        name,
        description,
        discount_type,
        discount_value,
        start_date,
        end_date,
        start_time,
        end_time,
        applies_to,
        product_ids,
        categories,
        min_purchase_amount,
        max_discount_amount,
        is_active,
        priority
      } = updateData;

      // Format dates from ISO to YYYY-MM-DD if provided
      const formattedStartDate = start_date ? start_date.split('T')[0] : undefined;
      const formattedEndDate = end_date ? end_date.split('T')[0] : undefined;

      // Update promotion base fields
      await connection.query(
        `UPDATE promotions SET
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          discount_type = COALESCE(?, discount_type),
          discount_value = COALESCE(?, discount_value),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          start_time = COALESCE(?, start_time),
          end_time = COALESCE(?, end_time),
          applies_to = COALESCE(?, applies_to),
          min_purchase_amount = COALESCE(?, min_purchase_amount),
          max_discount_amount = COALESCE(?, max_discount_amount),
          is_active = COALESCE(?, is_active),
          priority = COALESCE(?, priority),
          updated_at = CURRENT_TIMESTAMP
         WHERE promotion_id = ?`,
        [
          name,
          description,
          discount_type,
          discount_value,
          formattedStartDate,
          formattedEndDate,
          start_time,
          end_time,
          applies_to,
          min_purchase_amount,
          max_discount_amount,
          is_active,
          priority,
          promotionId
        ]
      );

      // Handle applies_to changes - clean up old links when applies_to changes
      if (applies_to !== undefined) {
        // Clean up all existing links when applies_to is being updated
        await connection.query('DELETE FROM promotion_products WHERE promotion_id = ?', [promotionId]);
        await connection.query('DELETE FROM promotion_categories WHERE promotion_id = ?', [promotionId]);

        // Add new links based on the new applies_to value
        if (applies_to === 'products' && product_ids && product_ids.length > 0) {
          const productValues = product_ids.map(pid => [promotionId, pid]);
          await connection.query(
            'INSERT INTO promotion_products (promotion_id, product_id) VALUES ?',
            [productValues]
          );
        } else if (applies_to === 'categories' && categories && categories.length > 0) {
          const categoryValues = categories.map(cat => [promotionId, cat]);
          await connection.query(
            'INSERT INTO promotion_categories (promotion_id, category) VALUES ?',
            [categoryValues]
          );
        }
        // If applies_to === 'all', no links needed
      } else {
        // If applies_to is not being changed, handle product_ids and categories separately
        // Update product links if provided
        if (product_ids !== undefined) {
          await connection.query('DELETE FROM promotion_products WHERE promotion_id = ?', [promotionId]);

          if (product_ids && product_ids.length > 0) {
            const productValues = product_ids.map(pid => [promotionId, pid]);
            await connection.query(
              'INSERT INTO promotion_products (promotion_id, product_id) VALUES ?',
              [productValues]
            );
          }
        }

        // Update category links if provided
        if (categories !== undefined) {
          await connection.query('DELETE FROM promotion_categories WHERE promotion_id = ?', [promotionId]);

          if (categories && categories.length > 0) {
            const categoryValues = categories.map(cat => [promotionId, cat]);
            await connection.query(
              'INSERT INTO promotion_categories (promotion_id, category) VALUES ?',
              [categoryValues]
            );
          }
        }
      }

      await connection.commit();

      return await this.findById(promotionId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete promotion
   * @param {number} promotionId - Promotion ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(promotionId) {
    try {
      await pool.query('DELETE FROM promotions WHERE promotion_id = ?', [promotionId]);
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get promotions applicable to a product
   * @param {number} productId - Product ID
   * @param {string} category - Product category
   * @returns {Promise<Array>} Applicable promotions
   */
  static async getPromotionsForProduct(productId, category) {
    try {
      const query = `
        SELECT DISTINCT p.*
        FROM promotions p
        LEFT JOIN promotion_products pp ON p.promotion_id = pp.promotion_id
        LEFT JOIN promotion_categories pc ON p.promotion_id = pc.promotion_id
        WHERE p.is_active = TRUE
        AND (
          p.applies_to = 'all'
          OR (p.applies_to = 'products' AND pp.product_id = ?)
          OR (p.applies_to = 'categories' AND pc.category = ?)
        )
        ORDER BY p.priority DESC, p.created_at DESC
      `;

      const [promotions] = await pool.query(query, [productId, category]);

      // Filter by date/time
      return promotions.filter(promo => this.isPromotionActive(promo));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate promotion discount for a product/amount
   * @param {Object} promotion - Promotion object
   * @param {number} amount - Amount to discount
   * @param {number} quantity - Item quantity (for BOGO)
   * @returns {number} Discount amount
   */
  static calculatePromotionDiscount(promotion, amount, quantity = 1) {
    let discount = 0;

    if (promotion.discount_type === 'percentage') {
      discount = amount * (promotion.discount_value / 100);
    } else if (promotion.discount_type === 'fixed') {
      discount = Math.min(promotion.discount_value, amount);
    }
    // BOGO and bundle logic will be added in Story 10.4

    // Apply max discount cap if set
    if (promotion.max_discount_amount && discount > promotion.max_discount_amount) {
      discount = promotion.max_discount_amount;
    }

    return Math.round(discount * 100) / 100;
  }
}

module.exports = Promotion;
