const { pool } = require('../config/database');

class VendorProduct {
  /**
   * List all products linked to a vendor (joined with product name + image).
   */
  static async findByVendor(vendorId) {
    try {
      const [rows] = await pool.query(
        `SELECT
          vp.vendor_product_id,
          vp.vendor_id,
          vp.product_id,
          p.name AS product_name,
          p.image AS product_image,
          p.category AS product_category,
          p.stock_quantity AS product_stock,
          vp.vendor_cost_price,
          vp.default_reorder_qty,
          vp.min_order_qty,
          vp.is_preferred,
          vp.created_at,
          vp.updated_at
        FROM vendor_products vp
        JOIN products p ON vp.product_id = p.product_id
        WHERE vp.vendor_id = ?
        ORDER BY p.name ASC`,
        [vendorId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * List all vendors linked to a product (joined with vendor name + email).
   */
  static async findByProduct(productId) {
    try {
      const [rows] = await pool.query(
        `SELECT
          vp.vendor_product_id,
          vp.vendor_id,
          v.name AS vendor_name,
          v.email AS vendor_email,
          v.status AS vendor_status,
          v.lead_time_days,
          vp.product_id,
          vp.vendor_cost_price,
          vp.default_reorder_qty,
          vp.min_order_qty,
          vp.is_preferred,
          vp.created_at,
          vp.updated_at
        FROM vendor_products vp
        JOIN vendors v ON vp.vendor_id = v.vendor_id
        WHERE vp.product_id = ?
        ORDER BY vp.is_preferred DESC, v.name ASC`,
        [productId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a single link row by id.
   */
  static async findById(vendorProductId) {
    try {
      const [rows] = await pool.query(
        `SELECT
          vendor_product_id,
          vendor_id,
          product_id,
          vendor_cost_price,
          default_reorder_qty,
          min_order_qty,
          is_preferred
        FROM vendor_products
        WHERE vendor_product_id = ?`,
        [vendorProductId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a vendor↔product link.
   * Use a transaction when is_preferred=true so we clear any existing
   * preferred row for the same product first (DB has UNIQUE on preferred_lock).
   * Throws code 'DUPLICATE_LINK' on (vendor_id, product_id) collision.
   */
  static async link({
    vendor_id,
    product_id,
    vendor_cost_price,
    default_reorder_qty = 1,
    min_order_qty = 1,
    is_preferred = false
  }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (is_preferred) {
        await conn.query(
          'UPDATE vendor_products SET is_preferred = FALSE WHERE product_id = ? AND is_preferred = TRUE',
          [product_id]
        );
      }

      const [result] = await conn.query(
        `INSERT INTO vendor_products
          (vendor_id, product_id, vendor_cost_price, default_reorder_qty, min_order_qty, is_preferred)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [vendor_id, product_id, vendor_cost_price, default_reorder_qty, min_order_qty, !!is_preferred]
      );

      await conn.commit();
      return result.insertId;
    } catch (error) {
      await conn.rollback();
      if (error.code === 'ER_DUP_ENTRY') {
        // Could be (vendor_id, product_id) UNIQUE OR preferred_lock UNIQUE.
        // For link(), the only way the latter triggers without us hitting the
        // pre-clear UPDATE is a race; surface as duplicate-link by default.
        const dup = new Error('This product is already linked to this vendor');
        dup.code = 'DUPLICATE_LINK';
        throw dup;
      }
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Update mutable fields on a link row.
   * Excludes vendor_id, product_id (story AC #4).
   * If is_preferred is being set TRUE, runs in a transaction to clear the
   * existing preferred row for that product first.
   */
  static async update(vendorProductId, data) {
    const allowedFields = [
      'vendor_cost_price',
      'default_reorder_qty',
      'min_order_qty',
      'is_preferred'
    ];

    const fields = [];
    const values = [];
    allowedFields.forEach((f) => {
      if (Object.prototype.hasOwnProperty.call(data, f)) {
        fields.push(`${f} = ?`);
        values.push(data[f]);
      }
    });
    if (fields.length === 0) return 0;

    const settingPreferredTrue = data.is_preferred === true || data.is_preferred === 1 || data.is_preferred === 'true';
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (settingPreferredTrue) {
        // Need product_id of the row we're updating so we can clear siblings
        const [rows] = await conn.query(
          'SELECT product_id FROM vendor_products WHERE vendor_product_id = ?',
          [vendorProductId]
        );
        if (rows.length === 0) {
          await conn.rollback();
          return 0;
        }
        const product_id = rows[0].product_id;
        await conn.query(
          'UPDATE vendor_products SET is_preferred = FALSE WHERE product_id = ? AND vendor_product_id <> ?',
          [product_id, vendorProductId]
        );
      }

      values.push(vendorProductId);
      const [result] = await conn.query(
        `UPDATE vendor_products SET ${fields.join(', ')} WHERE vendor_product_id = ?`,
        values
      );
      await conn.commit();
      return result.affectedRows;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Delete a vendor↔product link.
   */
  static async unlink(vendorProductId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM vendor_products WHERE vendor_product_id = ?',
        [vendorProductId]
      );
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Atomically promote one link row to preferred and demote any sibling.
   * Required by Story 18 design: a single UPDATE...SET is_preferred=TRUE
   * would fail with ER_DUP_ENTRY when another row is already preferred for
   * the same product (DB UNIQUE on preferred_lock).
   */
  static async setPreferred(vendorProductId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        'SELECT product_id FROM vendor_products WHERE vendor_product_id = ?',
        [vendorProductId]
      );
      if (rows.length === 0) {
        await conn.rollback();
        return 0;
      }
      const product_id = rows[0].product_id;

      await conn.query(
        'UPDATE vendor_products SET is_preferred = FALSE WHERE product_id = ? AND is_preferred = TRUE',
        [product_id]
      );
      const [res] = await conn.query(
        'UPDATE vendor_products SET is_preferred = TRUE WHERE vendor_product_id = ?',
        [vendorProductId]
      );
      await conn.commit();
      return res.affectedRows;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Get the preferred vendor row for a product (joined with vendor info).
   * Returns null if no preferred vendor is set.
   */
  static async getPreferredVendorForProduct(productId) {
    try {
      const [rows] = await pool.query(
        `SELECT
          vp.vendor_product_id,
          vp.vendor_id,
          v.name AS vendor_name,
          v.email AS vendor_email,
          v.lead_time_days,
          v.status AS vendor_status,
          vp.product_id,
          vp.vendor_cost_price,
          vp.default_reorder_qty,
          vp.min_order_qty
        FROM vendor_products vp
        JOIN vendors v ON vp.vendor_id = v.vendor_id
        WHERE vp.product_id = ? AND vp.is_preferred = TRUE
        LIMIT 1`,
        [productId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = VendorProduct;
