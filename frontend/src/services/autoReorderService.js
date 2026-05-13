import api from './api';

/**
 * Auto-Reorder service (Story 33).
 * Handles manual run-now, activity log, and pending approval count.
 */

/**
 * Trigger a manual auto-reorder scan.
 * @param {Object} options
 * @param {boolean} options.dryRun - If true, just scan without creating POs
 * @returns {Promise<Object>}
 */
export const runNow = async ({ dryRun = false } = {}) => {
  const response = await api.post('/auto-reorder/run-now', { dryRun });
  return response.data;
};

/**
 * Get paginated activity log.
 * @param {Object} options
 * @param {number} options.days - Days to look back (default 7, max 90)
 * @param {string} options.triggered_by - 'cron', 'manual', or 'all'
 * @param {string} options.status - Filter by status
 * @param {number} options.page - Page number (default 1)
 * @param {number} options.pageSize - Page size (default 20)
 * @param {boolean} options.includeDetails - Include heavy details_json
 * @returns {Promise<Object>}
 */
export const activity = async ({
  days = 7,
  triggered_by,
  status,
  page = 1,
  pageSize = 20,
  includeDetails = false
} = {}) => {
  const params = new URLSearchParams();
  params.append('days', days);
  if (triggered_by) params.append('triggered_by', triggered_by);
  if (status) params.append('status', status);
  params.append('page', page);
  params.append('pageSize', pageSize);
  if (includeDetails) params.append('include', 'details');

  const response = await api.get(`/auto-reorder/activity?${params.toString()}`);
  return response.data;
};

/**
 * Get count of auto-generated POs awaiting approval.
 * @returns {Promise<Object>} { success: true, data: { count: number } }
 */
export const pendingApprovalCount = async () => {
  const response = await api.get('/auto-reorder/pending-approval-count');
  return response.data;
};

const autoReorderService = {
  runNow,
  activity,
  pendingApprovalCount
};

export default autoReorderService;