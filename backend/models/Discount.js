const { pool } = require('../config/database');

class Discount {
  /**
   * Calculate discount amount based on type and value
   * @param {number} amount - Original amount to discount
   * @param {string} type - 'percentage' or 'fixed'
   * @param {number} value - Discount value (percentage or fixed amount)
   * @returns {number} Calculated discount amount
   */
  static calculateDiscount(amount, type, value) {
    let discountAmount = 0;

    if (type === 'percentage') {
      discountAmount = amount * (value / 100);
    } else if (type === 'fixed') {
      // Can't discount more than the total
      discountAmount = Math.min(value, amount);
    }

    // Round to 2 decimal places
    return Math.round(discountAmount * 100) / 100;
  }

  /**
   * Get discount settings
   * @returns {Promise<Object>} Discount settings
   */
  static async getSettings() {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM discount_settings ORDER BY setting_id DESC LIMIT 1'
      );

      if (rows.length === 0) {
        // Return default settings if none exist
        return {
          max_discount_percentage: 50.00,
          max_discount_amount: null,
          require_approval_threshold: 20.00,
          allow_cart_discount: true,
          allow_item_discount: true,
          min_sale_amount_for_discount: 0
        };
      }

      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate discount against settings
   * @param {number} discountAmount - Calculated discount amount
   * @param {number} originalAmount - Original amount before discount
   * @param {string} type - 'percentage' or 'fixed'
   * @param {number} value - Discount value
   * @param {Object} settings - Discount settings
   * @returns {Object} {valid: boolean, error: string, requiresApproval: boolean}
   */
  static async validateDiscount(discountAmount, originalAmount, type, value, settings) {
    // Calculate discount percentage
    const discountPercentage = (discountAmount / originalAmount) * 100;

    // Check max discount percentage
    if (discountPercentage > settings.max_discount_percentage) {
      return {
        valid: false,
        error: `Discount exceeds maximum allowed (${settings.max_discount_percentage}%)`,
        requiresApproval: false
      };
    }

    // Check max discount amount if set
    if (settings.max_discount_amount && discountAmount > settings.max_discount_amount) {
      return {
        valid: false,
        error: `Discount amount exceeds maximum allowed (${settings.max_discount_amount} MMK)`,
        requiresApproval: false
      };
    }

    // Check if requires approval
    const requiresApproval = discountPercentage > settings.require_approval_threshold;

    return {
      valid: true,
      error: null,
      requiresApproval
    };
  }

  /**
   * Apply discount to a sale (cart-level)
   * @param {number} saleId - Sale ID
   * @param {Object} discountData - {type, value, reason, applied_by}
   * @returns {Promise<Object>} Applied discount details
   */
  static async applyToSale(saleId, discountData) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { type, value, reason, applied_by } = discountData;

      // Get sale total
      const [saleRows] = await connection.query(
        'SELECT total_amount, total_discount FROM sales WHERE sale_id = ?',
        [saleId]
      );

      if (saleRows.length === 0) {
        throw new Error('Sale not found');
      }

      const sale = saleRows[0];
      const currentTotal = sale.total_amount;
      const existingDiscount = sale.total_discount || 0;

      // Calculate discount on current total (before any discount)
      const amountToDiscount = currentTotal + existingDiscount;
      const discountAmount = this.calculateDiscount(amountToDiscount, type, value);

      // Get settings and validate
      const settings = await this.getSettings();
      const validation = await this.validateDiscount(
        discountAmount,
        amountToDiscount,
        type,
        value,
        settings
      );

      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Insert discount record
      const [result] = await connection.query(
        `INSERT INTO sale_discounts
        (sale_id, sale_item_id, discount_type, discount_value, discount_amount, reason, applied_by)
        VALUES (?, NULL, ?, ?, ?, ?, ?)`,
        [saleId, type, value, discountAmount, reason, applied_by]
      );

      const discountId = result.insertId;

      // Update sale totals
      const newTotalDiscount = existingDiscount + discountAmount;
      const newTotal = currentTotal - discountAmount;

      await connection.query(
        `UPDATE sales
         SET total_discount = ?,
             total_amount = ?,
             subtotal_before_discount = ?
         WHERE sale_id = ?`,
        [newTotalDiscount, newTotal, currentTotal + existingDiscount, saleId]
      );

      await connection.commit();

      return {
        discount_id: discountId,
        sale_id: saleId,
        discount_type: type,
        discount_value: value,
        discount_amount: discountAmount,
        reason,
        new_total: newTotal,
        total_discount: newTotalDiscount,
        requires_approval: validation.requiresApproval
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Apply discount to a sale item (item-level)
   * @param {number} saleId - Sale ID
   * @param {number} saleItemId - Sale item ID
   * @param {Object} discountData - {type, value, reason, applied_by}
   * @returns {Promise<Object>} Applied discount details
   */
  static async applyToItem(saleId, saleItemId, discountData) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { type, value, reason, applied_by } = discountData;

      // Get sale item details
      const [itemRows] = await connection.query(
        'SELECT subtotal, discount_amount FROM sale_items WHERE sale_item_id = ? AND sale_id = ?',
        [saleItemId, saleId]
      );

      if (itemRows.length === 0) {
        throw new Error('Sale item not found');
      }

      const item = itemRows[0];
      const itemSubtotal = item.subtotal;
      const existingItemDiscount = item.discount_amount || 0;

      // Calculate discount
      const amountToDiscount = itemSubtotal + existingItemDiscount;
      const discountAmount = this.calculateDiscount(amountToDiscount, type, value);

      // Get settings and validate
      const settings = await this.getSettings();
      const validation = await this.validateDiscount(
        discountAmount,
        amountToDiscount,
        type,
        value,
        settings
      );

      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Insert discount record
      const [result] = await connection.query(
        `INSERT INTO sale_discounts
        (sale_id, sale_item_id, discount_type, discount_value, discount_amount, reason, applied_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [saleId, saleItemId, type, value, discountAmount, reason, applied_by]
      );

      const discountId = result.insertId;

      // Update sale item
      const newItemDiscount = existingItemDiscount + discountAmount;
      await connection.query(
        `UPDATE sale_items
         SET discount_amount = ?,
             price_before_discount = subtotal + ?
         WHERE sale_item_id = ?`,
        [newItemDiscount, existingItemDiscount, saleItemId]
      );

      // Recalculate sale total
      await this.recalculateSaleTotal(connection, saleId);

      await connection.commit();

      return {
        discount_id: discountId,
        sale_id: saleId,
        sale_item_id: saleItemId,
        discount_type: type,
        discount_value: value,
        discount_amount: discountAmount,
        reason,
        requires_approval: validation.requiresApproval
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Remove a discount
   * @param {number} discountId - Discount ID to remove
   * @param {number} saleId - Sale ID (for verification)
   * @returns {Promise<Object>} Removal result
   */
  static async remove(discountId, saleId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get discount details
      const [discountRows] = await connection.query(
        'SELECT * FROM sale_discounts WHERE discount_id = ? AND sale_id = ?',
        [discountId, saleId]
      );

      if (discountRows.length === 0) {
        throw new Error('Discount not found');
      }

      const discount = discountRows[0];

      // Delete discount record
      await connection.query('DELETE FROM sale_discounts WHERE discount_id = ?', [discountId]);

      // If cart-level discount
      if (!discount.sale_item_id) {
        // Update sale totals
        const [saleRows] = await connection.query(
          'SELECT total_amount, total_discount FROM sales WHERE sale_id = ?',
          [saleId]
        );

        const sale = saleRows[0];
        const newTotalDiscount = sale.total_discount - discount.discount_amount;
        const newTotal = sale.total_amount + discount.discount_amount;

        await connection.query(
          `UPDATE sales
           SET total_discount = ?,
               total_amount = ?
           WHERE sale_id = ?`,
          [newTotalDiscount, newTotal, saleId]
        );
      } else {
        // Item-level discount - update item
        const [itemRows] = await connection.query(
          'SELECT discount_amount FROM sale_items WHERE sale_item_id = ?',
          [discount.sale_item_id]
        );

        const item = itemRows[0];
        const newItemDiscount = item.discount_amount - discount.discount_amount;

        await connection.query(
          'UPDATE sale_items SET discount_amount = ? WHERE sale_item_id = ?',
          [newItemDiscount, discount.sale_item_id]
        );

        // Recalculate sale total
        await this.recalculateSaleTotal(connection, saleId);
      }

      await connection.commit();

      return {
        success: true,
        message: 'Discount removed successfully',
        discount_id: discountId
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Recalculate sale total based on items
   * @param {Connection} connection - Database connection
   * @param {number} saleId - Sale ID
   */
  static async recalculateSaleTotal(connection, saleId) {
    // Sum all item subtotals and discounts
    const [rows] = await connection.query(
      `SELECT
        SUM(subtotal) as items_total,
        SUM(discount_amount) as items_discount
       FROM sale_items
       WHERE sale_id = ?`,
      [saleId]
    );

    const itemsTotal = rows[0].items_total || 0;
    const itemsDiscount = rows[0].items_discount || 0;

    // Get cart-level discounts
    const [cartDiscounts] = await connection.query(
      `SELECT SUM(discount_amount) as cart_discount
       FROM sale_discounts
       WHERE sale_id = ? AND sale_item_id IS NULL`,
      [saleId]
    );

    const cartDiscount = cartDiscounts[0].cart_discount || 0;
    const totalDiscount = itemsDiscount + cartDiscount;
    const totalAmount = itemsTotal - totalDiscount;

    await connection.query(
      `UPDATE sales
       SET total_amount = ?,
           total_discount = ?,
           subtotal_before_discount = ?
       WHERE sale_id = ?`,
      [totalAmount, totalDiscount, itemsTotal, saleId]
    );
  }

  /**
   * Get all discounts for a sale
   * @param {number} saleId - Sale ID
   * @returns {Promise<Array>} List of discounts
   */
  static async getBySaleId(saleId) {
    try {
      const [rows] = await pool.query(
        `SELECT
          sd.*,
          u.username as applied_by_name
         FROM sale_discounts sd
         LEFT JOIN users u ON sd.applied_by = u.user_id
         WHERE sd.sale_id = ?
         ORDER BY sd.created_at DESC`,
        [saleId]
      );

      return rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update discount settings
   * @param {Object} settings - Updated settings
   * @param {number} userId - User making the update
   * @returns {Promise<Object>} Updated settings
   */
  static async updateSettings(settings, userId) {
    try {
      const {
        max_discount_percentage,
        max_discount_amount,
        require_approval_threshold,
        allow_cart_discount,
        allow_item_discount,
        min_sale_amount_for_discount
      } = settings;

      const [result] = await pool.query(
        `UPDATE discount_settings
         SET max_discount_percentage = ?,
             max_discount_amount = ?,
             require_approval_threshold = ?,
             allow_cart_discount = ?,
             allow_item_discount = ?,
             min_sale_amount_for_discount = ?,
             updated_by = ?
         WHERE setting_id = 1`,
        [
          max_discount_percentage,
          max_discount_amount,
          require_approval_threshold,
          allow_cart_discount,
          allow_item_discount,
          min_sale_amount_for_discount,
          userId
        ]
      );

      if (result.affectedRows === 0) {
        // Insert if not exists
        await pool.query(
          `INSERT INTO discount_settings
           (max_discount_percentage, max_discount_amount, require_approval_threshold,
            allow_cart_discount, allow_item_discount, min_sale_amount_for_discount, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            max_discount_percentage,
            max_discount_amount,
            require_approval_threshold,
            allow_cart_discount,
            allow_item_discount,
            min_sale_amount_for_discount,
            userId
          ]
        );
      }

      return await this.getSettings();
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Discount;
