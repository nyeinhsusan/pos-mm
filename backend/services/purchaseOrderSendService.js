const PurchaseOrder = require('../models/PurchaseOrder');
const emailService = require('./emailService');
const vendorSettingsService = require('./vendorSettingsService');
const pdfService = require('./pdfService');
const StoreConfig = require('../models/StoreConfig');

/**
 * Shared send-PO orchestration (extracted from purchaseOrderController.sendPurchaseOrder
 * for reuse by both the HTTP path and the auto-reorder cron path — Story 31).
 *
 * Returns a typed result:
 *   { status: 'sent' | 'failed', email_log_id, last_error?, purchase_order? }
 *
 * Domain errors throw with a `code` field; the controller wrapper maps them to HTTP.
 */

class PurchaseOrderSendError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PurchaseOrderSendError';
    this.code = code;
  }
}

async function sendPurchaseOrderById(poId /* , actorUserId */) {
  // Load PO
  const po = await PurchaseOrder.findById(poId);
  if (!po) {
    throw new PurchaseOrderSendError('NOT_FOUND', 'Purchase order not found');
  }

  if (po.status !== 'draft') {
    throw new PurchaseOrderSendError('PO_NOT_SENDABLE', 'Only draft purchase orders can be sent');
  }

  const vendorEmail = po.vendor?.email;
  if (!vendorEmail) {
    throw new PurchaseOrderSendError('VENDOR_HAS_NO_EMAIL', 'Vendor has no email address');
  }

  const smtpConfig = await vendorSettingsService.getSmtpConfig();
  if (!smtpConfig) {
    throw new PurchaseOrderSendError('SMTP_NOT_CONFIGURED', 'SMTP is not configured');
  }

  const branding = await StoreConfig.get();
  const pdfResult = await pdfService.generatePoPdf(po, branding);

  const shopName = branding?.store_name || 'POS Myanmar';
  const vendorName = po.vendor?.name || 'Vendor';
  const contactName = po.vendor?.contact_name || vendorName;
  const itemsList = po.items.map((item) =>
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

  const emailResult = await emailService.sendMail({
    to: vendorEmail,
    subject: emailSubject,
    html: emailHtml,
    attachments: [{ filename: pdfResult.fileName, path: pdfResult.filePath }],
    emailType: 'po',
    relatedPoId: po.po_id
  });

  if (emailResult.status === 'sent') {
    await PurchaseOrder.markAsSent(poId, pdfResult.url);
    const refreshed = await PurchaseOrder.findById(poId);
    return {
      status: 'sent',
      email_log_id: emailResult.logId,
      purchase_order: refreshed
    };
  }

  return {
    status: 'failed',
    email_log_id: emailResult.logId,
    last_error: emailResult.last_error || null
  };
}

module.exports = {
  sendPurchaseOrderById,
  PurchaseOrderSendError
};
