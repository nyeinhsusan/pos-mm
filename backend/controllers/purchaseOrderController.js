const PurchaseOrder = require('../models/PurchaseOrder');
const emailService = require('../services/emailService');
const vendorSettingsService = require('../services/vendorSettingsService');
const pdfService = require('../services/pdfService');
const StoreConfig = require('../models/StoreConfig');

const PurchaseOrderError = PurchaseOrder.PurchaseOrderError;

const ERROR_TO_STATUS = {
  NOT_FOUND: 404,
  PO_NOT_EDITABLE: 409,
  PO_NOT_CANCELLABLE: 409,
  VENDOR_NOT_CHANGEABLE: 409,
  VENDOR_ARCHIVED: 400,
  INVALID_VENDOR: 400,
  INVALID_PRODUCT: 400,
  INVALID_QUANTITY: 400,
  INVALID_UNIT_COST: 400,
  INVALID_TAX: 400,
  INVALID_USER: 400,
  EMPTY_PO: 400
};

function handleDomainError(error, res, fallbackMessage) {
  if (error instanceof PurchaseOrderError) {
    const status = ERROR_TO_STATUS[error.code] || 500;
    return res.status(status).json({
      success: false,
      error: { code: error.code, message: error.message, ...(error.meta || {}) }
    });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({
    success: false,
    error: { message: fallbackMessage, details: error.message }
  });
}

/**
 * GET /api/purchase-orders
 */
exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const { status, vendor_id, source, date_from, date_to, search } = req.query;
    const purchaseOrders = await PurchaseOrder.findAll({
      status,
      vendor_id,
      source,
      date_from,
      date_to,
      search
    });
    res.status(200).json({
      success: true,
      count: purchaseOrders.length,
      data: purchaseOrders
    });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to retrieve purchase orders');
  }
};

/**
 * GET /api/purchase-orders/:id
 */
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Purchase order not found' }
      });
    }
    res.status(200).json({ success: true, data: po });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to retrieve purchase order');
  }
};

/**
 * POST /api/purchase-orders
 * Body: { vendor_id, notes?, source?, items: [{ product_id, quantity_ordered, unit_cost, tax_amount? }] }
 */
exports.createPurchaseOrder = async (req, res) => {
  try {
    const { vendor_id, notes, source, items } = req.body || {};
    if (vendor_id == null) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'vendor_id is required' }
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_PO', message: 'items array is required and must contain at least one entry' }
      });
    }

    const created = await PurchaseOrder.create({
      vendor_id,
      notes,
      source,
      items,
      created_by_user_id: req.user.user_id
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to create purchase order');
  }
};

/**
 * PUT /api/purchase-orders/:id
 * Body: { notes?, items? }  (vendor_id is rejected if present and different)
 */
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const { notes, items, vendor_id } = req.body || {};
    if (notes === undefined && items === undefined && vendor_id === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Provide at least one updatable field (notes or items)'
        }
      });
    }

    const updated = await PurchaseOrder.update(req.params.id, { notes, items, vendor_id });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to update purchase order');
  }
};

/**
 * POST /api/purchase-orders/:id/cancel
 * Body: { reason? }
 */
exports.cancelPurchaseOrder = async (req, res) => {
  try {
    const { reason } = req.body || {};
    const updated = await PurchaseOrder.cancel(req.params.id, { reason });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to cancel purchase order');
  }
};

/**
 * POST /api/purchase-orders/:id/send
 * Send a PO via email with PDF attachment
 */
exports.sendPurchaseOrder = async (req, res) => {
  try {
    const poId = req.params.id;

    // 1. Load PO
    const po = await PurchaseOrder.findById(poId);
    if (!po) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Purchase order not found' }
      });
    }

    // 2. Status check - must be draft
    if (po.status !== 'draft') {
      return res.status(409).json({
        success: false,
        error: { code: 'PO_NOT_SENDABLE', message: 'Only draft purchase orders can be sent' }
      });
    }

    // 3. Vendor must have email
    const vendorEmail = po.vendor?.email;
    if (!vendorEmail) {
      return res.status(400).json({
        success: false,
        error: { code: 'VENDOR_HAS_NO_EMAIL', message: 'Vendor has no email address' }
      });
    }

    // 4. SMTP must be configured
    const smtpConfig = await vendorSettingsService.getSmtpConfig();
    if (!smtpConfig) {
      return res.status(400).json({
        success: false,
        error: { code: 'SMTP_NOT_CONFIGURED', message: 'SMTP is not configured' }
      });
    }

    // 5. Generate PDF
    const branding = await StoreConfig.get();
    const pdfResult = await pdfService.generatePoPdf(po, branding);

    // 6. Compose email
    const shopName = branding?.store_name || 'POS Myanmar';
    const vendorName = po.vendor?.name || 'Vendor';
    const contactName = po.vendor?.contact_name || vendorName;
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
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          This email was sent from ${shopName}.<br>
          Please do not reply to this email directly. For inquiries, please contact us through our official channels.
        </p>
      </div>
    `;

    const emailSubject = `Purchase Order ${po.po_number} from ${shopName}`;

    // 7. Send email
    const emailResult = await emailService.sendMail({
      to: vendorEmail,
      subject: emailSubject,
      html: emailHtml,
      attachments: [{
        filename: pdfResult.fileName,
        path: pdfResult.filePath
      }],
      emailType: 'po',
      relatedPoId: po.po_id
    });

    // 8. Handle result
    if (emailResult.status === 'sent') {
      // Update PO status to sent
      await PurchaseOrder.markAsSent(poId, pdfResult.url);

      const updatedPo = await PurchaseOrder.findById(poId);
      return res.status(200).json({
        success: true,
        data: {
          purchase_order: updatedPo,
          email_log_id: emailResult.logId,
          status: 'sent'
        }
      });
    } else {
      // Email failed - PO stays as draft
      return res.status(502).json({
        success: false,
        error: {
          code: 'EMAIL_FAILED',
          message: 'Failed to send email',
          email_log_id: emailResult.logId
        }
      });
    }
  } catch (error) {
    return handleDomainError(error, res, 'Failed to send purchase order');
  }
};
