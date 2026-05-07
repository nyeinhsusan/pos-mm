import { useState, useEffect, useMemo } from 'react';
import { X, Search, Star } from 'lucide-react';
import api from '../services/api';
import vendorService from '../services/vendorService';
import notify from '../services/notificationService';

const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
  const base = apiBase.replace('/api', '');
  return `${base}${path}`;
};

/**
 * Product picker for linking a product to a vendor.
 * Excludes products already in the vendor's catalog.
 */
const LinkProductModal = ({ isOpen, onClose, vendor, excludedProductIds = [], onLinked }) => {
  const [products, setProducts] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState(null);
  const [costPrice, setCostPrice] = useState('');
  const [defaultQty, setDefaultQty] = useState(1);
  const [minQty, setMinQty] = useState(1);
  const [isPreferred, setIsPreferred] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelected(null);
      setCostPrice('');
      setDefaultQty(1);
      setMinQty(1);
      setIsPreferred(false);
    }
  }, [isOpen]);

  // Load products on open
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      try {
        const res = await api.get('/products');
        if (!cancelled && res.data?.success) {
          setProducts(res.data.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Load products error:', err);
          notify.error('Failed to load products');
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Pre-fill cost when product selected
  useEffect(() => {
    if (selected && !costPrice) {
      // Default to product's cost_price; owner can override
      setCostPrice(selected.cost_price || '');
    }
  }, [selected]);

  const filteredProducts = useMemo(() => {
    const excluded = new Set(excludedProductIds);
    const term = search.trim().toLowerCase();
    return products
      .filter((p) => !excluded.has(p.product_id))
      .filter((p) => {
        if (!term) return true;
        return (
          p.name?.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term) ||
          p.category?.toLowerCase().includes(term)
        );
      });
  }, [products, search, excludedProductIds]);

  if (!isOpen || !vendor) return null;

  const handleLink = async () => {
    if (!selected) {
      notify.error('Pick a product first');
      return;
    }
    const cost = Number(costPrice);
    if (!Number.isFinite(cost) || cost < 0) {
      notify.error('Cost price must be a non-negative number');
      return;
    }
    const dq = Number(defaultQty);
    const mq = Number(minQty);
    if (!Number.isInteger(dq) || dq < 1) {
      notify.error('Default reorder qty must be a positive integer');
      return;
    }
    if (!Number.isInteger(mq) || mq < 1) {
      notify.error('Min order qty must be a positive integer');
      return;
    }

    setSaving(true);
    try {
      await vendorService.linkProductToVendor(vendor.vendor_id, {
        product_id: selected.product_id,
        vendor_cost_price: cost,
        default_reorder_qty: dq,
        min_order_qty: mq,
        is_preferred: isPreferred
      });
      notify.success(`Linked ${selected.name}`);
      onLinked();
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.error?.details ||
        'Failed to link product';
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-elevated border border-default rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden fade-in-up flex flex-col">
        {/* Header */}
        <div className="bg-elevated border-b border-default px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">Link product</h2>
            <p className="text-xs text-muted truncate">to {vendor.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary transition-colors p-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-default">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              autoFocus
              placeholder="Search by name, SKU, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-default rounded-lg bg-surface text-primary placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>
        </div>

        {/* Product list (left) + form (right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
          {/* List */}
          <div className="overflow-y-auto max-h-[60vh] border-r border-default">
            {loadingList ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted">
                {search
                  ? 'No products match your search'
                  : excludedProductIds.length > 0
                  ? 'All products are already linked to this vendor'
                  : 'No products available'}
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-default)]">
                {filteredProducts.map((p) => {
                  const isSel = selected?.product_id === p.product_id;
                  return (
                    <li key={p.product_id}>
                      <button
                        type="button"
                        onClick={() => setSelected(p)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${
                          isSel ? 'bg-section' : 'hover:bg-section'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-elevated border border-default overflow-hidden flex-none">
                          {p.image ? (
                            <img
                              src={getImageUrl(p.image)}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-muted">N/A</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-primary truncate">{p.name}</p>
                          <p className="text-[10px] text-muted truncate">
                            {p.category || '—'} · stock {p.stock_quantity}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Form */}
          <div className="overflow-y-auto max-h-[60vh] p-5">
            {!selected ? (
              <div className="h-full flex items-center justify-center text-center">
                <p className="text-sm text-muted">
                  Select a product on the left to set vendor pricing
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-section border border-default rounded-xl p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-elevated border border-default overflow-hidden flex-none">
                    {selected.image ? (
                      <img
                        src={getImageUrl(selected.image)}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-muted">N/A</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary truncate">{selected.name}</p>
                    <p className="text-[10px] text-muted">
                      Retail price: {parseInt(selected.price).toLocaleString()} MMK
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-primary mb-1">
                    Vendor cost price (MMK) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1">Default reorder qty</label>
                    <input
                      type="number"
                      min="1"
                      value={defaultQty}
                      onChange={(e) => setDefaultQty(e.target.value)}
                      className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1">Min order qty</label>
                    <input
                      type="number"
                      min="1"
                      value={minQty}
                      onChange={(e) => setMinQty(e.target.value)}
                      className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={isPreferred}
                    onChange={(e) => setIsPreferred(e.target.checked)}
                    className="rounded border-default"
                  />
                  <Star size={14} className="text-amber-500" />
                  Set as preferred vendor for this product
                </label>
                <p className="text-[10px] text-muted -mt-2">
                  If another vendor is currently preferred for this product, they will be demoted automatically.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-elevated border-t border-default px-6 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-section hover:bg-elevated border border-default text-primary rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLink}
            disabled={!selected || saving}
            className="px-5 py-2 bg-btn-primary-bg hover:opacity-90 text-btn-primary-text rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          >
            {saving ? 'Linking...' : 'Link product'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkProductModal;
