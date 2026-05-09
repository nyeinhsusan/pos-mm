const { pool } = require('../config/database');
const emailService = require('../services/emailService');
const pdfService = require('../services/pdfService');
const StoreConfig = require('../models/StoreConfig');

/**
 * GET /api/email-log
 * List email logs with filters and pagination
 */
exports.getAllEmailLogs = async (req, res) => {
  try {
    const { status, email_type, date_from, date_to, vendor_id, page = 1, pageSize = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    const limit = Math.min(Number(pageSize), 200);

    let whereClause = '1=1';
    const params = [];

    if (status) {
      whereClause += ' AND el.status = ?';
      params.push(status);
    }
    if (email_type) {
      whereClause += ' AND el.email_type = ?';
      params.push(email_type);
    }
    if (date_from) {
      whereClause += ' AND el.created_at >= ?';
      params.push(date_from);
    }
    if (date_to) {
      whereClause += ' AND el.created_at <= ?';
      params.push(date_to);
    }

    // Join to get vendor_id via PO if needed
    if (vendor_id) {
      whereClause += ' AND po.vendor_id = ?';
      params.push(vendor_id);
    }

    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM email_log el
        LEFT JOIN purchase_orders po ON el.related_po_id = po.po_id
        WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get logs with enrichment
    const [logs] = await pool.query(
      `SELECT el.*,
              po.po_id, po.po_number,
              v.name as vendor_name
       FROM email_log el
       LEFT JOIN purchase_orders po ON el.related_po_id = po.po_id
       LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
       WHERE ${whereClause}
       ORDER BY el.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Enrich logs
    const enrichedLogs = logs.map(log => ({
      ...log,
      related_po: log.po_id ? { po_id: log.po_id, po_number: log.po_number } : null,
      vendor_name: log.vendor_name || null
    }));

    res.status(200).json({
      success: true,
      data: enrichedLogs,
      total,
      page: Number(page),
      pageSize: limit
    });
  } catch (error) {
    console.error('Email log list error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to get email logs' } });
  }
};

/**
 * POST /api/email-log/:id/retry
 * Retry a failed email
 */
exports.retryEmailLog = async (req, res) => {
  try {
    const logId = req.params.id;
    const { pool: dbPool } = require('../config/database');

    // Load log
    const [logs] = await dbPool.query('SELECT * FROM email_log WHERE log_id = ?', [logId]);
    if (logs.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Email log not found' } });
    }

    const log = logs[0];

    // Only failed logs can be retried
    if (log.status !== 'failed') {
      return res.status(409).json({ success: false, error: { code: 'LOG_NOT_RETRYABLE', message: 'Only failed emails can be retried' } });
    }

    // Check email type
    if (!['po', 'test'].includes(log.email_type)) {
      return res.status(501).json({ success: false, error: { code: 'NOT_SUPPORTED', message: 'Retry not supported for this email type' } });
    }

    let result;
    if (log.email_type === 'po') {
      // Load PO and regenerate PDF + email
      const PurchaseOrder = require('../models/PurchaseOrder');
      const po = await PurchaseOrder.findById(log.related_po_id);
      if (!po) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Related PO not found' } });
      }

      const branding = await StoreConfig.get();
      const pdfResult = await pdfService.generatePoPdf(po, branding);
      const shopName = branding?.store_name || 'POS Myanmar';
      const contactName = po.vendor?.contact_name || po.vendor?.name || 'Vendor';

      const itemsList = po.items.map(item =>
        `• ${item.product_name || `Product #${item.product_id}`}: ${item.quantity_ordered} × ${item.unit_cost} MMK`
      ).join('\n');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Purchase Order ${po.po_number}</h2>
          <p>Dear ${contactName},</p>
          <p>Please find attached our purchase order for your review.</p>
          <h3 style="color: #555;">Order Details:</h3>
          <pre style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 15px; border-radius: 5px;">${itemsList}</pre>
          <h3 style="color: #333;">Total: ${Number(po.total).toLocaleString('en-US')} MMK</h3>
          <p>Please review the attached PDF and confirm receipt.</p>
        </div>
      `;

      result = await emailService.sendMail({
        to: po.vendor.email,
        subject: `Purchase Order ${po.po_number} from ${shopName}`,
        html: emailHtml,
        attachments: [{ filename: pdfResult.fileName, path: pdfResult.filePath }],
        emailType: 'po',
        relatedPoId: po.po_id,
        existingLogId: logId
      });
    } else if (log.email_type === 'test') {
      // Resend test email
      const vendorSettingsService = require('../services/vendorSettingsService');
      const smtpConfig = await vendorSettingsService.getSmtpConfig();
      if (!smtpConfig) {
        return res.status(400).json({ success: false, error: { code: 'SMTP_NOT_CONFIGURED', message: 'SMTP not configured' } });
      }

      result = await emailService.sendMail({
        to: log.recipient_email,
        subject: 'POS Myanmar — SMTP test',
        html: '<p>Test from POS Myanmar.</p>',
        emailType: 'test',
        existingLogId: logId
      });
    }

    res.status(200).json({
      success: true,
      data: {
        status: result.status,
        attempts: log.attempts + 1,
        last_error: result.last_error || null,
        log_id: logId
      }
    });
  } catch (error) {
    console.error('Retry error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to retry email' } });
  }
};