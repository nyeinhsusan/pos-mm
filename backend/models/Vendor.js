const { pool } = require('../config/database');

class Vendor {
  /**
   * Find all vendors with optional filters
   * @param {Object} filters - {status, search}
   * @returns {Promise<Array>} Array of vendor rows
   */
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT
          vendor_id,
          name,
          contact_name,
          email,
          phone,
          address,
          payment_terms,
          lead_time_days,
          currency,
          logo_url,
          notes,
          status,
          created_at,
          updated_at
        FROM vendors
        WHERE 1=1
      `;
      const params = [];

      if (filters.status === 'active' || filters.status === 'archived') {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.search) {
        query += ' AND (name LIKE ? OR email LIKE ?)';
        const term = `%${filters.search}%`;
        params.push(term, term);
      }

      query += ' ORDER BY name ASC';

      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find vendor by ID
   * @param {number} vendorId
   * @returns {Promise<Object|null>}
   */
  static async findById(vendorId) {
    try {
      const [rows] = await pool.query(
        `SELECT
          vendor_id,
          name,
          contact_name,
          email,
          phone,
          address,
          payment_terms,
          lead_time_days,
          currency,
          logo_url,
          notes,
          status,
          created_at,
          updated_at
        FROM vendors
        WHERE vendor_id = ?`,
        [vendorId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create new vendor
   * @param {Object} data
   * @returns {Promise<number>} inserted vendor_id
   */
  static async create(data) {
    try {
      const {
        name,
        contact_name,
        email,
        phone,
        address,
        payment_terms,
        lead_time_days,
        currency,
        notes,
        logo_url
      } = data;

      const [result] = await pool.query(
        `INSERT INTO vendors
        (name, contact_name, email, phone, address, payment_terms, lead_time_days, currency, notes, logo_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          contact_name || null,
          email,
          phone || null,
          address || null,
          payment_terms || 'NET_15',
          lead_time_days != null ? lead_time_days : 7,
          currency || 'MMK',
          notes || null,
          logo_url || null
        ]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update vendor (whitelist fields)
   * @param {number} vendorId
   * @param {Object} data
   * @returns {Promise<number>} affected rows
   */
  static async update(vendorId, data) {
    try {
      const allowedFields = [
        'name',
        'contact_name',
        'email',
        'phone',
        'address',
        'payment_terms',
        'lead_time_days',
        'currency',
        'notes',
        'logo_url'
      ];

      const fields = [];
      const values = [];

      allowedFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(data, field)) {
          fields.push(`${field} = ?`);
          values.push(data[field]);
        }
      });

      if (fields.length === 0) {
        return 0;
      }

      values.push(vendorId);

      const [result] = await pool.query(
        `UPDATE vendors SET ${fields.join(', ')} WHERE vendor_id = ?`,
        values
      );

      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Soft-delete: set status='archived'
   */
  static async archive(vendorId) {
    try {
      const [result] = await pool.query(
        `UPDATE vendors SET status = 'archived' WHERE vendor_id = ?`,
        [vendorId]
      );
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Reverse archive: set status='active'
   */
  static async restore(vendorId) {
    try {
      const [result] = await pool.query(
        `UPDATE vendors SET status = 'active' WHERE vendor_id = ?`,
        [vendorId]
      );
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Hard-delete vendor. Refuses if vendor has open POs (Epic 7).
   * If purchase_orders table doesn't exist yet, the check is skipped with a warning.
   */
  static async hardDelete(vendorId) {
    try {
      // Forward-compat check: only enforce if purchase_orders exists
      const [tableRows] = await pool.query(
        `SELECT COUNT(*) AS c FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders'`
      );
      if (tableRows[0].c > 0) {
        const [poRows] = await pool.query(
          `SELECT COUNT(*) AS open_pos FROM purchase_orders
           WHERE vendor_id = ? AND status IN ('draft', 'sent', 'partially_received')`,
          [vendorId]
        );
        if (poRows[0].open_pos > 0) {
          const err = new Error(
            `Vendor has ${poRows[0].open_pos} open purchase order(s). Cancel or complete them first.`
          );
          err.code = 'HAS_OPEN_POS';
          throw err;
        }
      } else {
        console.warn('[Vendor.hardDelete] purchase_orders table not found yet; skipping open-POs check (Epic 7 will populate this).');
      }

      const [result] = await pool.query(
        'DELETE FROM vendors WHERE vendor_id = ?',
        [vendorId]
      );
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Vendor;
