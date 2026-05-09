import api from './api';

/**
 * List email logs with optional filters and pagination.
 * @param {Object} params - { status?, email_type?, date_from?, date_to?, vendor_id?, page?, pageSize? }
 */
export const listEmailLogs = async (params = {}) => {
  const response = await api.get('/email-log', { params });
  return response.data;
};

/**
 * Retry a failed email log.
 * @param {number} id - log ID to retry
 */
export const retryEmailLog = async (id) => {
  const response = await api.post(`/email-log/${id}/retry`);
  return response.data;
};

const emailLogService = {
  listEmailLogs,
  retryEmailLog
};

export default emailLogService;