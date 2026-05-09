import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, RefreshCw, X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import vendorService from '../services/vendorService';
import emailLogService from '../services/emailLogService';
import notify from '../services/notificationService';
import Sidebar from '../components/Sidebar';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' }
];

const EMAIL_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'po', label: 'PO' },
  { value: 'test', label: 'Test' },
  { value: 'manual', label: 'Manual' },
  { value: 'reminder', label: 'Reminder' }
];

const STATUS_BADGE = {
  queued: 'bg-amber-500/20 text-amber-400',
  sent: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400'
};

const STATUS_LABEL = {
  queued: 'Queued',
  sent: 'Sent',
  failed: 'Failed'
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

const EmailLogPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [logs, setLogs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterType, setFilterType] = useState(searchParams.get('email_type') || '');
  const [filterDateFrom, setFilterDateFrom] = useState(searchParams.get('date_from') || '');
  const [filterDateTo, setFilterDateTo] = useState(searchParams.get('date_to') || '');
  const [filterVendorId, setFilterVendorId] = useState(searchParams.get('vendor_id') || '');

  const [selectedLog, setSelectedLog] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [confirmRetry, setConfirmRetry] = useState(null);

  // Defense in depth
  useEffect(() => {
    if (user && user.role !== 'owner') {
      notify.error('Access denied. Owner role required.');
      navigate('/pos');
    }
  }, [user, navigate]);

  const fetchVendors = useCallback(async () => {
    try {
      const res = await vendorService.listVendors({});
      if (res.success) {
        setVendors(res.data);
      }
    } catch (err) {
      console.error('Fetch vendors error:', err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, pageSize };
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.email_type = filterType;
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;
      if (filterVendorId) params.vendor_id = filterVendorId;

      const res = await emailLogService.listEmailLogs(params);
      if (res.success) {
        setLogs(res.data);
        setTotal(res.total);
      }
    } catch (err) {
      console.error('Fetch email logs error:', err);
      const msg = err.response?.data?.error?.message || 'Failed to load email logs';
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterStatus, filterType, filterDateFrom, filterDateTo, filterVendorId]);

  useEffect(() => {
    if (user?.role === 'owner') {
      fetchVendors();
    }
  }, [user, fetchVendors]);

  useEffect(() => {
    if (user?.role === 'owner') fetchLogs();
  }, [user, fetchLogs]);

  // Sync filters to URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filterStatus) next.set('status', filterStatus); else next.delete('status');
    if (filterType) next.set('email_type', filterType); else next.delete('email_type');
    if (filterDateFrom) next.set('date_from', filterDateFrom); else next.delete('date_from');
    if (filterDateTo) next.set('date_to', filterDateTo); else next.delete('date_to');
    if (filterVendorId) next.set('vendor_id', filterVendorId); else next.delete('vendor_id');
    setSearchParams(next, { replace: true });
  }, [filterStatus, filterType, filterDateFrom, filterDateTo, filterVendorId]);

  const handleRetry = async (log) => {
    setRetryingId(log.log_id);
    try {
      const res = await emailLogService.retryEmailLog(log.log_id);
      if (res.success) {
        notify.success(`Email retry initiated for ${log.recipient_email}`);
        fetchLogs();
      }
    } catch (err) {
      console.error('Retry error:', err);
      const msg = err.response?.data?.error?.message || 'Failed to retry email';
      notify.error(msg);
    } finally {
      setRetryingId(null);
      setConfirmRetry(null);
    }
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
          <Mail size={32} className="text-indigo-400" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Email Log</h1>
            <p className="text-sm text-muted">Track emails sent to vendors, retry failed sends</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
          <div className="flex gap-2 flex-wrap">
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
          <div className="flex gap-2 flex-wrap">
            {EMAIL_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setFilterType(opt.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filterType === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-section text-muted hover:bg-elevated hover:text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
            className="bg-elevated border border-default rounded-xl px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="From date"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
            className="bg-elevated border border-default rounded-xl px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="To date"
          />
          <select
            value={filterVendorId}
            onChange={(e) => { setFilterVendorId(e.target.value); setPage(1); }}
            className="bg-elevated border border-default rounded-xl px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Vendors</option>
            {vendors.map((v) => (
              <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="grid gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-elevated rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-elevated rounded-2xl p-10 text-center">
            <Mail size={48} className="mx-auto text-muted mb-3" />
            <h3 className="text-lg font-semibold mb-1">No email logs found</h3>
            <p className="text-sm text-muted">
              {filterStatus || filterType || filterDateFrom || filterDateTo || filterVendorId
                ? 'Try clearing filters.'
                : 'Send a purchase order email to see it here.'}
            </p>
          </div>
        ) : (
          <div className="bg-elevated rounded-2xl overflow-hidden border border-default">
            <table className="w-full">
              <thead className="bg-section border-b border-default text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="text-left p-3">Timestamp</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Recipient</th>
                  <th className="text-left p-3">Subject</th>
                  <th className="text-left p-3">Related PO</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-center p-3">Attempts</th>
                  <th className="text-left p-3">Last Error</th>
                  <th className="text-center p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <motion.tr
                    key={log.log_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => setSelectedLog(log)}
                    className="border-b border-default last:border-b-0 cursor-pointer hover:bg-section transition-colors"
                  >
                    <td className="p-3 text-sm">{formatDate(log.created_at)}</td>
                    <td className="p-3 text-sm uppercase">{log.email_type}</td>
                    <td className="p-3 text-sm">{log.recipient_email}</td>
                    <td className="p-3 text-sm max-w-xs truncate">{log.subject}</td>
                    <td className="p-3 text-sm">
                      {log.related_po ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/purchase-orders/${log.related_po.po_id}`); }}
                          className="text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          {log.related_po.po_number}
                          <ExternalLink size={12} />
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold ${STATUS_BADGE[log.status] || 'bg-section text-muted'}`}>
                        {STATUS_LABEL[log.status] || log.status}
                      </span>
                    </td>
                    <td className="p-3 text-center text-sm">{log.attempts}</td>
                    <td className="p-3 text-sm max-w-xs truncate" title={log.last_error}>
                      {log.last_error || '—'}
                    </td>
                    <td className="p-3 text-center">
                      {log.status === 'failed' && log.email_type === 'po' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmRetry(log); }}
                          disabled={retryingId === log.log_id}
                          className="p-2 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors"
                          title="Retry"
                        >
                          {retryingId === log.log_id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <RefreshCw size={16} />
                          )}
                        </button>
                      )}
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

        {/* Detail Drawer */}
        <AnimatePresence>
          {selectedLog && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setSelectedLog(null)}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-base border-l border-default z-50 overflow-y-auto"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Email Details</h2>
                    <button
                      onClick={() => setSelectedLog(null)}
                      className="p-2 hover:bg-section rounded-lg"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted">Log ID</label>
                      <div className="text-sm font-mono">{selectedLog.log_id}</div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted">Timestamp</label>
                      <div className="text-sm">{formatDate(selectedLog.created_at)}</div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted">Email Type</label>
                      <div className="text-sm uppercase">{selectedLog.email_type}</div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted">Recipient</label>
                      <div className="text-sm">{selectedLog.recipient_email}</div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted">Subject</label>
                      <div className="text-sm">{selectedLog.subject}</div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted">Related PO</label>
                      <div className="text-sm">
                        {selectedLog.related_po ? (
                          <button
                            onClick={() => navigate(`/purchase-orders/${selectedLog.related_po.po_id}`)}
                            className="text-indigo-400 hover:underline"
                          >
                            {selectedLog.related_po.po_number}
                          </button>
                        ) : '—'}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted">Vendor</label>
                      <div className="text-sm">{selectedLog.vendor_name || '—'}</div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted">Status</label>
                      <div className="text-sm">
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold ${STATUS_BADGE[selectedLog.status] || 'bg-section text-muted'}`}>
                          {STATUS_LABEL[selectedLog.status] || selectedLog.status}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted">Attempts</label>
                      <div className="text-sm">{selectedLog.attempts}</div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted">Sent At</label>
                      <div className="text-sm">{formatDate(selectedLog.sent_at)}</div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted">Last Error</label>
                      <div className="text-sm text-red-400 whitespace-pre-wrap">
                        {selectedLog.last_error || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Retry Confirmation Modal */}
        <AnimatePresence>
          {confirmRetry && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setConfirmRetry(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 flex items-center justify-center z-50"
              >
                <div className="bg-base border border-default rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                  <h3 className="text-lg font-bold mb-2">Retry Email?</h3>
                  <p className="text-sm text-muted mb-6">
                    Retry sending to <span className="text-primary font-semibold">{confirmRetry.recipient_email}</span>?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmRetry(null)}
                      className="flex-1 px-4 py-2 bg-section text-muted rounded-xl hover:bg-elevated transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRetry(confirmRetry)}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default EmailLogPage;