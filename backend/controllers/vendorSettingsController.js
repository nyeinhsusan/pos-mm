const vendorSettingsService = require('../services/vendorSettingsService');
const emailService = require('../services/emailService');
const { pool } = require('../config/database');
const cronModule = require('../cron');

const VALID_MODES = ['disabled', 'approve_first', 'auto_send'];

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
      smtp_password,
      confirm_auto_send
    } = req.body || {};

    // Validate mode value if provided
    if (auto_reorder_mode && !VALID_MODES.includes(auto_reorder_mode)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_MODE', message: `auto_reorder_mode must be one of: ${VALID_MODES.join(', ')}` }
      });
    }

    // Load current settings to detect transitions (Story 32)
    const current = await vendorSettingsService.getSettings();
    const oldMode = current.auto_reorder_mode;
    const oldCron = current.auto_reorder_cron;

    // Server-side confirm_auto_send enforcement (AC #2)
    if (
      auto_reorder_mode === 'auto_send' &&
      oldMode !== 'auto_send' &&
      confirm_auto_send !== true
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'AUTO_SEND_REQUIRES_CONFIRMATION',
          message: 'Switching to auto_send requires confirm_auto_send: true in the request body.'
        }
      });
    }

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

    // Story 32: live-reload cron if the expression changed
    if (auto_reorder_cron && auto_reorder_cron !== oldCron) {
      try {
        const ok = cronModule.reschedule(auto_reorder_cron);
        if (ok) {
          console.log(`[auto-reorder] cron rescheduled by user_id=${req.user?.user_id}: ${oldCron} → ${auto_reorder_cron}`);
        }
      } catch (rescheduleErr) {
        console.warn(`[auto-reorder] cron reschedule failed: ${rescheduleErr.message}`);
      }
    }

    // Story 32: log mode transitions for audit
    if (auto_reorder_mode && auto_reorder_mode !== oldMode) {
      console.log(`[auto-reorder] mode changed: ${oldMode} → ${auto_reorder_mode} by user_id=${req.user?.user_id}`);
    }

    const settings = await vendorSettingsService.getSettingsForApi();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update settings' } });
  }
};

/**
 * GET /api/auto-reorder/status (Story 32)
 *
 * Operational health snapshot for the Vendor Settings page:
 * last_run_*, next_scheduled_run, current_mode.
 */
exports.getAutoReorderStatus = async (req, res) => {
  try {
    const settings = await vendorSettingsService.getSettingsForApi();
    const [rows] = await pool.query(
      `SELECT run_id, started_at, finished_at, status, mode, triggered_by, actor_user_id,
              triggered_products_count, created_pos_count, failed_creations_count,
              auto_sent_count, auto_send_failed_count, error_message
       FROM auto_reorder_runs
       ORDER BY started_at DESC
       LIMIT 1`
    );

    const lastRun = rows[0] || null;
    // node-cron doesn't expose a next-fire-date helper across all versions; provide
    // the expression so the UI can render plain-English equivalents.
    const currentExpression = cronModule.getCurrentExpression() || settings.auto_reorder_cron || null;

    res.status(200).json({
      success: true,
      data: {
        current_mode: settings.auto_reorder_mode,
        cron_expression: currentExpression,
        last_run: lastRun
          ? {
              run_id: lastRun.run_id,
              started_at: lastRun.started_at,
              finished_at: lastRun.finished_at,
              status: lastRun.status,
              mode: lastRun.mode,
              triggered_by: lastRun.triggered_by,
              actor_user_id: lastRun.actor_user_id,
              triggered_products_count: lastRun.triggered_products_count,
              created_pos_count: lastRun.created_pos_count,
              failed_creations_count: lastRun.failed_creations_count,
              auto_sent_count: lastRun.auto_sent_count,
              auto_send_failed_count: lastRun.auto_send_failed_count,
              error_message: lastRun.error_message
            }
          : null
      }
    });
  } catch (error) {
    console.error('Get auto-reorder status error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to get auto-reorder status' } });
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