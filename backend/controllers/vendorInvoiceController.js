const VendorInvoice = require('../models/VendorInvoice');

const VendorInvoiceError = VendorInvoice.VendorInvoiceError;

const ERROR_TO_STATUS = {
  NOT_FOUND: 404,
  VENDOR_NOT_FOUND: 400,
  PO_NOT_FOUND: 400,
  PO_VENDOR_MISMATCH: 400,
  MISSING_FIELDS: 400,
  DUPLICATE_INVOICE_NUMBER: 409,
  INVOICE_DATE_FUTURE: 400,
  DUE_BEFORE_INVOICE: 400,
  INVOICE_NOT_EDITABLE: 409,
  INVOICE_NOT_DELETABLE: 409,
  ALREADY_PAID: 409,
  INVALID_PAYMENT_METHOD: 400
};

function handleDomainError(error, res, fallbackMessage) {
  if (error instanceof VendorInvoiceError) {
    const status = ERROR_TO_STATUS[error.code] || 500;
    return res.status(status).json({
      success: false,
      error: { code: error.code, message: error.message }
    });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: fallbackMessage }
  });
}

exports.getAllInvoices = async (req, res) => {
  try {
    const result = await VendorInvoice.findAll({
      vendor_id: req.query.vendor_id,
      status: req.query.status,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      due_from: req.query.due_from,
      due_to: req.query.due_to,
      po_id: req.query.po_id,
      q: req.query.q,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
      page: req.query.page,
      pageSize: req.query.pageSize
    });
    res.status(200).json({ success: true, data: result.invoices, total: result.total, page: result.page, pageSize: result.pageSize });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to list invoices');
  }
};

exports.getSummary = async (req, res) => {
  try {
    const summary = await VendorInvoice.summary();
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to get invoice summary');
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await VendorInvoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invoice not found' }
      });
    }
    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to get invoice');
  }
};

exports.createInvoice = async (req, res) => {
  try {
    const invoice = await VendorInvoice.create({
      ...req.body,
      created_by_user_id: req.user.user_id
    });
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to create invoice');
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await VendorInvoice.update(req.params.id, req.body);
    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to update invoice');
  }
};

exports.markPaid = async (req, res) => {
  try {
    const invoice = await VendorInvoice.markPaid(req.params.id, {
      paid_date: req.body.paid_date,
      payment_method: req.body.payment_method,
      payment_reference: req.body.payment_reference
    });
    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to mark invoice paid');
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    await VendorInvoice.delete(req.params.id);
    res.status(204).end();
  } catch (error) {
    return handleDomainError(error, res, 'Failed to delete invoice');
  }
};

exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FILE', message: 'attachment file required' }
      });
    }
    const url = `/uploads/vendor-invoices/${req.file.filename}`;
    const invoice = await VendorInvoice.update(req.params.id, { attachment_url: url });
    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    return handleDomainError(error, res, 'Failed to upload attachment');
  }
};
