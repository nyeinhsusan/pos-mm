const { pool } = require('../config/database');

class Payment {
  /**
   * Create payments for a sale (supports multiple payments for split payment)
   * @param {number} saleId - The sale ID
   * @param {Array} payments - Array of payment objects [{payment_method, amount, transaction_id, notes}]
   * @param {Object} connection - Optional database connection (for transactions)
   * @returns {Promise<Array>} Created payment records
   */
  static async create(saleId, payments, connection = null) {
    const conn = connection || await pool.getConnection();
    const shouldReleaseConnection = !connection;

    try {
      // Validate payments array
      if (!payments || !Array.isArray(payments) || payments.length === 0) {
        throw new Error('At least one payment method is required');
      }

      const validPaymentMethods = ['cash', 'card', 'kbzpay', 'wavepay', 'ayapay'];
      const createdPayments = [];

      for (const payment of payments) {
        // Validate payment method
        if (!validPaymentMethods.includes(payment.payment_method)) {
          throw new Error(`Invalid payment method: ${payment.payment_method}`);
        }

        // Validate amount
        if (!payment.amount || payment.amount <= 0) {
          throw new Error('Payment amount must be greater than 0');
        }

        // Insert payment record
        const [result] = await conn.query(
          `INSERT INTO payments (sale_id, payment_method, amount, transaction_id, status, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            saleId,
            payment.payment_method,
            payment.amount,
            payment.transaction_id || null,
            payment.status || 'completed',
            payment.notes || null
          ]
        );

        createdPayments.push({
          payment_id: result.insertId,
          sale_id: saleId,
          payment_method: payment.payment_method,
          amount: parseFloat(payment.amount).toFixed(2),
          transaction_id: payment.transaction_id || null,
          status: payment.status || 'completed',
          created_at: new Date()
        });
      }

      return createdPayments;
    } finally {
      if (shouldReleaseConnection && conn) {
        conn.release();
      }
    }
  }

  /**
   * Get all payments for a sale
   * @param {number} saleId - The sale ID
   * @returns {Promise<Array>} Array of payment records
   */
  static async findBySaleId(saleId) {
    try {
      const [payments] = await pool.query(
        `SELECT
          payment_id,
          sale_id,
          payment_method,
          amount,
          transaction_id,
          status,
          notes,
          created_at
        FROM payments
        WHERE sale_id = ?
        ORDER BY created_at ASC`,
        [saleId]
      );

      return payments;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate that total payments equal the sale amount
   * @param {Array} payments - Array of payment objects
   * @param {number} saleTotal - The total sale amount
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  static validatePaymentTotal(payments, saleTotal) {
    const totalPaid = payments.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount);
    }, 0);

    const saleTotalFloat = parseFloat(saleTotal);

    // Allow for small floating point differences (within 0.01)
    if (Math.abs(totalPaid - saleTotalFloat) > 0.01) {
      throw new Error(
        `Payment total (${totalPaid.toFixed(2)}) does not match sale total (${saleTotalFloat.toFixed(2)})`
      );
    }

    return true;
  }

  /**
   * Get payment statistics by payment method
   * @param {Object} filters - {start_date, end_date}
   * @returns {Promise<Array>} Payment method breakdown
   */
  static async getPaymentStats(filters = {}) {
    try {
      const { start_date, end_date } = filters;

      let query = `
        SELECT
          p.payment_method,
          COUNT(*) as transaction_count,
          SUM(p.amount) as total_amount
        FROM payments p
        JOIN sales s ON p.sale_id = s.sale_id
        WHERE p.status = 'completed'
      `;
      const params = [];

      if (start_date) {
        query += ' AND s.sale_date >= ?';
        params.push(start_date);
      }

      if (end_date) {
        query += ' AND s.sale_date <= ?';
        params.push(end_date);
      }

      query += ' GROUP BY p.payment_method ORDER BY total_amount DESC';

      const [stats] = await pool.query(query, params);

      return stats;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Payment;
