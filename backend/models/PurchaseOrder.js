const { pool } = require('../config/database');
const { nextPoNumber } = require('../utils/poNumberGenerator');

class PurchaseOrderError extends Error {
  constructor(code, message, meta = {}) {
    super(message);
    this.code = code;
    this.meta = meta;
  }
}

const HEADER_COLUMNS = `
  po.po_id,
  po.po_number,
  po.vendor_id,
  po.status,
  po.source,
  po.subtotal,
  po.tax_amount,
  po.total,
  po.notes,
  po.pdf_url,
  po.created_by_user_id,
  po.created_at,
  po.sent_at,
  po.received_at,
  po.cancelled_at,
  po.cancellation_reason
`;

function mergeDuplicateLines(items) {
  const merged = new Map();
  for (const raw of items) {
    const productId = Number(raw.product_id);
    const qty = Number(raw.quantity_ordered);
    const unitCost = Number(raw.unit_cost);
    const tax = raw.tax_amount != null ? Number(raw.tax_amount) : 0;

    if (merged.has(productId)) {
      const existing = merged.get(productId);
      existing.quantity_ordered += qty;
      existing.tax_amount = Number(existing.tax_amount) + tax;
      // Keep first unit_cost as authoritative; if you wanted weighted average,
      // do it here. Owner can edit per-line cost manually.
    } else {
      merged.set(productId, {
        product_id: productId,
        quantity_ordered: qty,
        unit_cost: unitCost,
        tax_amount: tax
      });
    }
  }
  return Array.from(merged.values());
}

function validateItemsShape(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new PurchaseOrderError('EMPTY_PO', 'Purchase order must contain at least one item');
  }

  for (const item of items) {
    if (item.product_id == null || !Number.isFinite(Number(item.product_id))) {
      throw new PurchaseOrderError('INVALID_PRODUCT', 'Each item must include a numeric product_id');
    }
    const qty = Number(item.quantity_ordered);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new PurchaseOrderError('INVALID_QUANTITY', 'quantity_ordered must be an integer >= 1');
    }
    const unitCost = Number(item.unit_cost);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new PurchaseOrderError('INVALID_UNIT_COST', 'unit_cost must be a number >= 0');
    }
    if (item.tax_amount != null) {
      const tax = Number(item.tax_amount);
      if (!Number.isFinite(tax) || tax < 0) {
        throw new PurchaseOrderError('INVALID_TAX', 'tax_amount must be a number >= 0');
      }
    }
  }
}

function computeTotals(items) {
  let subtotal = 0;
  let taxTotal = 0;
  const enriched = items.map((item) => {
    const qty = Number(item.quantity_ordered);
    const unit = Number(item.unit_cost);
    const tax = Number(item.tax_amount || 0);
    const lineTotal = qty * unit + tax;
    subtotal += qty * unit;
    taxTotal += tax;
    return { ...item, line_total: lineTotal };
  });
  const total = subtotal + taxTotal;
  return { subtotal, tax_amount: taxTotal, total, lines: enriched };
}

class PurchaseOrder {
  /**
   * List POs joined with vendor name, with optional filters.
   * @param {Object} filters - { status, vendor_id, source, date_from, date_to, search }
   */
  static async findAll(filters = {}) {
    let query = `
      SELECT
        ${HEADER_COLUMNS},
        v.name AS vendor_name,
        v.email AS vendor_email,
        (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.po_id = po.po_id) AS item_count
      FROM purchase_orders po
      JOIN vendors v ON v.vendor_id = po.vendor_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ' AND po.status = ?';
      params.push(filters.status);
    }
    if (filters.vendor_id) {
      query += ' AND po.vendor_id = ?';
      params.push(filters.vendor_id);
    }
    if (filters.source) {
      query += ' AND po.source = ?';
      params.push(filters.source);
    }
    if (filters.date_from) {
      query += ' AND po.created_at >= ?';
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      query += ' AND po.created_at <= ?';
      params.push(filters.date_to);
    }
    if (filters.search) {
      query += ' AND (po.po_number LIKE ? OR v.name LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    query += ' ORDER BY po.created_at DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Find a single PO with vendor + line items.
   */
  static async findById(poId) {
    const [headerRows] = await pool.query(
      `SELECT
         ${HEADER_COLUMNS},
         v.name AS vendor_name,
         v.email AS vendor_email,
         v.contact_name AS vendor_contact_name,
         v.phone AS vendor_phone,
         v.lead_time_days AS vendor_lead_time_days,
         v.currency AS vendor_currency,
         v.status AS vendor_status
       FROM purchase_orders po
       JOIN vendors v ON v.vendor_id = po.vendor_id
       WHERE po.po_id = ?`,
      [poId]
    );

    if (headerRows.length === 0) {
      return null;
    }

    const header = headerRows[0];

    const [itemRows] = await pool.query(
      `SELECT
         poi.po_item_id,
         poi.po_id,
         poi.product_id,
         p.name AS product_name,
         p.stock_quantity AS product_current_stock,
         poi.quantity_ordered,
         poi.quantity_received,
         poi.unit_cost,
         poi.tax_amount,
         poi.line_total
       FROM purchase_order_items poi
       JOIN products p ON p.product_id = poi.product_id
       WHERE poi.po_id = ?
       ORDER BY poi.po_item_id ASC`,
      [poId]
    );

    return {
      po_id: header.po_id,
      po_number: header.po_number,
      vendor_id: header.vendor_id,
      status: header.status,
      source: header.source,
      subtotal: Number(header.subtotal),
      tax_amount: Number(header.tax_amount),
      total: Number(header.total),
      notes: header.notes,
      pdf_url: header.pdf_url,
      created_by_user_id: header.created_by_user_id,
      created_at: header.created_at,
      sent_at: header.sent_at,
      received_at: header.received_at,
      cancelled_at: header.cancelled_at,
      cancellation_reason: header.cancellation_reason,
      vendor: {
        vendor_id: header.vendor_id,
        name: header.vendor_name,
        email: header.vendor_email,
        contact_name: header.vendor_contact_name,
        phone: header.vendor_phone,
        lead_time_days: header.vendor_lead_time_days,
        currency: header.vendor_currency,
        status: header.vendor_status
      },
      items: itemRows.map((r) => ({
        po_item_id: r.po_item_id,
        product_id: r.product_id,
        product_name: r.product_name,
        product_current_stock: r.product_current_stock,
        quantity_ordered: r.quantity_ordered,
        quantity_received: r.quantity_received,
        unit_cost: Number(r.unit_cost),
        tax_amount: Number(r.tax_amount),
        line_total: Number(r.line_total)
      }))
    };
  }

  /**
   * Create a new draft PO with items in a single transaction.
   * @param {Object} data - { vendor_id, notes, source, items, created_by_user_id }
   */
  static async create(data) {
    const { vendor_id, notes, source, items, created_by_user_id } = data;

    if (!vendor_id || !Number.isFinite(Number(vendor_id))) {
      throw new PurchaseOrderError('INVALID_VENDOR', 'vendor_id is required');
    }
    if (!created_by_user_id) {
      throw new PurchaseOrderError('INVALID_USER', 'created_by_user_id is required');
    }

    validateItemsShape(items);
    const merged = mergeDuplicateLines(items);

    if (notes != null && typeof notes === 'string' && notes.length > 2000) {
      data.notes = notes.slice(0, 2000);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Vendor must exist and be active
      const [vendorRows] = await connection.query(
        'SELECT vendor_id, status FROM vendors WHERE vendor_id = ? FOR UPDATE',
        [vendor_id]
      );
      if (vendorRows.length === 0) {
        throw new PurchaseOrderError('INVALID_VENDOR', `Vendor ${vendor_id} not found`);
      }
      if (vendorRows[0].status !== 'active') {
        throw new PurchaseOrderError(
          'VENDOR_ARCHIVED',
          'Cannot create a purchase order for an archived vendor'
        );
      }

      // All product ids must exist
      const productIds = merged.map((i) => i.product_id);
      const placeholders = productIds.map(() => '?').join(',');
      const [productRows] = await connection.query(
        `SELECT product_id FROM products WHERE product_id IN (${placeholders})`,
        productIds
      );
      const foundIds = new Set(productRows.map((r) => r.product_id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new PurchaseOrderError(
          'INVALID_PRODUCT',
          `Product(s) not found: ${missing.join(', ')}`,
          { missing }
        );
      }

      // Compute totals
      const totals = computeTotals(merged);

      // Generate PO number under the same transaction (FOR UPDATE inside)
      const poNumber = await nextPoNumber(connection);

      // Insert header
      const [poResult] = await connection.query(
        `INSERT INTO purchase_orders
           (po_number, vendor_id, status, source, subtotal, tax_amount, total, notes, created_by_user_id)
         VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
        [
          poNumber,
          vendor_id,
          source === 'auto_ml' ? 'auto_ml' : 'manual',
          totals.subtotal,
          totals.tax_amount,
          totals.total,
          notes ? String(notes).slice(0, 2000) : null,
          created_by_user_id
        ]
      );
      const newPoId = poResult.insertId;

      // Insert items
      for (const line of totals.lines) {
        await connection.query(
          `INSERT INTO purchase_order_items
             (po_id, product_id, quantity_ordered, quantity_received, unit_cost, tax_amount, line_total)
           VALUES (?, ?, ?, 0, ?, ?, ?)`,
          [newPoId, line.product_id, line.quantity_ordered, line.unit_cost, line.tax_amount, line.line_total]
        );
      }

      await connection.commit();
      return await PurchaseOrder.findById(newPoId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Update a draft PO's notes and/or items.
   * Items, if provided, fully replace the existing line items (DELETE + INSERT).
   */
  static async update(poId, data) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [headerRows] = await connection.query(
        'SELECT po_id, status, vendor_id FROM purchase_orders WHERE po_id = ? FOR UPDATE',
        [poId]
      );
      if (headerRows.length === 0) {
        throw new PurchaseOrderError('NOT_FOUND', `Purchase order ${poId} not found`);
      }
      if (headerRows[0].status !== 'draft') {
        throw new PurchaseOrderError(
          'PO_NOT_EDITABLE',
          `Purchase order is in status '${headerRows[0].status}' and cannot be edited`
        );
      }

      // vendor_id changes are not allowed
      if (data.vendor_id != null && Number(data.vendor_id) !== headerRows[0].vendor_id) {
        throw new PurchaseOrderError(
          'VENDOR_NOT_CHANGEABLE',
          'Vendor cannot be changed on an existing PO. Cancel and create a new one instead.'
        );
      }

      const updates = [];
      const params = [];

      if (data.notes !== undefined) {
        const trimmed = data.notes == null ? null : String(data.notes).slice(0, 2000);
        updates.push('notes = ?');
        params.push(trimmed);
      }

      // Items replace logic
      if (data.items !== undefined) {
        validateItemsShape(data.items);
        const merged = mergeDuplicateLines(data.items);

        // All products must exist
        const productIds = merged.map((i) => i.product_id);
        const placeholders = productIds.map(() => '?').join(',');
        const [productRows] = await connection.query(
          `SELECT product_id FROM products WHERE product_id IN (${placeholders})`,
          productIds
        );
        const foundIds = new Set(productRows.map((r) => r.product_id));
        const missing = productIds.filter((id) => !foundIds.has(id));
        if (missing.length > 0) {
          throw new PurchaseOrderError(
            'INVALID_PRODUCT',
            `Product(s) not found: ${missing.join(', ')}`,
            { missing }
          );
        }

        const totals = computeTotals(merged);

        // Wipe and re-insert items (PO is draft; no received quantities to preserve)
        await connection.query('DELETE FROM purchase_order_items WHERE po_id = ?', [poId]);
        for (const line of totals.lines) {
          await connection.query(
            `INSERT INTO purchase_order_items
               (po_id, product_id, quantity_ordered, quantity_received, unit_cost, tax_amount, line_total)
             VALUES (?, ?, ?, 0, ?, ?, ?)`,
            [poId, line.product_id, line.quantity_ordered, line.unit_cost, line.tax_amount, line.line_total]
          );
        }

        updates.push('subtotal = ?', 'tax_amount = ?', 'total = ?');
        params.push(totals.subtotal, totals.tax_amount, totals.total);
      }

      if (updates.length > 0) {
        params.push(poId);
        await connection.query(
          `UPDATE purchase_orders SET ${updates.join(', ')} WHERE po_id = ?`,
          params
        );
      }

      await connection.commit();
      return await PurchaseOrder.findById(poId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Cancel a PO (allowed from draft or sent).
   */
  static async cancel(poId, { reason } = {}) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [headerRows] = await connection.query(
        'SELECT po_id, status FROM purchase_orders WHERE po_id = ? FOR UPDATE',
        [poId]
      );
      if (headerRows.length === 0) {
        throw new PurchaseOrderError('NOT_FOUND', `Purchase order ${poId} not found`);
      }

      const status = headerRows[0].status;
      if (!['draft', 'sent'].includes(status)) {
        throw new PurchaseOrderError(
          'PO_NOT_CANCELLABLE',
          `Purchase order is in status '${status}' and cannot be cancelled`
        );
      }

      const trimmedReason = reason ? String(reason).slice(0, 500) : 'No reason provided';

      await connection.query(
        `UPDATE purchase_orders
           SET status = 'cancelled',
               cancelled_at = NOW(),
               cancellation_reason = ?
         WHERE po_id = ?`,
        [trimmedReason, poId]
      );

      await connection.commit();
      return await PurchaseOrder.findById(poId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Mark a PO as sent (transition from draft to sent).
   */
  static async markAsSent(poId, pdfUrl) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [headerRows] = await connection.query(
        'SELECT po_id, status FROM purchase_orders WHERE po_id = ? FOR UPDATE',
        [poId]
      );
      if (headerRows.length === 0) {
        throw new PurchaseOrderError('NOT_FOUND', `Purchase order ${poId} not found`);
      }

      if (headerRows[0].status !== 'draft') {
        throw new PurchaseOrderError(
          'PO_NOT_SENDABLE',
          `Purchase order is in status '${headerRows[0].status}' and cannot be sent`
        );
      }

      await connection.query(
        `UPDATE purchase_orders
           SET status = 'sent',
               sent_at = NOW(),
               pdf_url = ?
         WHERE po_id = ?`,
        [pdfUrl, poId]
      );

      await connection.commit();
      return true;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

PurchaseOrder.PurchaseOrderError = PurchaseOrderError;

module.exports = PurchaseOrder;
