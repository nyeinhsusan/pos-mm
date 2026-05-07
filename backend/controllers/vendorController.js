const Vendor = require('../models/Vendor');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAYMENT_TERMS = ['NET_7', 'NET_15', 'NET_30', 'COD', 'PREPAID'];

function validateVendorPayload(data, { partial = false } = {}) {
  const errors = [];

  if (!partial || data.name !== undefined) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      errors.push('name is required');
    } else if (data.name.length > 255) {
      errors.push('name must be 255 characters or fewer');
    }
  }

  if (!partial || data.email !== undefined) {
    if (!data.email || typeof data.email !== 'string') {
      errors.push('email is required');
    } else if (!EMAIL_REGEX.test(data.email)) {
      errors.push('email format is invalid');
    }
  }

  if (data.payment_terms !== undefined && !PAYMENT_TERMS.includes(data.payment_terms)) {
    errors.push(`payment_terms must be one of: ${PAYMENT_TERMS.join(', ')}`);
  }

  if (data.lead_time_days !== undefined) {
    const n = Number(data.lead_time_days);
    if (!Number.isInteger(n) || n < 0 || n > 365) {
      errors.push('lead_time_days must be an integer between 0 and 365');
    }
  }

  return errors;
}

/**
 * GET /api/vendors?status=active|archived&search=foo
 */
exports.getAllVendors = async (req, res) => {
  try {
    const { status, search } = req.query;
    const vendors = await Vendor.findAll({ status, search });
    res.status(200).json({ success: true, count: vendors.length, data: vendors });
  } catch (error) {
    console.error('Get all vendors error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve vendors', details: error.message }
    });
  }
};

/**
 * GET /api/vendors/:id
 */
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: { message: 'Vendor not found' }
      });
    }
    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    console.error('Get vendor by ID error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve vendor', details: error.message }
    });
  }
};

/**
 * POST /api/vendors
 */
exports.createVendor = async (req, res) => {
  try {
    const errors = validateVendorPayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', details: errors.join('; ') }
      });
    }

    const vendorId = await Vendor.create(req.body);
    res.status(201).json({ success: true, data: { vendor_id: vendorId } });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create vendor', details: error.message }
    });
  }
};

/**
 * PUT /api/vendors/:id
 */
exports.updateVendor = async (req, res) => {
  try {
    const errors = validateVendorPayload(req.body, { partial: true });
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', details: errors.join('; ') }
      });
    }

    const existing = await Vendor.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { message: 'Vendor not found' }
      });
    }

    await Vendor.update(req.params.id, req.body);
    const updated = await Vendor.findById(req.params.id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update vendor', details: error.message }
    });
  }
};

/**
 * POST /api/vendors/:id/archive
 */
exports.archiveVendor = async (req, res) => {
  try {
    const affected = await Vendor.archive(req.params.id);
    if (affected === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Vendor not found' }
      });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Archive vendor error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to archive vendor', details: error.message }
    });
  }
};

/**
 * POST /api/vendors/:id/restore
 */
exports.restoreVendor = async (req, res) => {
  try {
    const affected = await Vendor.restore(req.params.id);
    if (affected === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Vendor not found' }
      });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Restore vendor error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to restore vendor', details: error.message }
    });
  }
};

/**
 * DELETE /api/vendors/:id
 */
exports.deleteVendor = async (req, res) => {
  try {
    const affected = await Vendor.hardDelete(req.params.id);
    if (affected === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Vendor not found' }
      });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    if (error.code === 'HAS_OPEN_POS') {
      return res.status(409).json({
        success: false,
        error: { code: 'HAS_OPEN_POS', message: error.message }
      });
    }
    console.error('Delete vendor error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete vendor', details: error.message }
    });
  }
};

/**
 * POST /api/vendors/:id/logo (multipart/form-data, field "logo")
 * The route layer attaches multer's req.file. Stores logo_url path.
 */
exports.uploadVendorLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No logo file provided' }
      });
    }

    const existing = await Vendor.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { message: 'Vendor not found' }
      });
    }

    const logo_url = `/uploads/vendors/${req.file.filename}`;
    await Vendor.update(req.params.id, { logo_url });

    res.status(200).json({ success: true, data: { logo_url } });
  } catch (error) {
    console.error('Upload vendor logo error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to upload logo', details: error.message }
    });
  }
};
