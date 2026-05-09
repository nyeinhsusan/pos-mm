import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import purchaseOrderService from '../services/purchaseOrderService';
import notify from '../services/notificationService';
import Sidebar from '../components/Sidebar';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' }
];

const STATUS_BADGE = {
  draft: 'bg-section text-muted',
  sent: 'bg-blue-500/20 text-blue-400',
  partially_received: 'bg-amber-500/20 text-amber-400',
  received: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400'
};

const STATUS_LABEL = {
  draft: 'Draft',
  sent: 'Sent',
  partially_received: 'Partially Received',
  received: 'Received',
  cancelled: 'Cancelled'
};

const formatMmk = (value) => {
  const n = Number(value || 0);
  return `${Math.round(n).toLocaleString('en-US')} MMK`;
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

const PurchaseOrdersPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all');

  // Defense in depth: API also rejects non-owner with 403, but redirect for cleaner UX
  useEffect(() => {
    if (user && user.role !== 'owner') {
      notify.error('Access denied. Owner role required.');
      navigate('/pos');
    }
  }, [user, navigate]);

  const fetchPurchaseOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      const res = await purchaseOrderService.listPurchaseOrders(params);
      if (res.success) {
        setPurchaseOrders(res.data);
      }
    } catch (err) {
      console.error('Fetch purchase orders error:', err);
      const msg = err.response?.data?.error?.message || 'Failed to load purchase orders';
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (user?.role === 'owner') fetchPurchaseOrders();
  }, [user, fetchPurchaseOrders]);

  // Sync filterStatus to URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filterStatus === 'all') {
      next.delete('status');
    } else {
      next.set('status', filterStatus);
    }
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const visiblePOs = purchaseOrders.filter((po) => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return (
      po.po_number?.toLowerCase().includes(t) ||
      po.vendor_name?.toLowerCase().includes(t)
    );
  });

  return (
    <div className="min-h-screen bg-base text-primary flex">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      <main className="flex-1 ml-0 md:ml-28 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <ShoppingBag size={32} className="text-indigo-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Purchase Orders</h1>
              <p className="text-sm text-muted">Create, send and track orders to your vendors</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/purchase-orders/new')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors font-semibold shadow-lg shadow-indigo-500/20"
          >
            <Plus size={20} />
            New Purchase Order
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by PO # or vendor name..."
              className="w-full bg-elevated border border-default rounded-xl pl-10 pr-4 py-2.5 text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilterStatus(opt.value)}
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

        {/* List */}
        {loading ? (
          <div className="grid gap-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-elevated rounded-xl h-20 animate-pulse"
              />
            ))}
          </div>
        ) : visiblePOs.length === 0 ? (
          <div className="bg-elevated rounded-2xl p-10 text-center">
            <ShoppingBag size={48} className="mx-auto text-muted mb-3" />
            <h3 className="text-lg font-semibold mb-1">
              {searchTerm || filterStatus !== 'all'
                ? 'No purchase orders match these filters'
                : 'No purchase orders yet'}
            </h3>
            <p className="text-sm text-muted mb-4">
              {searchTerm || filterStatus !== 'all'
                ? 'Try clearing filters or creating a new one.'
                : 'Create your first PO to start tracking what you order from vendors.'}
            </p>
            <button
              onClick={() => navigate('/purchase-orders/new')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
            >
              <Plus size={16} />
              New Purchase Order
            </button>
          </div>
        ) : (
          <div className="bg-elevated rounded-2xl overflow-hidden border border-default">
            <table className="w-full">
              <thead className="bg-section border-b border-default text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="text-left p-3">PO #</th>
                  <th className="text-left p-3">Vendor</th>
                  <th className="text-left p-3">Created</th>
                  <th className="text-right p-3">Items</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {visiblePOs.map((po, idx) => (
                  <motion.tr
                    key={po.po_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => navigate(`/purchase-orders/${po.po_id}`)}
                    className="border-b border-default last:border-b-0 cursor-pointer hover:bg-section transition-colors"
                  >
                    <td className="p-3 font-mono text-sm font-semibold">{po.po_number}</td>
                    <td className="p-3">
                      <div className="font-medium">{po.vendor_name}</div>
                      {po.source === 'auto_ml' && (
                        <span className="text-[10px] text-amber-400 uppercase tracking-wider">Auto</span>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted">{formatDate(po.created_at)}</td>
                    <td className="p-3 text-right text-sm">{po.item_count}</td>
                    <td className="p-3 text-right text-sm font-semibold">{formatMmk(po.total)}</td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold ${
                          STATUS_BADGE[po.status] || 'bg-section text-muted'
                        }`}
                      >
                        {STATUS_LABEL[po.status] || po.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default PurchaseOrdersPage;
