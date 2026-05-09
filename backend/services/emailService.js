const nodemailer = require('nodemailer');
const { pool } = require('../config/database');
const vendorSettingsService = require('./vendorSettingsService');

/**
 * Email service for the vendor module.
 *
 * Sends email via nodemailer using SMTP config from vendor_settings.
 * Every send is recorded in the email_log table — queued → sent | failed,
 * with attempt count and last_error captured. Retries 3 times with
 * exponential backoff (1s, 3s, 10s) before giving up.
 *
 * SECURITY: SMTP password is held only inside `transporter` for the duration
 * of a single send. Never logged. Never returned.
 */

const RETRY_DELAYS_MS = [1000, 3000, 10000];

let cachedTransporter = null;
let cachedConfigKey = null;

/**
 * Build a stable string key for an SMTP config so we can detect changes.
 */
function configKey(cfg) {
  if (!cfg) return null;
  // Hash of pass would be cleaner, but length+host+user is enough to detect
  // a change in dev. Don't include the password itself in the key string.
  return `${cfg.host}:${cfg.port}:${cfg.auth.user}:${cfg.auth.pass.length}`;
}

async function getTransporter() {
  const cfg = await vendorSettingsService.getSmtpConfig();
  if (!cfg) return null;

  const key = configKey(cfg);
  if (!cachedTransporter || cachedConfigKey !== key) {
    cachedTransporter = nodemailer.createTransport(cfg);
    cachedConfigKey = key;
  }
  return cachedTransporter;
}

/**
 * Force the transporter to be rebuilt on next send.
 * Called by Story-26 settings update endpoint after credentials change.
 */
function invalidateTransporter() {
  cachedTransporter = null;
  cachedConfigKey = null;
}

async function insertLogRow({ to, subject, emailType, relatedPoId, existingLogId }) {
  // If existingLogId provided (retry scenario), update existing row instead of inserting new
  if (existingLogId) {
    await pool.query(
      `UPDATE email_log SET recipient_email=?, subject=?, email_type=?, related_po_id=?, status='queued', attempts=attempts+1, last_error=NULL WHERE log_id=?`,
      [to, subject, emailType, relatedPoId || null, existingLogId]
    );
    return existingLogId;
  }
  // New email - insert fresh row
  const [result] = await pool.query(
    `INSERT INTO email_log (recipient_email, subject, email_type, related_po_id, status, attempts)
     VALUES (?, ?, ?, ?, 'queued', 0)`,
    [to, subject, emailType, relatedPoId || null]
  );
  return result.insertId;
}

async function markLogFailed(logId, attempts, error) {
  await pool.query(
    `UPDATE email_log SET status='failed', attempts=?, last_error=? WHERE log_id=?`,
    [attempts, String(error?.message || error || 'unknown error').slice(0, 2000), logId]
  );
}

async function markLogSent(logId, attempts) {
  await pool.query(
    `UPDATE email_log SET status='sent', attempts=?, sent_at=NOW(), last_error=NULL WHERE log_id=?`,
    [attempts, logId]
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send an email. Always returns a result object — never throws to the caller.
 *
 * @param {Object} args
 * @param {string} args.to            - recipient address
 * @param {string} args.subject       - subject line
 * @param {string} args.html          - HTML body
 * @param {string} [args.text]        - plain-text fallback
 * @param {Array}  [args.attachments] - nodemailer attachment array
 * @param {string} args.emailType     - 'po' | 'reminder' | 'manual' | 'test'
 * @param {number} [args.relatedPoId] - FK to purchase_orders.po_id
 * @returns {Promise<{ logId: number, status: 'sent'|'failed', attempts: number }>}
 */
async function sendMail({ to, subject, html, text, attachments, emailType, relatedPoId, existingLogId }) {
  if (!to || !subject || !emailType) {
    throw new TypeError('sendMail requires { to, subject, emailType }');
  }

  const logId = await insertLogRow({ to, subject, emailType, relatedPoId, existingLogId });

  let transporter;
  try {
    transporter = await getTransporter();
  } catch (err) {
    await markLogFailed(logId, 0, err);
    return { logId, status: 'failed', attempts: 0 };
  }

  if (!transporter) {
    await markLogFailed(logId, 0, new Error('SMTP not configured'));
    return { logId, status: 'failed', attempts: 0 };
  }

  const settings = await vendorSettingsService.getSettings();
  const fromAddr = settings.smtp_username; // sender = SMTP account
  const fromHeader = settings.from_display_name
    ? `"${settings.from_display_name}" <${fromAddr}>`
    : fromAddr;
  const replyTo = settings.reply_to_email || undefined;

  const mailOptions = {
    from: fromHeader,
    to,
    subject,
    html,
    text,
    attachments,
    replyTo
  };

  let attempts = 0;
  let lastError = null;
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i += 1) {
    attempts += 1;
    try {
      await transporter.sendMail(mailOptions);
      await markLogSent(logId, attempts);
      return { logId, status: 'sent', attempts };
    } catch (err) {
      lastError = err;
      // Last attempt — don't sleep, fall through to mark failed
      if (i < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[i]);
      }
    }
  }

  await markLogFailed(logId, attempts, lastError);
  return { logId, status: 'failed', attempts };
}

/**
 * Re-attempt a previously-failed email. The caller (Story 26) is responsible
 * for re-constructing the body from the related_po_id; this function only
 * exposes the interface — the implementation looks up the original log row
 * and is intentionally limited to PO emails for v1.
 */
async function retry(logId) {
  // v1 implementation deferred to Story 26 — surface as not-implemented for now.
  // Interface frozen so the email log UI can be built against it.
  const err = new Error('emailService.retry() will be implemented in Story 26');
  err.code = 'NOT_IMPLEMENTED';
  err.logId = logId;
  throw err;
}

module.exports = { sendMail, retry, invalidateTransporter };
