const { pool } = require('../config/database');
const cryptoService = require('./cryptoService');

/**
 * Vendor module settings service.
 *
 * The vendor_settings table is a singleton (id=1). All reads upsert the row
 * if missing as a defensive measure. SMTP password is encrypted at rest
 * using AES-256-GCM (cryptoService) and is NEVER returned to API callers.
 *
 * Two read paths:
 *   - getSettings()       — internal use; decrypts smtp_password to plaintext.
 *                           Caller (emailService) must keep it in memory only.
 *   - getSettingsForApi() — safe to return to clients; smtp_password redacted
 *                           to '***' if set, null otherwise.
 */

const REDACTION_SENTINEL = '***';

async function ensureRowExists() {
  await pool.query('INSERT IGNORE INTO vendor_settings (id) VALUES (1)');
}

async function fetchRow() {
  await ensureRowExists();
  const [rows] = await pool.query(
    `SELECT id, auto_reorder_mode, auto_reorder_cron, lead_time_buffer_days,
            digest_email_enabled, from_display_name, reply_to_email,
            smtp_host, smtp_port, smtp_username, smtp_password_encrypted,
            created_at, updated_at
     FROM vendor_settings WHERE id = 1`
  );
  return rows[0];
}

/**
 * Internal read with decrypted SMTP password.
 * SECURITY: returned smtp_password is plaintext — service-only, never log,
 * never return through API responses.
 */
async function getSettings() {
  const row = await fetchRow();
  let smtp_password = null;
  if (row.smtp_password_encrypted && cryptoService.isKeyConfigured()) {
    try {
      // SECURITY: smtp_password held in memory only for this caller.
      smtp_password = cryptoService.decrypt(row.smtp_password_encrypted);
    } catch (err) {
      console.error('[vendorSettings] failed to decrypt SMTP password:', err.message);
    }
  }
  return {
    id: row.id,
    auto_reorder_mode: row.auto_reorder_mode,
    auto_reorder_cron: row.auto_reorder_cron,
    lead_time_buffer_days: row.lead_time_buffer_days,
    digest_email_enabled: !!row.digest_email_enabled,
    from_display_name: row.from_display_name,
    reply_to_email: row.reply_to_email,
    smtp_host: row.smtp_host,
    smtp_port: row.smtp_port,
    smtp_username: row.smtp_username,
    smtp_password, // SECURITY: plaintext, do not log or return via API
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Safe-to-return-to-client variant. Redacts smtp_password to '***' if set.
 */
async function getSettingsForApi() {
  const row = await fetchRow();
  return {
    id: row.id,
    auto_reorder_mode: row.auto_reorder_mode,
    auto_reorder_cron: row.auto_reorder_cron,
    lead_time_buffer_days: row.lead_time_buffer_days,
    digest_email_enabled: !!row.digest_email_enabled,
    from_display_name: row.from_display_name,
    reply_to_email: row.reply_to_email,
    smtp_host: row.smtp_host,
    smtp_port: row.smtp_port,
    smtp_username: row.smtp_username,
    smtp_password: row.smtp_password_encrypted ? REDACTION_SENTINEL : null,
    smtp_configured: !!(
      row.smtp_password_encrypted &&
      row.smtp_host &&
      row.smtp_username
    ),
    encryption_key_configured: cryptoService.isKeyConfigured(),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Update settings. Whitelist enforced. If smtp_password is provided and is
 * not the redaction sentinel, it is encrypted and stored; if it equals the
 * sentinel or is undefined, the existing value is preserved.
 */
async function updateSettings(partial) {
  await ensureRowExists();

  const allowedFields = [
    'auto_reorder_mode',
    'auto_reorder_cron',
    'lead_time_buffer_days',
    'digest_email_enabled',
    'from_display_name',
    'reply_to_email',
    'smtp_host',
    'smtp_port',
    'smtp_username'
  ];

  const fields = [];
  const values = [];
  allowedFields.forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(partial, f)) {
      fields.push(`${f} = ?`);
      values.push(partial[f]);
    }
  });

  // SMTP password — encrypt only if a new real value is provided
  if (
    Object.prototype.hasOwnProperty.call(partial, 'smtp_password') &&
    partial.smtp_password !== REDACTION_SENTINEL &&
    partial.smtp_password !== undefined
  ) {
    if (partial.smtp_password === null || partial.smtp_password === '') {
      fields.push('smtp_password_encrypted = NULL');
      // no value pushed
    } else {
      if (!cryptoService.isKeyConfigured()) {
        const err = new Error(
          'Cannot save SMTP password: SMTP_ENCRYPTION_KEY is not set in env'
        );
        err.code = 'SMTP_KEY_MISSING';
        throw err;
      }
      // SECURITY: encrypt before storing; never persist plaintext.
      const ciphertext = cryptoService.encrypt(String(partial.smtp_password));
      fields.push('smtp_password_encrypted = ?');
      values.push(ciphertext);
    }
  }

  if (fields.length === 0) {
    return getSettingsForApi();
  }

  await pool.query(`UPDATE vendor_settings SET ${fields.join(', ')} WHERE id = 1`, values);
  return getSettingsForApi();
}

/**
 * Returns a nodemailer-shaped config or null if SMTP is not fully configured.
 * SECURITY: returned `auth.pass` is plaintext — caller is emailService only.
 */
async function getSmtpConfig() {
  const s = await getSettings();
  if (!s.smtp_host || !s.smtp_port || !s.smtp_username || !s.smtp_password) {
    return null;
  }
  return {
    host: s.smtp_host,
    port: Number(s.smtp_port),
    secure: Number(s.smtp_port) === 465,
    auth: {
      user: s.smtp_username,
      pass: s.smtp_password // SECURITY: plaintext; do not log
    }
  };
}

module.exports = {
  getSettings,
  getSettingsForApi,
  updateSettings,
  getSmtpConfig,
  REDACTION_SENTINEL
};
