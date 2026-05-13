import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Receipt,
  Search,
  CheckCircle2,
  Edit2,
  FileText,
  AlertTriangle,
  Clock,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import vendorInvoiceService from '../services/vendorInvoiceService';
import vendorService from '../services/vendorService';
import notify from '../services/notificationService';
import Sidebar from '../components/Sidebar';
import MarkInvoicePaidModal from '../components/MarkInvoicePaidModal';
import VendorInvoiceCaptureModal from '../components/VendorInvoiceCaptureModal';

const STATUS_BADGE = {
  unpaid: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  paid: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  overdue: 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
};

const STATUS_LABEL = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  overdue: 'Overdue'
};

const fmtMmk = (v) => Number(v || 0).toLocaleString();

const VendorInvoicesPage = () => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();

  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters (read from URL)
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterVendorId, setFilterVendorId] = useState(searchParams.get('vendor_id') || '');
  const [filterDateFrom, setFilterDateFrom] = useState(searchParams.get('date_from') || '');
  const [filterDateTo, setFilterDateTo] = useState(searchParams.get('date_to') || '');
  const [filterDueFrom, setFilterDueFrom] = useState(searchParams.get('due_from') || '');
  const [filterDueTo, setFilterDueTo] = useState(searchParams.get('due_to') || '');
  const [filterQ, setFilterQ] = useState(searchParams.get('q') || '');

  // Sort
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'invoice_date');
  const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'DESC');

  // Pagination
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const pageSize = 50;

  // Modals
  const [paidTarget, setPaidTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);

  // RBAC defense
  useEffect(() => {
    if (user && user.role !== 'owner') {
      notify.error('Access denied. Owner role required.');
      navigate('/pos');
    }
  }, [user, navigate]);

  // Vendors for filter dropdown
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await vendorService.listVendors({});
        if (alive && res.success) setVendors(res.data || []);
      } catch (err) {
        console.error('Failed to load vendors', err);
      }
    })();
    return () => { alive = false; };
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        status: filterStatus || undefined,
        vendor_id: filterVendorId || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        due_from: filterDueFrom || undefined,
        due_to: filterDueTo || undefined,
        q: filterQ || undefined,
        sortBy,
        sortDir,
        page,
        pageSize
      };
      const res = await vendorInvoiceService.listInvoices(params);
      if (res.success) {
        setInvoices(res.data || []);
        setTotal(res.total || 0);
      }
    } catch (err) {
      notify.error(err.response?.data?.error?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterVendorId, filterDateFrom, filterDateTo, filterDueFrom, filterDueTo, filterQ, sortBy, sortDir, page]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await vendorInvoiceService.getSummary();
      if (res.success) setSummary(res.data);
    } catch (err) {
      console.error('Failed to load summary', err);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'owner') {
      fetchInvoices();
      fetchSummary();
    }
  }, [user, fetchInvoices, fetchSummary]);

  // URL sync
  useEffect(() => {
    const next = new URLSearchParams();
    if (filterStatus) next.set('status', filterStatus);
    if (filterVendorId) next.set('vendor_id', filterVendorId);
    if (filterDateFrom) next.set('date_from', filterDateFrom);
    if (filterDateTo) next.set('date_to', filterDateTo);
    if (filterDueFrom) next.set('due_from', filterDueFrom);
    if (filterDueTo) next.set('due_to', filterDueTo);
    if (filterQ) next.set('q', filterQ);
    if (sortBy && sortBy !== 'invoice_date') next.set('sortBy', sortBy);
    if (sortDir && sortDir !== 'DESC') next.set('sortDir', sortDir);
    if (page !== 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterVendorId, filterDateFrom, filterDateTo, filterDueFrom, filterDueTo, filterQ, sortBy, sortDir, page]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'DESC' ? 'ASC' : 'DESC'));
    } else {
      setSortBy(col);
      setSortDir('DESC');
    }
  };

  const SortHeader = ({ col, children, alignRight }) => (
    <th
      onClick={() => handleSort(col)}
      className={`py-3 px-3 cursor-pointer select-none hover:text-primary ${alignRight ? 'text-right' : 'text-left'}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortBy === col && (sortDir === 'ASC' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  );

  const clearFilters = () => {
    setFilterStatus('');
    setFilterVendorId('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterDueFrom('');
    setFilterDueTo('');
    setFilterQ('');
    setPage(1);
  };

  const hasFilters = filterStatus || filterVendorId || filterDateFrom || filterDateTo || filterDueFrom || filterDueTo || filterQ;

  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  const kpiCards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        key: 'unpaid',
        label: 'Unpaid',
        count: summary.unpaid_count,
        amount: summary.total_unpaid_amount,
        icon: Clock,
        color: 'amber'
      },
      {
        key: 'overdue',
        label: 'Overdue',
        count: summary.overdue_count,
        amount: summary.total_overdue_amount,
        icon: AlertTriangle,
        color: 'rose'
      },
      {
        key: 'paid',
        label: 'Paid (last 30 days)',
        count: summary.paid_last_30_days_count,
        amount: null,
        icon: CheckCircle2,
        color: 'emerald'
      },
      {
        key: '',
        label: 'All Invoices',
        count: summary.total_count,
        amount: null,
        icon: Receipt,
        color: 'indigo'
      }
    ];
  }, [summary]);

  return (
    <div className="min-h-screen bg-page transition-colors">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      <main className="ml-0 md:ml-20 lg:ml-28 px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
              <Receipt size={28} /> Invoices
            </h1>
            <p className="text-sm text-muted mt-1">Track what's owed and what's been paid.</p>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            const active = filterStatus === card.key;
            return (
              <button
                key={card.key || 'all'}
                onClick={() => { setFilterStatus(card.key); setPage(1); }}
                className={`text-left bg-surface border ${active ? 'border-indigo-500' : 'border-default'} rounded-2xl pt-6 pr-6 pb-5 pl-5 transition-all hover:border-indigo-500/60`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider text-muted">{card.label}</span>
                  <Icon size={16} className={`text-${card.color}-500`} />
                </div>
                <div className="text-2xl font-bold text-primary">{card.count ?? '—'}</div>
                {card.amount != null && (
                  <div className="text-xs text-muted mt-1">{fmtMmk(card.amount)} MMK</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-surface border border-default rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                className="w-full bg-section border border-default rounded-xl px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All</option>
                <option value="unpaid">Unpaid</option>
                <option value="overdue">Overdue</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Vendor</label>
              <select
                value={filterVendorId}
                onChange={(e) => { setFilterVendorId(e.target.value); setPage(1); }}
                className="w-full bg-section border border-default rounded-xl px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All vendors</option>
                {vendors.map((v) => (
                  <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Invoice date from</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
                className="w-full bg-section border border-default rounded-xl px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Invoice date to</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
                className="w-full bg-section border border-default rounded-xl px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Due from</label>
              <input
                type="date"
                value={filterDueFrom}
                onChange={(e) => { setFilterDueFrom(e.target.value); setPage(1); }}
                className="w-full bg-section border border-default rounded-xl px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Due to</label>
              <input
                type="date"
                value={filterDueTo}
                onChange={(e) => { setFilterDueTo(e.target.value); setPage(1); }}
                className="w-full bg-section border border-default rounded-xl px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={filterQ}
                  onChange={(e) => { setFilterQ(e.target.value); setPage(1); }}
                  placeholder="Invoice #, notes, payment reference…"
                  className="w-full bg-section border border-default rounded-xl pl-10 pr-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
          {hasFilters && (
            <div className="mt-3 flex items-center justify-end">
              <button
                onClick={clearFilters}
                className="text-xs text-muted hover:text-primary flex items-center gap-1"
              >
                <X size={12} /> Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-surface border border-default rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted border-b border-default">
                  <SortHeader col="invoice_number">Invoice #</SortHeader>
                  <SortHeader col="vendor_name">Vendor</SortHeader>
                  <SortHeader col="invoice_date">Invoice date</SortHeader>
                  <SortHeader col="due_date">Due date</SortHeader>
                  <SortHeader col="total" alignRight>Amount</SortHeader>
                  <th className="py-3 px-3 text-left">Status</th>
                  <th className="py-3 px-3 text-left">Paid date</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="py-12 text-center text-muted">Loading…</td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-muted">
                    {hasFilters ? 'No invoices match these filters.' : 'No invoices yet.'}
                  </td></tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.invoice_id} className="border-b border-default/40 last:border-0 hover:bg-elevated/40">
                      <td className="py-3 px-3 font-semibold">{inv.invoice_number}</td>
                      <td className="py-3 px-3">
                        {inv.vendor_name || <span className="text-muted">—</span>}
                        {inv.po_number && <span className="text-xs text-muted ml-2">PO {inv.po_number}</span>}
                      </td>
                      <td className="py-3 px-3 text-muted">{inv.invoice_date?.slice(0, 10)}</td>
                      <td className="py-3 px-3 text-muted">{inv.due_date ? inv.due_date.slice(0, 10) : '—'}</td>
                      <td className="py-3 px-3 text-right font-semibold whitespace-nowrap">
                        {fmtMmk(inv.total)} <span className="text-xs text-muted">{inv.currency}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${STATUS_BADGE[inv.status]}`}>
                          {STATUS_LABEL[inv.status] || inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-muted">{inv.paid_date ? inv.paid_date.slice(0, 10) : '—'}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setViewTarget(inv)}
                            className="p-2 rounded-lg bg-section hover:bg-elevated text-primary"
                            title="View"
                          >
                            <FileText size={14} />
                          </button>
                          {(inv.status === 'unpaid' || inv.status === 'overdue') && (
                            <button
                              onClick={() => setPaidTarget(inv)}
                              className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                              title="Mark paid"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          {inv.status === 'unpaid' && (
                            <button
                              onClick={() => setEditTarget(inv)}
                              className="p-2 rounded-lg bg-section hover:bg-elevated text-primary"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-default text-xs text-muted">
            <span>Showing {showingFrom}–{showingTo} of {total}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-section hover:bg-elevated disabled:opacity-40"
              >
                Prev
              </button>
              <span>Page {page} / {lastPage}</span>
              <button
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-section hover:bg-elevated disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Mark paid modal */}
      <MarkInvoicePaidModal
        isOpen={!!paidTarget}
        invoice={paidTarget}
        onClose={() => setPaidTarget(null)}
        onSaved={() => { setPaidTarget(null); fetchInvoices(); fetchSummary(); }}
      />

      {/* Edit modal (reuses capture modal — note: capture modal currently creates only;
          for v1 we use it as a read-only / quick view here; full edit form is a v1.1 follow-up). */}
      <VendorInvoiceCaptureModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => { setEditTarget(null); fetchInvoices(); fetchSummary(); }}
        vendorId={editTarget?.vendor_id}
        poId={editTarget?.po_id}
        vendorName={editTarget?.vendor_name}
        poNumber={editTarget?.po_number}
      />

      {/* View drawer */}
      {viewTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setViewTarget(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-default rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-default">
              <h2 className="text-lg font-bold text-primary">Invoice {viewTarget.invoice_number}</h2>
              <button onClick={() => setViewTarget(null)} className="p-2 rounded-lg hover:bg-elevated">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Vendor</p>
                  <p className="font-semibold">{viewTarget.vendor_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Status</p>
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${STATUS_BADGE[viewTarget.status]}`}>
                    {STATUS_LABEL[viewTarget.status] || viewTarget.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Invoice date</p>
                  <p>{viewTarget.invoice_date?.slice(0, 10)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Due date</p>
                  <p>{viewTarget.due_date ? viewTarget.due_date.slice(0, 10) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Subtotal</p>
                  <p>{fmtMmk(viewTarget.subtotal)} {viewTarget.currency}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Tax</p>
                  <p>{fmtMmk(viewTarget.tax_amount)} {viewTarget.currency}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Total</p>
                  <p className="text-lg font-bold">{fmtMmk(viewTarget.total)} {viewTarget.currency}</p>
                </div>
                {viewTarget.paid_date && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted">Paid date</p>
                    <p>{viewTarget.paid_date.slice(0, 10)}</p>
                  </div>
                )}
                {viewTarget.payment_method && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted">Payment method</p>
                    <p>{viewTarget.payment_method.replace('_', ' ')}</p>
                  </div>
                )}
                {viewTarget.payment_reference && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted">Payment reference</p>
                    <p>{viewTarget.payment_reference}</p>
                  </div>
                )}
              </div>
              {viewTarget.po_id && (
                <div className="pt-3 border-t border-default">
                  <button
                    onClick={() => { setViewTarget(null); navigate(`/purchase-orders/${viewTarget.po_id}`); }}
                    className="text-indigo-500 hover:text-indigo-400 text-sm font-semibold"
                  >
                    View linked PO {viewTarget.po_number} →
                  </button>
                </div>
              )}
              {viewTarget.notes && (
                <div className="pt-3 border-t border-default">
                  <p className="text-xs uppercase tracking-wider text-muted mb-1">Notes</p>
                  <p className="whitespace-pre-wrap">{viewTarget.notes}</p>
                </div>
              )}
              {viewTarget.attachment_url && (
                <div className="pt-3 border-t border-default">
                  <a
                    href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5002'}${viewTarget.attachment_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-500 hover:text-indigo-400 text-sm font-semibold"
                  >
                    Download attachment →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorInvoicesPage;
