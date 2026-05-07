import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import vendorService from '../services/vendorService';
import notify from '../services/notificationService';
import Sidebar from '../components/Sidebar';
import VendorFormModal from '../components/VendorFormModal';
import VendorDetailDrawer from '../components/VendorDetailDrawer';

const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
  const base = apiBase.replace('/api', '');
  return `${base}${path}`;
};

const VendorsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, archived

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);

  const [showDetail, setShowDetail] = useState(false);
  const [detailVendor, setDetailVendor] = useState(null);

  // Defense in depth: API will also reject Cashier with 403, but redirect for cleaner UX
  useEffect(() => {
    if (user && user.role !== 'owner') {
      notify.error('Access denied. Owner role required.');
      navigate('/pos');
    }
  }, [user, navigate]);

  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      const res = await vendorService.listVendors(params);
      if (res.success) {
        setVendors(res.data);
      }
    } catch (err) {
      console.error('Fetch vendors error:', err);
      const msg = err.response?.data?.error?.message || 'Failed to load vendors';
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (user?.role === 'owner') fetchVendors();
  }, [user, fetchVendors]);

  // Deep-link: /vendors?open=<vendor_id> auto-opens that vendor's drawer
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || vendors.length === 0) return;
    const target = vendors.find((v) => String(v.vendor_id) === String(openId));
    if (target) {
      setDetailVendor(target);
      setShowDetail(true);
      // Clean the param so reopening on refresh isn't sticky
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, vendors, setSearchParams]);

  // Search is client-side over the already-filtered list
  const visibleVendors = vendors.filter((v) => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return (
      v.name?.toLowerCase().includes(t) ||
      v.email?.toLowerCase().includes(t) ||
      v.contact_name?.toLowerCase().includes(t)
    );
  });

  const openCreate = () => {
    setEditingVendor(null);
    setShowFormModal(true);
  };

  const openEdit = (vendor) => {
    setShowDetail(false);
    setEditingVendor(vendor);
    setShowFormModal(true);
  };

  const openDetail = (vendor) => {
    setDetailVendor(vendor);
    setShowDetail(true);
  };

  const closeDetail = () => {
    setShowDetail(false);
    setDetailVendor(null);
  };

  const handleSaved = (savedVendor) => {
    setShowFormModal(false);
    setEditingVendor(null);
    // Refresh list and update detail view if open
    fetchVendors();
    if (detailVendor && savedVendor.vendor_id === detailVendor.vendor_id) {
      setDetailVendor(savedVendor);
    }
  };

  const handleArchive = async (vendor) => {
    if (!window.confirm(`Archive "${vendor.name}"? They won't appear in the active list.`)) return;
    try {
      await vendorService.archiveVendor(vendor.vendor_id);
      notify.success(`${vendor.name} archived`);
      closeDetail();
      fetchVendors();
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to archive vendor';
      notify.error(msg);
    }
  };

  const handleRestore = async (vendor) => {
    try {
      await vendorService.restoreVendor(vendor.vendor_id);
      notify.success(`${vendor.name} restored`);
      closeDetail();
      fetchVendors();
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to restore vendor';
      notify.error(msg);
    }
  };

  const handleDelete = async (vendor) => {
    if (!window.confirm(`Permanently delete "${vendor.name}"? This cannot be undone.`)) return;
    try {
      await vendorService.deleteVendor(vendor.vendor_id);
      notify.success(`${vendor.name} deleted`);
      closeDetail();
      fetchVendors();
    } catch (err) {
      // Server-side: if vendor has open POs, returns 409 with code 'HAS_OPEN_POS'
      const msg = err.response?.data?.error?.message || 'Failed to delete vendor';
      notify.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-page transition-colors">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      <main className="ml-0 md:ml-20 lg:ml-28 px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-elevated border border-default flex items-center justify-center text-primary">
              <Truck size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-primary">Vendors</h1>
              <p className="text-xs text-muted">Manage suppliers and product catalogs</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-btn-primary-bg text-btn-primary-text hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent rounded-full font-medium shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus size={16} /> New Vendor
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Search by name, email, or contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-default rounded-lg bg-surface text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'active', 'archived'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all border focus:outline-none focus:ring-2 focus:ring-accent ${
                  filterStatus === s
                    ? 'bg-btn-primary-bg text-btn-primary-text border-transparent'
                    : 'bg-surface border-default text-muted hover:bg-elevated hover:text-primary'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-surface border border-default rounded-2xl p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent mx-auto mb-3"></div>
            <p className="text-muted text-sm">Loading vendors...</p>
          </div>
        ) : visibleVendors.length === 0 ? (
          <div className="bg-surface border border-default rounded-2xl p-12 text-center">
            <p className="text-muted text-base">
              {searchTerm
                ? 'No vendors match your search'
                : filterStatus === 'archived'
                ? 'No archived vendors'
                : 'No vendors yet'}
            </p>
            {!searchTerm && filterStatus !== 'archived' && (
              <button
                onClick={openCreate}
                className="mt-4 px-5 py-2 bg-btn-primary-bg text-btn-primary-text hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent rounded-full font-medium transition-all"
              >
                + Create your first vendor
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {visibleVendors.map((v) => (
                <motion.button
                  type="button"
                  key={v.vendor_id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => openDetail(v)}
                  className="group bg-surface border border-default rounded-2xl p-5 text-left hover:border-accent hover:bg-section transition-all focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-section border border-default overflow-hidden flex items-center justify-center flex-none">
                      {v.logo_url ? (
                        <img
                          src={getImageUrl(v.logo_url)}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Truck size={20} className="text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-primary truncate">{v.name}</h3>
                      <p className="text-xs text-muted truncate">{v.email}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        v.status === 'archived'
                          ? 'bg-slate-500/20 text-slate-700 dark:text-slate-400 border border-slate-500/30'
                          : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {v.status}
                    </span>
                    <span className="px-2 py-0.5 bg-section border border-default rounded-full text-[9px] font-black uppercase tracking-widest text-primary">
                      {v.payment_terms?.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 bg-section border border-default rounded-full text-[9px] font-black uppercase tracking-widest text-primary">
                      {v.lead_time_days}d
                    </span>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Summary */}
        {!loading && vendors.length > 0 && (
          <div className="mt-6 text-xs text-muted">
            Showing {visibleVendors.length} of {vendors.length} vendors
          </div>
        )}
      </main>

      {/* Modals */}
      <VendorFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingVendor(null);
        }}
        onSaved={handleSaved}
        vendor={editingVendor}
      />

      <VendorDetailDrawer
        isOpen={showDetail}
        onClose={closeDetail}
        vendor={detailVendor}
        onEdit={openEdit}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default VendorsPage;
