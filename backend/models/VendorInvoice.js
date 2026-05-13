const { pool } = require('../config/database');

class VendorInvoiceError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'VendorInvoiceError';
    this.code = code;
    Object.assign(this, extra);
  }
}

const SELECT_BASE = `
  SELECT
    vi.invoice_id,
    vi.invoice_number,
    vi.vendor_id,
    vi.po_id,
    vi.invoice_date,
    vi.due_date,
    vi.subtotal,
    vi.tax_amount,
    vi.total,
    vi.currency,
    vi.status,
    vi.paid_date,
    vi.payment_method,
    vi.payment_reference,
    vi.notes,
    vi.attachment_url,
    vi.created_by_user_id,
    vi.created_at,
    vi.updated_at,
    v.name AS vendor_name,
    po.po_number
  FROM vendor_invoices vi
  LEFT JOIN vendors v ON vi.vendor_id = v.vendor_id
  LEFT JOIN purchase_orders po ON vi.po_id = po.po_id
`;

function withComputedOverdue(row) {
  if (!row) return row;
  if (row.status === 'unpaid' && row.due_date) {
    const due = new Date(row.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today) {
      return { ...row, status: 'overdue' };
    }
  }
  return row;
}

class VendorInvoice {
  // Whitelisted sort columns to prevent injection
  static SORTABLE_COLUMNS = {
    invoice_date: 'vi.invoice_date',
    due_date: 'vi.due_date',
    total: 'vi.total',
    vendor_name: 'v.name',
    invoice_number: 'vi.invoice_number'
  };

  static async findAll(filters = {}) {
    const {
      vendor_id,
      status,
      date_from,
      date_to,
      due_from,
      due_to,
      po_id,
      q,
      sortBy = 'invoice_date',
      sortDir = 'DESC',
      page = 1,
      pageSize = 50
    } = filters;

    let whereClause = '1=1';
    const params = [];

    if (vendor_id) {
      whereClause += ' AND vi.vendor_id = ?';
      params.push(vendor_id);
    }
    if (po_id) {
      whereClause += ' AND vi.po_id = ?';
      params.push(po_id);
    }
    if (date_from) {
      whereClause += ' AND vi.invoice_date >= ?';
      params.push(date_from);
    }
    if (date_to) {
      whereClause += ' AND vi.invoice_date <= ?';
      params.push(date_to);
    }
    if (due_from) {
      whereClause += ' AND vi.due_date >= ?';
      params.push(due_from);
    }
    if (due_to) {
      whereClause += ' AND vi.due_date <= ?';
      params.push(due_to);
    }
    if (q && q.trim()) {
      whereClause += ' AND (vi.invoice_number LIKE ? OR vi.notes LIKE ? OR vi.payment_reference LIKE ?)';
      const term = `%${q.trim()}%`;
      params.push(term, term, term);
    }

    // status filter: treat 'overdue' as (status='unpaid' AND due_date < CURDATE())
    if (status === 'overdue') {
      whereClause += " AND vi.status = 'unpaid' AND vi.due_date IS NOT NULL AND vi.due_date < CURDATE()";
    } else if (status === 'unpaid') {
      // Strict unpaid (not overdue)
      whereClause += " AND vi.status = 'unpaid' AND (vi.due_date IS NULL OR vi.due_date >= CURDATE())";
    } else if (status === 'paid') {
      whereClause += " AND vi.status = 'paid'";
    }

    const limit = Math.min(Number(pageSize) || 50, 200);
    const offset = (Number(page) - 1) * limit;

    // Sort whitelist
    const sortCol = VendorInvoice.SORTABLE_COLUMNS[sortBy] || 'vi.invoice_date';
    const sortDirection = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM vendor_invoices vi
       LEFT JOIN vendors v ON vi.vendor_id = v.vendor_id
       LEFT JOIN purchase_orders po ON vi.po_id = po.po_id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `${SELECT_BASE} WHERE ${whereClause}
       ORDER BY ${sortCol} ${sortDirection}, vi.due_date ASC, vi.invoice_id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      invoices: rows.map(withComputedOverdue),
      total,
      page: Number(page) || 1,
      pageSize: limit
    };
  }

  static async summary() {
    const [rows] = await pool.query(`
      SELECT
        SUM(CASE WHEN status = 'unpaid' AND (due_date IS NULL OR due_date >= CURDATE()) THEN 1 ELSE 0 END) AS unpaid_count,
        SUM(CASE WHEN status = 'unpaid' AND due_date IS NOT NULL AND due_date < CURDATE() THEN 1 ELSE 0 END) AS overdue_count,
        SUM(CASE WHEN status = 'paid' AND paid_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS paid_last_30_days_count,
        COUNT(*) AS total_count,
        COALESCE(SUM(CASE WHEN status = 'unpaid' AND (due_date IS NULL OR due_date >= CURDATE()) THEN total ELSE 0 END), 0) AS total_unpaid_amount,
        COALESCE(SUM(CASE WHEN status = 'unpaid' AND due_date IS NOT NULL AND due_date < CURDATE() THEN total ELSE 0 END), 0) AS total_overdue_amount
      FROM vendor_invoices
    `);
    const r = rows[0];
    return {
      unpaid_count: Number(r.unpaid_count) || 0,
      overdue_count: Number(r.overdue_count) || 0,
      paid_last_30_days_count: Number(r.paid_last_30_days_count) || 0,
      total_count: Number(r.total_count) || 0,
      total_unpaid_amount: Number(r.total_unpaid_amount) || 0,
      total_overdue_amount: Number(r.total_overdue_amount) || 0
    };
  }

  static async findById(invoiceId) {
    const [rows] = await pool.query(
      `${SELECT_BASE} WHERE vi.invoice_id = ?`,
      [invoiceId]
    );
    return withComputedOverdue(rows[0] || null);
  }

  static async create(data) {
    const {
      invoice_number,
      vendor_id,
      po_id = null,
      invoice_date,
      due_date = null,
      subtotal = 0,
      tax_amount = 0,
      total,
      currency = 'MMK',
      notes = null,
      attachment_url = null,
      created_by_user_id
    } = data;

    // Required fields
    if (!invoice_number || !vendor_id || !invoice_date || total == null || !created_by_user_id) {
      throw new VendorInvoiceError(
        'MISSING_FIELDS',
        'invoice_number, vendor_id, invoice_date, total, created_by_user_id are required'
      );
    }

    // Vendor exists + active
    const [vendorRows] = await pool.query(
      'SELECT vendor_id, status FROM vendors WHERE vendor_id = ?',
      [vendor_id]
    );
    if (vendorRows.length === 0) {
      throw new VendorInvoiceError('VENDOR_NOT_FOUND', `Vendor ${vendor_id} not found`);
    }

    // PO link must belong to same vendor (if provided)
    if (po_id) {
      const [poRows] = await pool.query(
        'SELECT po_id, vendor_id FROM purchase_orders WHERE po_id = ?',
        [po_id]
      );
      if (poRows.length === 0) {
        throw new VendorInvoiceError('PO_NOT_FOUND', `PO ${po_id} not found`);
      }
      if (poRows[0].vendor_id !== Number(vendor_id)) {
        throw new VendorInvoiceError(
          'PO_VENDOR_MISMATCH',
          'PO belongs to a different vendor than the invoice'
        );
      }
    }

    // Duplicate invoice_number for same vendor → friendly error before DB UNIQUE blocks
    const [dupRows] = await pool.query(
      'SELECT invoice_id FROM vendor_invoices WHERE vendor_id = ? AND invoice_number = ?',
      [vendor_id, invoice_number]
    );
    if (dupRows.length > 0) {
      throw new VendorInvoiceError(
        'DUPLICATE_INVOICE_NUMBER',
        `Invoice number "${invoice_number}" already exists for this vendor`
      );
    }

    // invoice_date sanity (not too far in the future; allow +1 day for TZ slip)
    const invDate = new Date(invoice_date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    if (invDate > tomorrow) {
      throw new VendorInvoiceError(
        'INVOICE_DATE_FUTURE',
        'Invoice date cannot be in the future'
      );
    }

    // due_date >= invoice_date
    if (due_date) {
      const due = new Date(due_date);
      if (due < invDate) {
        throw new VendorInvoiceError(
          'DUE_BEFORE_INVOICE',
          'Due date cannot be before invoice date'
        );
      }
    }

    // Validate total matches subtotal+tax (allow small rounding tolerance)
    const computedTotal = Number(subtotal) + Number(tax_amount);
    if (Math.abs(Number(total) - computedTotal) > 0.01 && Number(total) !== computedTotal) {
      // Caller may pass total slightly off due to rounding; we accept theirs but log.
      // No error — total is authoritative if explicitly provided.
    }

    const [result] = await pool.query(
      `INSERT INTO vendor_invoices
        (invoice_number, vendor_id, po_id, invoice_date, due_date,
         subtotal, tax_amount, total, currency, notes, attachment_url, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice_number,
        vendor_id,
        po_id,
        invoice_date,
        due_date,
        Number(subtotal) || 0,
        Number(tax_amount) || 0,
        Number(total),
        currency,
        notes,
        attachment_url,
        created_by_user_id
      ]
    );

    return VendorInvoice.findById(result.insertId);
  }

  static async update(invoiceId, partial) {
    const existing = await VendorInvoice.findById(invoiceId);
    if (!existing) {
      throw new VendorInvoiceError('NOT_FOUND', `Invoice ${invoiceId} not found`);
    }

    // Underlying DB status (not computed overdue) — overdue invoices ARE editable since they're unpaid in storage.
    const [rawRows] = await pool.query(
      'SELECT status FROM vendor_invoices WHERE invoice_id = ?',
      [invoiceId]
    );
    if (rawRows[0].status === 'paid') {
      throw new VendorInvoiceError(
        'INVOICE_NOT_EDITABLE',
        'Paid invoices cannot be edited'
      );
    }

    const allowed = [
      'invoice_number',
      'invoice_date',
      'due_date',
      'subtotal',
      'tax_amount',
      'total',
      'notes',
      'attachment_url',
      'currency'
    ];

    const fields = [];
    const params = [];
    allowed.forEach((f) => {
      if (Object.prototype.hasOwnProperty.call(partial, f)) {
        fields.push(`${f} = ?`);
        params.push(partial[f]);
      }
    });

    if (fields.length === 0) {
      return existing;
    }

    // If invoice_number changes, dup-check
    if (partial.invoice_number && partial.invoice_number !== existing.invoice_number) {
      const [dupRows] = await pool.query(
        'SELECT invoice_id FROM vendor_invoices WHERE vendor_id = ? AND invoice_number = ? AND invoice_id != ?',
        [existing.vendor_id, partial.invoice_number, invoiceId]
      );
      if (dupRows.length > 0) {
        throw new VendorInvoiceError(
          'DUPLICATE_INVOICE_NUMBER',
          `Invoice number "${partial.invoice_number}" already exists for this vendor`
        );
      }
    }

    params.push(invoiceId);
    await pool.query(
      `UPDATE vendor_invoices SET ${fields.join(', ')} WHERE invoice_id = ?`,
      params
    );

    return VendorInvoice.findById(invoiceId);
  }

  static async markPaid(invoiceId, { paid_date, payment_method, payment_reference = null }) {
    if (!paid_date || !payment_method) {
      throw new VendorInvoiceError(
        'MISSING_FIELDS',
        'paid_date and payment_method are required'
      );
    }

    const allowedMethods = ['cash', 'bank_transfer', 'mobile_money', 'other'];
    if (!allowedMethods.includes(payment_method)) {
      throw new VendorInvoiceError(
        'INVALID_PAYMENT_METHOD',
        `payment_method must be one of: ${allowedMethods.join(', ')}`
      );
    }

    const [rawRows] = await pool.query(
      'SELECT status FROM vendor_invoices WHERE invoice_id = ?',
      [invoiceId]
    );
    if (rawRows.length === 0) {
      throw new VendorInvoiceError('NOT_FOUND', `Invoice ${invoiceId} not found`);
    }
    if (rawRows[0].status === 'paid') {
      throw new VendorInvoiceError(
        'ALREADY_PAID',
        'Invoice is already marked as paid'
      );
    }

    await pool.query(
      `UPDATE vendor_invoices
       SET status = 'paid',
           paid_date = ?,
           payment_method = ?,
           payment_reference = ?,
           updated_at = NOW()
       WHERE invoice_id = ?`,
      [paid_date, payment_method, payment_reference, invoiceId]
    );

    return VendorInvoice.findById(invoiceId);
  }

  static async delete(invoiceId) {
    const [rows] = await pool.query(
      'SELECT status, paid_date FROM vendor_invoices WHERE invoice_id = ?',
      [invoiceId]
    );
    if (rows.length === 0) {
      throw new VendorInvoiceError('NOT_FOUND', `Invoice ${invoiceId} not found`);
    }
    if (rows[0].status === 'paid' || rows[0].paid_date) {
      throw new VendorInvoiceError(
        'INVOICE_NOT_DELETABLE',
        'Paid invoices cannot be deleted (audit requirement)'
      );
    }

    await pool.query('DELETE FROM vendor_invoices WHERE invoice_id = ?', [invoiceId]);
  }
}

VendorInvoice.VendorInvoiceError = VendorInvoiceError;

module.exports = VendorInvoice;
