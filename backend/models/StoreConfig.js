const { pool } = require('../config/database');

class StoreConfig {
  /**
   * Get store configuration
   * @returns {Promise<Object|null>} Store config object or null
   */
  static async get() {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM store_config LIMIT 1'
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update store configuration
   * @param {Object} configData - Store config data
   * @returns {Promise<boolean>} Success status
   */
  static async update(configData) {
    try {
      const {
        store_name,
        address,
        phone,
        email,
        tax_rate,
        currency,
        receipt_header,
        receipt_footer,
        logo_url
      } = configData;

      // Get existing config to determine if we need to insert or update
      const existing = await this.get();

      if (existing) {
        // Update existing config
        await pool.query(
          `UPDATE store_config
           SET store_name = ?,
               address = ?,
               phone = ?,
               email = ?,
               tax_rate = ?,
               currency = ?,
               receipt_header = ?,
               receipt_footer = ?,
               logo_url = ?
           WHERE config_id = ?`,
          [
            store_name,
            address,
            phone,
            email,
            tax_rate,
            currency,
            receipt_header,
            receipt_footer,
            logo_url,
            existing.config_id
          ]
        );
      } else {
        // Insert new config
        await pool.query(
          `INSERT INTO store_config
           (store_name, address, phone, email, tax_rate, currency, receipt_header, receipt_footer, logo_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            store_name,
            address,
            phone,
            email,
            tax_rate,
            currency,
            receipt_header,
            receipt_footer,
            logo_url
          ]
        );
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Initialize default store configuration if none exists
   * @returns {Promise<boolean>} Success status
   */
  static async initializeDefault() {
    try {
      const existing = await this.get();

      if (!existing) {
        await pool.query(
          `INSERT INTO store_config
           (store_name, address, phone, email, tax_rate, currency, receipt_header, receipt_footer, logo_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'POS Myanmar Store',
            'University of Roehampton\nFinal Year Project Demo',
            '+95 9 123 456 789',
            'info@posmyanmar.com',
            0.00,
            'MMK',
            'Welcome to POS Myanmar!',
            'Thank you for your purchase!\nPlease come again!',
            '/assets/logo.png'
          ]
        );
      }

      return true;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = StoreConfig;
