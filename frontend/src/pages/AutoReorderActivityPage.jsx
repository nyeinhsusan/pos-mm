import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Play, X, ExternalLink, ChevronLeft, ChevronRight, AlertTriangle, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import autoReorderService from '../services/autoReorderService';
import vendorSettingsService from '../services/vendorSettingsService';
import notify from '../services/notificationService';
import Sidebar from '../components/Sidebar';

const DAYS_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' }
];

const TRIGGERED_BY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'cron', label: 'Cron' },
  { value: 'manual', label: 'Manual' }
];

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'partial_failure', label: 'Partial' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'ml_unavailable', label: 'ML Unavailable' }
];

const STATUS_BADGE = {
  success: 'bg-emerald-500/20 text-emerald-400',
  partial_failure: 'bg-amber-500/20 text-amber-400',
  disabled: 'bg-section text-muted',
  ml_unavailable: 'bg-red-500/20 text-red-400',
  running: 'bg-blue-500/20 text-blue-400'
};

const STATUS_LABEL = {
  success: 'Success',
  partial_failure: 'Partial Failure',
  disabled: 'Disabled',
  ml_unavailable: 'ML Unavailable',
  running: 'Running'
};

const formatDate = (value) => {
  if (!value) return '—';
  try {
    const d = new Date(value);
    return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(value);
  }
};

const formatRelativeTime = (value) => {
  if (!value) return 'Never';
  try {
    const d = new Date(value);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(value);
  } catch {
    return String(value);
  }
};

const AutoReorderActivityPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [settings, setSettings] = useState(null);
  const [lastRun, setLastRun] = useState(null);

  const [filterDays, setFilterDays] = useState(7);
  const [filterTriggeredBy, setFilterTriggeredBy] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [selectedRun, setSelectedRun] = useState(null);
  const [selectedRunDetails, setSelectedRunDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [showRunNowModal, setShowRunNowModal] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [runningNow, setRunningNow] = useState(false);

  // Defense in depth
  useEffect(() => {
    if (user && user.role !== 'owner') {
      notify.error('Access denied. Owner role required.');
      navigate('/pos');
    }
  }, [user, navigate]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await vendorSettingsService.getSettings();
      if (res.success) {
        setSettings(res.data);
      }
    } catch (err) {
      console.error('Fetch settings error:', err);
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, pageSize, days: filterDays };
      if (filterTriggeredBy) params.triggered_by = filterTriggeredBy;
      if (filterStatus) params.status = filterStatus;

      const res = await autoReorderService.activity(params);
      if (res.success) {
        setRuns(res.data.runs);
        setTotal(res.data.pagination.total);
        // Get last run for "Last run" indicator
        if (res.data.runs.length > 0) {
          setLastRun(res.data.runs[0]);
        }
      }
    } catch (err) {
      console.error('Fetch activity error:', err);
      const msg = err.response?.data?.error?.message || 'Failed to load activity log';
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterDays, filterTriggeredBy, filterStatus]);

  useEffect(() => {
    if (user?.role === 'owner') {
      fetchSettings();
    }
  }, [user, fetchSettings]);

  useEffect(() => {
    if (user?.role === 'owner') fetchRuns();
  }, [user, fetchRuns]);

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      const res = await autoReorderService.runNow({ dryRun });
      if (res.success) {
        if (dryRun) {
          notify.success('Dry run complete — no POs created');
        } else {
          notify.success('Auto-reorder scan completed');
        }
        setShowRunNowModal(false);
        setDryRun(false);
        fetchRuns();
      }
    } catch (err) {
      console.error('Run now error:', err);
      const msg = err.response?.data?.error?.message || 'Failed to run auto-reorder';
      if (err.response?.status === 409) {
        notify.warning(msg);
      } else {
        notify.error(msg);
      }
    } finally {
      setRunningNow(false);
    }
  };

  const fetchRunDetails = async (run) => {
    setSelectedRun(run);
    setLoadingDetails(true);
    try {
      const res = await autoReorderService.activity({
        page: 1,
        pageSize: 1,
        days: 365,
        includeDetails: true
      });
      // Find the specific run in the response
      const found = res.data?.runs?.find(r => r.run_id === run.run_id);
      setSelectedRunDetails(found || run);
    } catch (err) {
      console.error('Fetch details error:', err);
      setSelectedRunDetails(run);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getModeLabel = (mode) => {
    const labels = {
      disabled: 'Disabled',
      approve_first: 'Approve First',
      auto_send: 'Auto-Send'
    };
    return labels[mode] || mode;
  };

  const totalPages = Math.ceil(total / pageSize);
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  return (
    <div className="min-h-screen bg-base text-primary flex">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      <main className="flex-1 ml-0 md:ml-28 p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <History size={32} className="text-indigo-400" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Auto-Reorder Activity</h1>
            <p className="text-sm text-muted">View auto-reorder history and run scans on demand</p>
          </div>
        </div>

        {/* Top Bar */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          {/* Run Now Button */}
          <button
            onClick={() => setShowRunNowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors"
          >
            <Play size={18} />
            Run Now
          </button>

          {/* Mode Pill */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Mode:</span>
            <button
              onClick={() => navigate('/vendor-settings')}
              className="px-3 py-1 bg-elevated border border-default rounded-full text-sm font-medium hover:bg-section transition-colors"
            >
              {getModeLabel(settings?.auto_reorder_mode || 'disabled')}
            </button>
          </div>

          {/* Last Run */}
          <div className="flex items-center gap-2 text-sm text-muted">
            <Clock size={14} />
            <span>Last run: {formatRelativeTime(lastRun?.started_at)}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex gap-2">
            {DAYS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setFilterDays(opt.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filterDays === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-section text-muted hover:bg-elevated hover:text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {TRIGGERED_BY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setFilterTriggeredBy(opt.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filterTriggeredBy === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-section text-muted hover:bg-elevated hover:text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setFilterStatus(opt.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filterStatus === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-section text-muted hover:bg-elevated hover:text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="grid gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-elevated rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="bg-elevated rounded-2xl p-10 text-center">
            <History size={48} className="mx-auto text-muted mb-3" />
            <h3 className="text-lg font-semibold mb-1">No activity yet</h3>
            <p className="text-sm text-muted">
              Auto-reorder runs will appear here after the first cron job or manual run.
            </p>
          </div>
        ) : (
          <div className="bg-elevated rounded-2xl overflow-hidden border border-default">
            <table className="w-full">
              <thead className="bg-section border-b border-default text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="text-left p-3">Started</th>
                  <th className="text-left p-3">Triggered By</th>
                  <th className="text-left p-3">Mode</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-center p-3">Products</th>
                  <th className="text-center p-3">POs</th>
                  <th className="text-center p-3">Sent</th>
                  <th className="text-center p-3">Failures</th>
                  <th className="text-center p-3">Duration</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, idx) => (
                  <motion.tr
                    key={run.run_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => fetchRunDetails(run)}
                    className="border-b border-default last:border-b-0 cursor-pointer hover:bg-section transition-colors"
                  >
                    <td className="p-3 text-sm">{formatDate(run.started_at)}</td>
                    <td className="p-3 text-sm">
                      <span className="capitalize">{run.triggered_by}</span>
                      {run.actor_name && (
                        <span className="text-muted text-xs block">by {run.actor_name}</span>
                      )}
                    </td>
                    <td className="p-3 text-sm">{getModeLabel(run.mode)}</td>
                    <td className="p-3">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold ${STATUS_BADGE[run.status] || 'bg-section text-muted'}`}>
                        {STATUS_LABEL[run.status] || run.status}
                      </span>
                    </td>
                    <td className="p-3 text-center text-sm">{run.triggered_products_count || 0}</td>
                    <td className="p-3 text-center text-sm">{run.created_pos_count || 0}</td>
                    <td className="p-3 text-center text-sm">{run.auto_sent_count || 0}</td>
                    <td className="p-3 text-center text-sm">
                      {(run.failed_creations_count || run.auto_send_failed_count || 0) > 0 ? (
                        <span className="text-red-400">
                          {run.failed_creations_count + run.auto_send_failed_count}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-center text-sm">
                      {run.duration_ms ? `${Math.round(run.duration_ms / 1000)}s` : '—'}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mt-4 gap-3">
            <div className="text-sm text-muted">
              Showing {startIdx}–{endIdx} of {total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 bg-elevated border border-default rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-section"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 py-2 text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 bg-elevated border border-default rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-section"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Run Now Modal */}
        <AnimatePresence>
          {showRunNowModal && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setShowRunNowModal(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 flex items-center justify-center z-50"
              >
                <div className="bg-base border border-default rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Run Auto-Reorder Now?</h3>
                    <button
                      onClick={() => setShowRunNowModal(false)}
                      className="p-2 hover:bg-section rounded-lg"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <p className="text-sm text-muted mb-4">
                    Mode: <span className="text-primary font-medium">{getModeLabel(settings?.auto_reorder_mode)}</span>
                  </p>
                  <p className="text-sm text-muted mb-4">
                    {settings?.auto_reorder_mode === 'auto_send'
                      ? 'This will create draft POs and may email vendors immediately.'
                      : settings?.auto_reorder_mode === 'approve_first'
                      ? 'This will create draft POs awaiting your approval.'
                      : 'Auto-reorder is currently disabled.'}
                  </p>

                  <label className="flex items-center gap-2 mb-6 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dryRun}
                      onChange={(e) => setDryRun(e.target.checked)}
                      className="w-4 h-4 rounded border-default bg-elevated text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm">Dry run (don't create POs or send emails)</span>
                  </label>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowRunNowModal(false)}
                      className="flex-1 px-4 py-2 bg-section text-muted rounded-xl hover:bg-elevated transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRunNow}
                      disabled={runningNow || settings?.auto_reorder_mode === 'disabled'}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {runningNow ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          Running...
                        </>
                      ) : (
                        'Run'
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Detail Drawer */}
        <AnimatePresence>
          {selectedRun && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setSelectedRun(null)}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25 }}
                className="fixed right-0 top-0 h-full w-full max-w-lg bg-base border-l border-default z-50 overflow-y-auto"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Run Details</h2>
                    <button
                      onClick={() => setSelectedRun(null)}
                      className="p-2 hover:bg-section rounded-lg"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {loadingDetails ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader size={32} className="animate-spin text-indigo-400" />
                    </div>
                  ) : selectedRunDetails?.details_json ? (
                    <RunDetailsContent run={selectedRunDetails} />
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs uppercase tracking-wider text-muted">Run ID</label>
                        <div className="text-sm font-mono">{selectedRun.run_id}</div>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider text-muted">Started</label>
                        <div className="text-sm">{formatDate(selectedRun.started_at)}</div>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider text-muted">Finished</label>
                        <div className="text-sm">{formatDate(selectedRun.finished_at)}</div>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider text-muted">Mode</label>
                        <div className="text-sm">{getModeLabel(selectedRun.mode)}</div>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider text-muted">Status</label>
                        <div className="text-sm">
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold ${STATUS_BADGE[selectedRun.status] || 'bg-section text-muted'}`}>
                            {STATUS_LABEL[selectedRun.status] || selectedRun.status}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider text-muted">Triggered By</label>
                        <div className="text-sm capitalize">{selectedRun.triggered_by}</div>
                      </div>
                      {selectedRun.actor_name && (
                        <div>
                          <label className="text-xs uppercase tracking-wider text-muted">Actor</label>
                          <div className="text-sm">{selectedRun.actor_name}</div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs uppercase tracking-wider text-muted">Products</label>
                          <div className="text-sm">{selectedRun.triggered_products_count || 0}</div>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wider text-muted">POs Created</label>
                          <div className="text-sm">{selectedRun.created_pos_count || 0}</div>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wider text-muted">Auto-Sent</label>
                          <div className="text-sm">{selectedRun.auto_sent_count || 0}</div>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wider text-muted">Failures</label>
                          <div className="text-sm">{(selectedRun.failed_creations_count || 0) + (selectedRun.auto_send_failed_count || 0)}</div>
                        </div>
                      </div>
                      {selectedRun.error_message && (
                        <div>
                          <label className="text-xs uppercase tracking-wider text-muted">Error</label>
                          <div className="text-sm text-red-400">{selectedRun.error_message}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

// Component to render detailed JSON content
const RunDetailsContent = ({ run }) => {
  const details = run.details_json;

  if (!details) {
    return (
      <div className="text-center text-muted py-10">
        No detailed information available.
      </div>
    );
  }

  // Check for skipped runs
  if (details.skipped) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertTriangle size={20} className="text-amber-400" />
          <span className="text-amber-400 font-medium">Run Skipped</span>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted">Reason</label>
          <div className="text-sm">{details.reason || 'Unknown'}</div>
        </div>
        {details.error_message && (
          <div>
            <label className="text-xs uppercase tracking-wider text-muted">Error</label>
            <div className="text-sm text-red-400">{details.error_message}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-section rounded-xl p-3">
          <div className="text-xs text-muted uppercase">Products</div>
          <div className="text-2xl font-bold">{details.triggered_products || 0}</div>
        </div>
        <div className="bg-section rounded-xl p-3">
          <div className="text-xs text-muted uppercase">Vendors</div>
          <div className="text-2xl font-bold">{details.buckets_count || 0}</div>
        </div>
      </div>

      {/* Vendor Buckets */}
      {details.vendor_buckets && details.vendor_buckets.length > 0 && (
        <div>
          <label className="text-xs uppercase tracking-wider text-muted mb-2 block">Vendor Buckets</label>
          <div className="space-y-3">
            {details.vendor_buckets.map((bucket, idx) => (
              <div key={idx} className="bg-section rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{bucket.vendor_name}</span>
                  <span className="text-xs text-muted">{bucket.products?.length || 0} products</span>
                </div>
                {bucket.products && bucket.products.length > 0 && (
                  <table className="w-full text-xs">
                    <thead className="text-muted border-b border-default">
                      <tr>
                        <th className="text-left py-1">Product</th>
                        <th className="text-right py-1">Qty</th>
                        <th className="text-right py-1">Conf.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bucket.products.map((p, pidx) => (
                        <tr key={pidx} className="border-b border-default/50 last:border-0">
                          <td className="py-1">
                            {p.product_name || `Product ${p.product_id}`}
                            {p.low_confidence && (
                              <span className="ml-1 text-amber-400" title="Low confidence prediction">
                                <AlertTriangle size={10} />
                              </span>
                            )}
                          </td>
                          <td className="text-right">{p.default_reorder_qty}</td>
                          <td className="text-right">
                            {p.confidence != null ? (
                              <span className={p.confidence < 0.6 ? 'text-amber-400' : 'text-emerald-400'}>
                                {(p.confidence * 100).toFixed(0)}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Created POs */}
      {details.created_pos && details.created_pos.length > 0 && (
        <div>
          <label className="text-xs uppercase tracking-wider text-muted mb-2 block">Created Purchase Orders</label>
          <div className="space-y-2">
            {details.created_pos.map((po, idx) => (
              <div key={idx} className="bg-section rounded-xl p-3 flex items-center justify-between">
                <span className="font-medium">{po.po_number}</span>
                <span className="text-xs text-muted">{po.vendor_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {(details.failed_creations?.length > 0 || details.auto_sent_results?.filter(r => r.status !== 'sent').length > 0) && (
        <div>
          <label className="text-xs uppercase tracking-wider text-red-400 mb-2 block">Errors</label>
          <div className="space-y-2">
            {details.failed_creations?.map((f, idx) => (
              <div key={idx} className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm">
                <span className="text-red-400">{f.vendor_name}: </span>
                <span className="text-muted">{f.error_message}</span>
              </div>
            ))}
            {details.auto_sent_results?.filter(r => r.status !== 'sent').map((f, idx) => (
              <div key={idx} className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm">
                <span className="text-red-400">PO {f.po_id}: </span>
                <span className="text-muted">{f.last_error || 'Auto-send failed'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoReorderActivityPage;