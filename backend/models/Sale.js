const { pool } = require('../config/database');
const Product = require('./Product');
const Payment = require('./Payment');
const StoreConfig = require('./StoreConfig');

class Sale {
  /**
   * Generate unique receipt number
   * Format: RCP-YYYYMMDD-XXXX
   * @returns {Promise<string>} Receipt number
   */
  static async generateReceiptNumber() {
    try {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;

      // Get count of receipts today
      const [rows] = await pool.query(
        `SELECT COUNT(*) as count FROM sales
         WHERE DATE(sale_date) = CURDATE()`
      );

      const dailyCount = rows[0].count + 1;
      const sequenceNumber = String(dailyCount).padStart(4, '0');

      return `RCP-${dateStr}-${sequenceNumber}`;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new sale with transaction support
   * @param {Object} saleData - {user_id, items: [{product_id, quantity}], notes, payments: [{payment_method, amount, transaction_id}], discounts: {cart: {...}, items: {...}}}
   * @returns {Promise<Object>} Sale details with updated stock levels and payment information
   */
  static async create(saleData) {
    const connection = await pool.getConnection();

    try {
      // Start transaction
      await connection.beginTransaction();

      const { user_id, items, notes, payments, discounts } = saleData;

      // Validate items array
      if (!items || items.length === 0) {
        throw new Error('Sale must contain at least one item');
      }

      // Step 1: Validate all products exist and have sufficient stock
      // First, get products with promotions applied
      const productsWithPromotions = await Product.findAllWithPromotions();

      // Lock product rows for update to prevent race conditions
      const productIds = items.map((item) => item.product_id);
      const placeholders = productIds.map(() => '?').join(',');

      const [productsForStock] = await connection.query(
        `SELECT product_id, name, price, cost_price, stock_quantity
         FROM products
         WHERE product_id IN (${placeholders})
         FOR UPDATE`, // Lock rows for update
        productIds
      );

      // Create a map for quick lookup - use promotional prices
      const productMap = {};
      productsWithPromotions.forEach((product) => {
        if (productIds.includes(product.product_id)) {
          // Use promotional price if available, otherwise use regular price
          const effectivePrice = product.has_promotion ? product.promotional_price : product.price;
          productMap[product.product_id] = {
            ...product,
            price: effectivePrice, // Override with promotional price
            has_promotion: product.has_promotion,
            promotion: product.promotion
          };
        }
      });

      // Add stock info from locked query
      productsForStock.forEach((product) => {
        if (productMap[product.product_id]) {
          productMap[product.product_id].stock_quantity = product.stock_quantity;
          productMap[product.product_id].cost_price = product.cost_price;
        }
      });

      // Validate each item and calculate totals
      let total_amount = 0; // This will be the promotional price total
      let total_cost = 0;
      let promotion_discount_total = 0; // Track promotion discounts separately
      let original_total = 0; // Total before any promotions
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

        // Calculate subtotals
        const subtotal = product.price * item.quantity; // Promotional price
        const item_cost = product.cost_price * item.quantity;

        // Track promotion discounts
        if (product.has_promotion && product.promotion) {
          const itemOriginalPrice = product.original_price || product.price;
          const originalSubtotal = itemOriginalPrice * item.quantity;
          original_total += originalSubtotal;
          promotion_discount_total += product.promotion.discount_amount * item.quantity;
        } else {
          original_total += subtotal;
        }

        total_amount += parseFloat(subtotal);
        total_cost += parseFloat(item_cost);

        validatedItems.push({
          product_id: item.product_id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: product.price,
          unit_cost: product.cost_price,
          subtotal: subtotal,
          has_promotion: product.has_promotion,
          promotion: product.promotion,
          original_price: product.original_price || product.price
        });
      }

      // Step 2: Calculate additional discounts (beyond promotions)
      let manual_discount = 0;
      const subtotal_before_discount = original_total; // Use original total before promotions

      // Calculate cart-level manual discount (applied on top of promotions)
      if (discounts && discounts.cart) {
        const cartDiscount = discounts.cart;
        if (cartDiscount.type === 'percentage') {
          manual_discount += total_amount * (cartDiscount.value / 100);
        } else if (cartDiscount.type === 'fixed') {
          manual_discount += Math.min(cartDiscount.value, total_amount);
        }
      }

      // Calculate total discount (promotions + manual)
      const total_discount = promotion_discount_total + manual_discount;

      // Apply manual discount to get final total
      total_amount = Math.max(0, total_amount - manual_discount);

      // Step 3: Generate receipt number and insert sale record
      const receipt_number = await this.generateReceiptNumber();

      const [saleResult] = await connection.query(
        'INSERT INTO sales (user_id, total_amount, total_cost, notes, receipt_number, total_discount, subtotal_before_discount) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user_id, total_amount, total_cost, notes || null, receipt_number, total_discount, subtotal_before_discount]
      );

      const sale_id = saleResult.insertId;

      // Step 4: Insert sale items, apply item discounts, and update stock
      const saleItemIds = {};
      for (const item of validatedItems) {
        // Insert sale item
        const [itemResult] = await connection.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost)
           VALUES (?, ?, ?, ?, ?)`,
          [sale_id, item.product_id, item.quantity, item.unit_price, item.unit_cost]
        );

        saleItemIds[item.product_id] = itemResult.insertId;

        // Record promotion discount if product has active promotion
        if (item.has_promotion && item.promotion) {
          const promotionDiscountAmount = item.promotion.discount_amount * item.quantity;
          const originalSubtotal = item.original_price * item.quantity;

          // Update sale_items with promotion discount
          await connection.query(
            `UPDATE sale_items
             SET discount_amount = ?,
                 price_before_discount = ?
             WHERE sale_item_id = ?`,
            [promotionDiscountAmount, originalSubtotal, itemResult.insertId]
          );

          // Create promotion discount record
          await connection.query(
            `INSERT INTO sale_discounts
             (sale_id, sale_item_id, discount_type, discount_value, discount_amount, reason, promotion_id, applied_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sale_id,
              itemResult.insertId,
              'promotion',
              item.promotion.discount_value,
              promotionDiscountAmount,
              `Promotion: ${item.promotion.name}`,
              item.promotion.promotion_id,
              user_id
            ]
          );
        }

        // Apply item-level discount if exists (manual discounts)
        if (discounts && discounts.items && discounts.items[item.product_id]) {
          const itemDiscount = discounts.items[item.product_id];
          let discountAmount = 0;

          if (itemDiscount.type === 'percentage') {
            discountAmount = item.subtotal * (itemDiscount.value / 100);
          } else if (itemDiscount.type === 'fixed') {
            discountAmount = Math.min(itemDiscount.value, item.subtotal);
          }

          // Update sale_items with discount
          await connection.query(
            `UPDATE sale_items
             SET discount_amount = ?,
                 price_before_discount = ?
             WHERE sale_item_id = ?`,
            [discountAmount, item.subtotal, itemResult.insertId]
          );

          // Create discount record
          await connection.query(
            `INSERT INTO sale_discounts
             (sale_id, sale_item_id, discount_type, discount_value, discount_amount, reason, applied_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sale_id, itemResult.insertId, itemDiscount.type, itemDiscount.value, discountAmount, itemDiscount.reason || 'Item discount', user_id]
          );

          // Add to manual discount total
          manual_discount += discountAmount;
        }

        // Decrement stock quantity
        await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
      }

      // Step 5: Create cart-level discount record (if exists)
      if (discounts && discounts.cart && discounts.cart.amount > 0) {
        await connection.query(
          `INSERT INTO sale_discounts
           (sale_id, sale_item_id, discount_type, discount_value, discount_amount, reason, applied_by)
           VALUES (?, NULL, ?, ?, ?, ?, ?)`,
          [sale_id, discounts.cart.type, discounts.cart.value, discounts.cart.amount, discounts.cart.reason || 'Cart discount', user_id]
        );
      }

      // Recalculate final totals with all discounts (promotions + manual)
      const final_total_discount = promotion_discount_total + manual_discount;
      const final_total_amount = Math.max(0, subtotal_before_discount - final_total_discount);

      // Update sale record with final totals
      await connection.query(
        `UPDATE sales
         SET total_discount = ?,
             total_amount = ?
         WHERE sale_id = ?`,
        [final_total_discount, final_total_amount, sale_id]
      );

      // Step 6: Handle payments (if provided)
      let paymentRecords = [];
      if (payments && payments.length > 0) {
        // Validate payment total matches sale total (after all discounts applied)
        Payment.validatePaymentTotal(payments, total_amount);

        // Create payment records
        paymentRecords = await Payment.create(sale_id, payments, connection);
      }

      // Commit transaction
      await connection.commit();

      // Step 7: Fetch updated product stock levels
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
        receipt_number,
        user_id,
        total_amount: parseFloat(total_amount).toFixed(2),
        total_cost: parseFloat(total_cost).toFixed(2),
        profit: (total_amount - total_cost).toFixed(2),
        total_discount: parseFloat(total_discount).toFixed(2),
        subtotal_before_discount: parseFloat(subtotal_before_discount).toFixed(2),
        items: validatedItems.map((item) => ({
          ...item,
          updated_stock: updatedStockMap[item.product_id]
        })),
        payments: paymentRecords,
        discounts_applied: discounts || null,
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

  /**
   * Get receipt data for a sale
   * @param {number} saleId
   * @returns {Promise<Object|null>} Receipt data with store config
   */
  static async getReceiptData(saleId) {
    try {
      // Get sale with items and payments
      const sale = await this.findById(saleId);

      if (!sale) {
        return null;
      }

      // Get store configuration
      const storeConfig = await StoreConfig.get();

      // Get receipt number
      const [receiptRows] = await pool.query(
        'SELECT receipt_number, receipt_printed_count FROM sales WHERE sale_id = ?',
        [saleId]
      );

      const receipt_number = receiptRows[0]?.receipt_number || `RCP-${saleId}`;
      const receipt_printed_count = receiptRows[0]?.receipt_printed_count || 0;

      // Get discounts for the sale
      const [discountRows] = await pool.query(
        `SELECT
          discount_id,
          sale_item_id,
          discount_type,
          discount_value,
          discount_amount,
          reason
         FROM sale_discounts
         WHERE sale_id = ?
         ORDER BY created_at`,
        [saleId]
      );

      // Calculate total discount and subtotal before discount
      const total_discount = sale.total_discount || 0;
      const subtotal_before_discount = sale.subtotal_before_discount || sale.total_amount;

      // Calculate cash tendered and change (for cash payments)
      let cash_tendered = null;
      let change = null;

      const cashPayment = sale.payments?.find(p => p.payment_method === 'cash');
      if (cashPayment) {
        // For simplicity, if exact amount, tendered = amount
        // In real scenario, this should be stored separately
        cash_tendered = parseFloat(cashPayment.amount);
        change = 0;
      }

      // Build receipt data
      return {
        receipt_number,
        receipt_printed_count,
        sale_id: sale.sale_id,
        sale_date: sale.sale_date,
        store: {
          name: storeConfig?.store_name || 'POS Store',
          address: storeConfig?.address || '',
          phone: storeConfig?.phone || '',
          email: storeConfig?.email || '',
          receipt_header: storeConfig?.receipt_header || '',
          receipt_footer: storeConfig?.receipt_footer || 'Thank you for your purchase!',
          logo_url: storeConfig?.logo_url || '',
          currency: storeConfig?.currency || 'MMK'
        },
        items: sale.items.map(item => ({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price),
          total: parseFloat(item.subtotal)
        })),
        discounts: discountRows.map(d => ({
          discount_id: d.discount_id,
          sale_item_id: d.sale_item_id,
          discount_type: d.discount_type,
          discount_value: parseFloat(d.discount_value),
          discount_amount: parseFloat(d.discount_amount),
          reason: d.reason
        })),
        total_discount: parseFloat(total_discount),
        subtotal_before_discount: parseFloat(subtotal_before_discount),
        subtotal: parseFloat(sale.total_amount),
        tax: 0, // Can be calculated from store config tax_rate if needed
        total: parseFloat(sale.total_amount),
        payments: sale.payments?.map(p => ({
          method: p.payment_method,
          amount: parseFloat(p.amount)
        })) || [],
        cash_tendered,
        change,
        cashier: sale.user_name || 'Unknown',
        notes: sale.notes || ''
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Increment receipt print count
   * @param {number} saleId
   * @returns {Promise<boolean>} Success status
   */
  static async incrementPrintCount(saleId) {
    try {
      await pool.query(
        `UPDATE sales
         SET receipt_printed_count = receipt_printed_count + 1,
             receipt_printed_at = CURRENT_TIMESTAMP
         WHERE sale_id = ?`,
        [saleId]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Sale;
