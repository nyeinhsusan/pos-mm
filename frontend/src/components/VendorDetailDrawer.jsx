import { useEffect, useState, useCallback } from 'react';
import { X, Edit2, Archive, ArchiveRestore, Trash2, Plus, Star, Trash } from 'lucide-react';
import vendorService from '../services/vendorService';
import notify from '../services/notificationService';
import LinkProductModal from './LinkProductModal';

const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
  const base = apiBase.replace('/api', '');
  return `${base}${path}`;
};

const Field = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">{label}</p>
    <p className="text-sm text-primary break-words">{value || <span className="text-muted">—</span>}</p>
  </div>
);

const VendorDetailDrawer = ({ isOpen, onClose, vendor, onEdit, onArchive, onRestore, onDelete }) => {
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editForm, setEditForm] = useState({ vendor_cost_price: '', default_reorder_qty: '', min_order_qty: '' });

  const fetchCatalog = useCallback(async () => {
    if (!vendor?.vendor_id) return;
    setLoadingCatalog(true);
    try {
      const res = await vendorService.getVendorProducts(vendor.vendor_id);
      if (res.success) setCatalog(res.data || []);
    } catch (err) {
      console.error('Load catalog error:', err);
      notify.error('Failed to load vendor catalog');
    } finally {
      setLoadingCatalog(false);
    }
  }, [vendor?.vendor_id]);

  useEffect(() => {
    if (isOpen && vendor?.vendor_id) {
      fetchCatalog();
    } else {
      setCatalog([]);
      setEditingRowId(null);
    }
  }, [isOpen, vendor?.vendor_id, fetchCatalog]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !vendor) return null;

  const isArchived = vendor.status === 'archived';

  const startEdit = (row) => {
    setEditingRowId(row.vendor_product_id);
    setEditForm({
      vendor_cost_price: row.vendor_cost_price,
      default_reorder_qty: row.default_reorder_qty,
      min_order_qty: row.min_order_qty
    });
  };

  const cancelEdit = () => {
    setEditingRowId(null);
  };

  const saveEdit = async (rowId) => {
    const cost = Number(editForm.vendor_cost_price);
    const dq = Number(editForm.default_reorder_qty);
    const mq = Number(editForm.min_order_qty);
    if (!Number.isFinite(cost) || cost < 0) return notify.error('Cost must be ≥ 0');
    if (!Number.isInteger(dq) || dq < 1) return notify.error('Default qty must be ≥ 1');
    if (!Number.isInteger(mq) || mq < 1) return notify.error('Min qty must be ≥ 1');
    try {
      await vendorService.updateVendorProduct(rowId, {
        vendor_cost_price: cost,
        default_reorder_qty: dq,
        min_order_qty: mq
      });
      notify.success('Updated');
      setEditingRowId(null);
      fetchCatalog();
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to update';
      notify.error(msg);
    }
  };

  const handleSetPreferred = async (row) => {
    try {
      await vendorService.setPreferredVendorProduct(row.vendor_product_id);
      notify.success(`${row.product_name} is now preferred from ${vendor.name}`);
      fetchCatalog();
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to set preferred';
      notify.error(msg);
    }
  };

  const handleUnlink = async (row) => {
    if (!window.confirm(`Unlink "${row.product_name}" from this vendor?`)) return;
    try {
      await vendorService.unlinkVendorProduct(row.vendor_product_id);
      notify.success('Unlinked');
      fetchCatalog();
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to unlink';
      notify.error(msg);
    }
  };

  const linkedProductIds = catalog.map((r) => r.product_id);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4 fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-elevated border border-default rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto fade-in-up">
        {/* Header */}
        <div className="sticky top-0 bg-elevated border-b border-default px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-primary">Vendor details</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary transition-colors p-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Identity row */}
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-2xl bg-section border border-default overflow-hidden flex items-center justify-center flex-none">
              {vendor.logo_url ? (
                <img
                  src={getImageUrl(vendor.logo_url)}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-[9px] text-muted uppercase tracking-widest">No Logo</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-black text-primary truncate">{vendor.name}</h3>
              <p className="text-sm text-muted break-all">{vendor.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isArchived
                      ? 'bg-slate-500/20 text-slate-700 dark:text-slate-400 border border-slate-500/30'
                      : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {vendor.status}
                </span>
                <span className="px-2 py-0.5 bg-section border border-default rounded-full text-[10px] font-black uppercase tracking-wider text-primary">
                  {vendor.payment_terms?.replace('_', ' ')}
                </span>
                <span className="px-2 py-0.5 bg-section border border-default rounded-full text-[10px] font-black uppercase tracking-wider text-primary">
                  {vendor.lead_time_days}d lead
                </span>
              </div>
            </div>
          </div>

          {/* Fields grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <Field label="Contact name" value={vendor.contact_name} />
            <Field label="Phone" value={vendor.phone} />
            <Field label="Currency" value={vendor.currency} />
            <Field label="Lead time" value={`${vendor.lead_time_days} days`} />
            <div className="sm:col-span-2">
              <Field label="Address" value={vendor.address} />
            </div>
            <div className="sm:col-span-2">
              <Field label="Notes" value={vendor.notes} />
            </div>
          </div>

          {/* Catalog */}
          <div className="pt-4 border-t border-default">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                Catalog ({catalog.length})
              </p>
              <button
                onClick={() => setShowLinkModal(true)}
                disabled={isArchived}
                className="px-3 py-1.5 bg-section hover:bg-elevated border border-default rounded-lg text-primary text-[11px] font-bold flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                title={isArchived ? 'Restore vendor to link products' : 'Link a product'}
              >
                <Plus size={12} /> Link Product
              </button>
            </div>

            {loadingCatalog ? (
              <div className="bg-section border border-default rounded-xl p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent mx-auto"></div>
              </div>
            ) : catalog.length === 0 ? (
              <div className="bg-section border border-default rounded-xl p-4 text-center">
                <p className="text-sm text-muted">No products linked yet</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {catalog.map((row) => {
                  const isEditing = editingRowId === row.vendor_product_id;
                  return (
                    <li
                      key={row.vendor_product_id}
                      className={`p-3 rounded-xl border ${
                        row.is_preferred
                          ? 'bg-amber-500/5 border-amber-500/30'
                          : 'bg-section border-default'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-elevated border border-default overflow-hidden flex-none">
                          {row.product_image ? (
                            <img
                              src={getImageUrl(row.product_image)}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-muted">N/A</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {row.is_preferred && (
                              <Star size={12} className="text-amber-500 fill-amber-500 flex-none" />
                            )}
                            <p className="text-sm font-bold text-primary truncate">{row.product_name}</p>
                          </div>
                          <p className="text-[10px] text-muted">
                            {row.product_category || '—'} · stock {row.product_stock}
                          </p>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] uppercase tracking-wider text-muted mb-1">Cost</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editForm.vendor_cost_price}
                              onChange={(e) => setEditForm((f) => ({ ...f, vendor_cost_price: e.target.value }))}
                              className="w-full px-2 py-1 border border-default rounded bg-surface text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] uppercase tracking-wider text-muted mb-1">Default qty</label>
                            <input
                              type="number"
                              min="1"
                              value={editForm.default_reorder_qty}
                              onChange={(e) => setEditForm((f) => ({ ...f, default_reorder_qty: e.target.value }))}
                              className="w-full px-2 py-1 border border-default rounded bg-surface text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] uppercase tracking-wider text-muted mb-1">Min qty</label>
                            <input
                              type="number"
                              min="1"
                              value={editForm.min_order_qty}
                              onChange={(e) => setEditForm((f) => ({ ...f, min_order_qty: e.target.value }))}
                              className="w-full px-2 py-1 border border-default rounded bg-surface text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                          </div>
                          <div className="col-span-3 flex justify-end gap-1.5 mt-1">
                            <button
                              onClick={cancelEdit}
                              className="px-2.5 py-1 bg-section hover:bg-elevated border border-default rounded text-[10px] font-bold text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(row.vendor_product_id)}
                              className="px-2.5 py-1 bg-btn-primary-bg hover:opacity-90 text-btn-primary-text rounded text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            <span className="px-2 py-0.5 bg-elevated border border-default rounded-full font-bold text-primary">
                              {parseInt(row.vendor_cost_price).toLocaleString()} MMK
                            </span>
                            <span className="px-2 py-0.5 bg-elevated border border-default rounded-full text-muted">
                              default {row.default_reorder_qty}
                            </span>
                            <span className="px-2 py-0.5 bg-elevated border border-default rounded-full text-muted">
                              min {row.min_order_qty}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(row)}
                              className="px-2 py-1 bg-elevated hover:bg-section border border-default rounded text-[10px] font-bold text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                              title="Edit"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              onClick={() => handleSetPreferred(row)}
                              disabled={row.is_preferred}
                              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded text-[10px] font-bold text-amber-700 dark:text-amber-400 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
                              title={row.is_preferred ? 'Already preferred' : 'Set as preferred'}
                            >
                              <Star size={11} />
                            </button>
                            <button
                              onClick={() => handleUnlink(row)}
                              className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded text-[10px] font-bold text-red-700 dark:text-red-400 focus:outline-none focus:ring-1 focus:ring-accent"
                              title="Unlink"
                            >
                              <Trash size={11} />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Timestamps */}
          <div className="pt-2 text-[10px] text-muted">
            Created: {new Date(vendor.created_at).toLocaleString()} · Updated: {new Date(vendor.updated_at).toLocaleString()}
          </div>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-elevated border-t border-default px-6 py-3 flex flex-wrap gap-2 justify-end">
          <button
            onClick={() => onEdit(vendor)}
            className="px-3 py-2 bg-section hover:bg-elevated border border-default rounded-lg text-primary text-xs font-bold flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <Edit2 size={14} /> Edit
          </button>
          {isArchived ? (
            <button
              onClick={() => onRestore(vendor)}
              className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <ArchiveRestore size={14} /> Restore
            </button>
          ) : (
            <button
              onClick={() => onArchive(vendor)}
              className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <Archive size={14} /> Archive
            </button>
          )}
          <button
            onClick={() => onDelete(vendor)}
            className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-700 dark:text-red-400 text-xs font-bold flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Link Product modal */}
      <LinkProductModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        vendor={vendor}
        excludedProductIds={linkedProductIds}
        onLinked={() => {
          setShowLinkModal(false);
          fetchCatalog();
        }}
      />
    </div>
  );
};

export default VendorDetailDrawer;
