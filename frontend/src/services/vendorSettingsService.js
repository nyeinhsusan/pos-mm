import api from './api';

/**
 * Get vendor settings (SMTP, auto-reorder config, etc).
 */
export const getSettings = async () => {
  const response = await api.get('/vendor-settings');
  return response.data;
};

/**
 * Update vendor settings.
 * @param {Object} data - Partial settings object
 */
export const updateSettings = async (data) => {
  const response = await api.put('/vendor-settings', data);
  return response.data;
};

/**
 * Send a test email to verify SMTP configuration.
 * @param {string} to - Recipient email (defaults to reply_to_email)
 */
export const testEmail = async (to) => {
  const response = await api.post('/vendor-settings/test-email', { to });
  return response.data;
};

/**
 * Auto-reorder operational status (Story 32).
 */
export const autoReorderStatus = async () => {
  const response = await api.get('/auto-reorder/status');
  return response.data;
};

const vendorSettingsService = {
  getSettings,
  updateSettings,
  testEmail,
  autoReorderStatus
};

export default vendorSettingsService;