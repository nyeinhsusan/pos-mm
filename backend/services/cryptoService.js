const crypto = require('crypto');

/**
 * Symmetric encryption for at-rest secrets (e.g. SMTP password).
 * Uses AES-256-GCM with a key from process.env.SMTP_ENCRYPTION_KEY.
 *
 * Output buffer layout: [IV (12 bytes) || authTag (16 bytes) || ciphertext]
 * Key must be 32 bytes (64 hex chars). Generate with: openssl rand -hex 32
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function getKey() {
  const hex = process.env.SMTP_ENCRYPTION_KEY;
  if (!hex || typeof hex !== 'string') {
    const err = new Error('SMTP_ENCRYPTION_KEY is not set in env');
    err.code = 'SMTP_KEY_MISSING';
    throw err;
  }
  if (hex.length !== KEY_LEN * 2) {
    const err = new Error(
      `SMTP_ENCRYPTION_KEY must be ${KEY_LEN} bytes (${KEY_LEN * 2} hex chars); got ${hex.length}`
    );
    err.code = 'SMTP_KEY_INVALID_LENGTH';
    throw err;
  }
  let key;
  try {
    key = Buffer.from(hex, 'hex');
  } catch {
    const err = new Error('SMTP_ENCRYPTION_KEY is not valid hex');
    err.code = 'SMTP_KEY_INVALID_HEX';
    throw err;
  }
  if (key.length !== KEY_LEN) {
    const err = new Error('SMTP_ENCRYPTION_KEY decoded to wrong length');
    err.code = 'SMTP_KEY_INVALID_LENGTH';
    throw err;
  }
  return key;
}

/**
 * Encrypt a UTF-8 string. Returns a Buffer ready for VARBINARY storage.
 */
function encrypt(plaintext) {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encrypt() expects a string');
  }
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

/**
 * Decrypt a Buffer produced by encrypt(). Returns the original UTF-8 string.
 * Throws if the buffer is too short or authentication fails.
 */
function decrypt(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('decrypt() expects a Buffer');
  }
  if (buffer.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('encrypted buffer is too short');
  }
  const key = getKey();
  const iv = buffer.subarray(0, IV_LEN);
  const tag = buffer.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buffer.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/**
 * @returns {boolean} true if SMTP_ENCRYPTION_KEY is set and valid
 */
function isKeyConfigured() {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

module.exports = { encrypt, decrypt, isKeyConfigured };
