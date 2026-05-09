const vendorSettingsService = require('../services/vendorSettingsService');
const emailService = require('../services/emailService');

/**
 * GET /api/vendor-settings
 */
exports.getSettings = async (req, res) => {
  try {
    const settings = await vendorSettingsService.getSettingsForApi();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to get settings' } });
  }
};

/**
 * PUT /api/vendor-settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const {
      auto_reorder_mode,
      auto_reorder_cron,
      lead_time_buffer_days,
      digest_email_enabled,
      from_display_name,
      reply_to_email,
      smtp_host,
      smtp_port,
      smtp_username,
      smtp_password
    } = req.body || {};

    // Validate cron expression if provided
    if (auto_reorder_cron) {
      const cronRegex = /^(\*|([0-5]?\d)(-([0-5]?\d))?)(\/(\d+))?(\s+(\*|([0-5]?\d)(-([0-5]?\d))?)(\/(\d+))?){4}$/;
      if (!cronRegex.test(auto_reorder_cron)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_CRON', message: 'Invalid cron expression' } });
      }
    }

    // Validate lead_time_buffer_days
    if (lead_time_buffer_days !== undefined) {
      if (lead_time_buffer_days < 0 || !Number.isInteger(lead_time_buffer_days)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_VALUE', message: 'lead_time_buffer_days must be a non-negative integer' } });
      }
    }

    // Validate reply_to_email if provided
    if (reply_to_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(reply_to_email)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_EMAIL', message: 'Invalid reply_to_email format' } });
      }
    }

    // Build update object
    const updateData = {};
    if (auto_reorder_mode) updateData.auto_reorder_mode = auto_reorder_mode;
    if (auto_reorder_cron) updateData.auto_reorder_cron = auto_reorder_cron;
    if (lead_time_buffer_days !== undefined) updateData.lead_time_buffer_days = lead_time_buffer_days;
    if (digest_email_enabled !== undefined) updateData.digest_email_enabled = digest_email_enabled;
    if (from_display_name !== undefined) updateData.from_display_name = from_display_name;
    if (reply_to_email !== undefined) updateData.reply_to_email = reply_to_email;
    if (smtp_host !== undefined) updateData.smtp_host = smtp_host;
    if (smtp_port !== undefined) updateData.smtp_port = smtp_port;
    if (smtp_username !== undefined) updateData.smtp_username = smtp_username;
    if (smtp_password !== undefined && smtp_password !== '' && smtp_password !== '***') {
      updateData.smtp_password = smtp_password;
    }

    await vendorSettingsService.updateSettings(updateData);

    // Invalidate transporter to pick up new credentials
    emailService.invalidateTransporter();

    const settings = await vendorSettingsService.getSettingsForApi();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update settings' } });
  }
};

/**
 * POST /api/vendor-settings/test-email
 */
exports.testEmail = async (req, res) => {
  try {
    const { to } = req.body || {};

    const vendorSettingsService = require('../services/vendorSettingsService');
    const smtpConfig = await vendorSettingsService.getSmtpConfig();
    if (!smtpConfig) {
      return res.status(400).json({ success: false, error: { code: 'SMTP_NOT_CONFIGURED', message: 'SMTP is not configured' } });
    }

    const settings = await vendorSettingsService.getSettingsForApi();
    const recipient = to || settings.reply_to_email;

    if (!recipient) {
      return res.status(400).json({ success: false, error: { code: 'NO_RECIPIENT', message: 'No recipient email provided' } });
    }

    const result = await emailService.sendMail({
      to: recipient,
      subject: 'POS Myanmar — SMTP test',
      html: '<p>This is a test email from POS Myanmar.</p>',
      emailType: 'test'
    });

    res.status(200).json({
      success: true,
      data: {
        status: result.status,
        log_id: result.logId,
        last_error: result.last_error || null
      }
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to send test email' } });
  }
};