import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Sparkles, Save, X, Edit, Send, Download, FileText, Package, Clock, Mail, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import purchaseOrderService from '../services/purchaseOrderService';
import vendorService from '../services/vendorService';
import api from '../services/api';
import notify from '../services/notificationService';
import Sidebar from '../components/Sidebar';
import ReceivePurchaseOrderModal from '../components/ReceivePurchaseOrderModal';
import VendorInvoiceCaptureModal from '../components/VendorInvoiceCaptureModal';
import MarkInvoicePaidModal from '../components/MarkInvoicePaidModal';
import vendorInvoiceService from '../services/vendorInvoiceService';

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

const newBlankLine = () => ({
  _key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  product_id: null,
  product_name: '',
  quantity_ordered: 1,
  unit_cost: 0,
  tax_amount: 0
});

const PurchaseOrderEditorPage = ({ mode = 'create' }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  // Owner-only redirect
  useEffect(() => {
    if (user && user.role !== 'owner') {
      notify.error('Access denied. Owner role required.');
      navigate('/pos');
    }
  }, [user, navigate]);

  // Loading + base data
  const [loading, setLoading] = useState(mode !== 'create');
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [vendorCatalog, setVendorCatalog] = useState([]); // vendor-linked product list

  // Editor state
  const [vendorId, setVendorId] = useState(null);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([newBlankLine()]);

  // For view/edit modes — the loaded PO
  const [po, setPo] = useState(null);

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);

  // Receive modal
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  // Invoice capture modal + invoices for this PO
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [poInvoices, setPoInvoices] = useState([]);
  const [markPaidInvoice, setMarkPaidInvoice] = useState(null);

  const refreshPoInvoices = useCallback(async () => {
    if (!id) return;
    try {
      const invRes = await vendorInvoiceService.listInvoices({ po_id: id });
      if (invRes.success) setPoInvoices(invRes.data || []);
    } catch (err) {
      console.error('Failed to refresh PO invoices', err);
    }
  }, [id]);

  // History
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const isCreate = mode === 'create';
  const isEdit = mode === 'edit';
  const isView = mode === 'view';
  const readOnly = isView;

  // Initial load: vendors + products
  useEffect(() => {
    if (user?.role !== 'owner') return;
    (async () => {
      try {
        const [vendorsRes, productsRes] = await Promise.all([
          vendorService.listVendors({ status: 'active' }),
          api.get('/products')
        ]);
        if (vendorsRes.success) setVendors(vendorsRes.data || []);
        const productsData = productsRes.data?.data || productsRes.data?.products || [];
        setAllProducts(Array.isArray(productsData) ? productsData : []);
      } catch (err) {
        console.error('Initial load error:', err);
        notify.error('Failed to load vendors or products');
      }
    })();
  }, [user]);

  // Load PO if edit/view
  const loadPo = useCallback(async () => {
    if (isCreate || !id) return;
    try {
      setLoading(true);
      const [poRes, historyRes] = await Promise.all([
        purchaseOrderService.getPurchaseOrder(id),
        purchaseOrderService.getPurchaseOrderHistory(id)
      ]);
      if (poRes.success) {
        setPo(poRes.data);
        setVendorId(poRes.data.vendor_id);
        setNotes(poRes.data.notes || '');
        setItems(
          (poRes.data.items || []).map((it) => ({
            _key: `line-${it.po_item_id}`,
            po_item_id: it.po_item_id,
            product_id: it.product_id,
            product_name: it.product_name,
            quantity_ordered: it.quantity_ordered,
            quantity_received: it.quantity_received,
            unit_cost: Number(it.unit_cost),
            tax_amount: Number(it.tax_amount),
            ml_confidence: it.ml_confidence != null ? Number(it.ml_confidence) : null
          }))
        );
        if (historyRes.success) {
          setHistory(historyRes.data || []);
        }
        // Load invoices for this PO (Story 27)
        try {
          const invRes = await vendorInvoiceService.listInvoices({ po_id: id });
          if (invRes.success) setPoInvoices(invRes.data || []);
        } catch (invErr) {
          console.error('Failed to load PO invoices', invErr);
        }
      }
    } catch (err) {
      console.error('Load PO error:', err);
      const msg = err.response?.data?.error?.message || 'Failed to load purchase order';
      notify.error(msg);
      navigate('/purchase-orders');
    } finally {
      setLoading(false);
    }
  }, [id, isCreate, navigate]);

  useEffect(() => {
    if (!isCreate) loadPo();
  }, [isCreate, loadPo]);

  // Load vendor catalog when vendor changes
  useEffect(() => {
    if (!vendorId) {
      setVendorCatalog([]);
      return;
    }
    (async () => {
      try {
        const res = await vendorService.getVendorProducts(vendorId);
        if (res.success) setVendorCatalog(res.data || []);
      } catch (err) {
        console.error('Vendor catalog error:', err);
      }
    })();
  }, [vendorId]);

  // Live totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const it of items) {
      const q = Number(it.quantity_ordered) || 0;
      const u = Number(it.unit_cost) || 0;
      const t = Number(it.tax_amount) || 0;
      subtotal += q * u;
      tax += t;
    }
    return { subtotal, tax, total: subtotal + tax };
  }, [items]);

  // Mutators
  const updateLine = (key, patch) => {
    setItems((prev) =>
      prev.map((it) => (it._key === key ? { ...it, ...patch } : it))
    );
  };

  const removeLine = (key) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((it) => it._key !== key)));
  };

  const addLine = () => {
    setItems((prev) => [...prev, newBlankLine()]);
  };

  const handleVendorChange = (newVendorId) => {
    if (!isCreate) return;
    setVendorId(newVendorId ? Number(newVendorId) : null);
    // Reset items to a blank line on vendor change to avoid mixed-vendor state
    setItems([newBlankLine()]);
  };

  const handleAutofillFromCatalog = () => {
    if (!vendorCatalog || vendorCatalog.length === 0) {
      notify.warning('This vendor has no linked products yet. Add some on the Vendors page.');
      return;
    }
    const lines = vendorCatalog.map((vp) => ({
      _key: `line-${vp.vendor_product_id}-${Date.now()}`,
      product_id: vp.product_id,
      product_name: vp.product_name,
      quantity_ordered: Number(vp.default_reorder_qty) > 0 ? Number(vp.default_reorder_qty) : 1,
      unit_cost: Number(vp.vendor_cost_price) || 0,
      tax_amount: 0
    }));
    setItems(lines);
    notify.success(`Filled ${lines.length} product(s) from vendor catalog.`);
  };

  const validate = () => {
    if (!vendorId) {
      notify.error('Pick a vendor first.');
      return false;
    }
    const validLines = items.filter((it) => it.product_id && Number(it.quantity_ordered) >= 1);
    if (validLines.length === 0) {
      notify.error('Add at least one valid line item.');
      return false;
    }
    for (const it of validLines) {
      if (!Number.isFinite(Number(it.unit_cost)) || Number(it.unit_cost) < 0) {
        notify.error('Unit cost must be a number ≥ 0.');
        return false;
      }
    }
    return true;
  };

  const buildPayload = () => ({
    vendor_id: vendorId,
    notes: notes || null,
    items: items
      .filter((it) => it.product_id && Number(it.quantity_ordered) >= 1)
      .map((it) => ({
        product_id: Number(it.product_id),
        quantity_ordered: Number(it.quantity_ordered),
        unit_cost: Number(it.unit_cost),
        tax_amount: Number(it.tax_amount) || 0
      }))
  });

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      if (isCreate) {
        const res = await purchaseOrderService.createPurchaseOrder(buildPayload());
        if (res.success) {
          notify.success(`Created ${res.data.po_number}`);
          navigate(`/purchase-orders/${res.data.po_id}`);
        }
      } else if (isEdit) {
        const { vendor_id, ...rest } = buildPayload(); // vendor_id not editable
        void vendor_id;
        const res = await purchaseOrderService.updatePurchaseOrder(id, rest);
        if (res.success) {
          notify.success('Saved.');
          navigate(`/purchase-orders/${id}`);
        }
      }
    } catch (err) {
      console.error('Save PO error:', err);
      const msg = err.response?.data?.error?.message || 'Failed to save purchase order';
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPo = async () => {
    try {
      setSaving(true);
      const res = await purchaseOrderService.cancelPurchaseOrder(id, cancelReason);
      if (res.success) {
        notify.success('Purchase order cancelled.');
        setShowCancelModal(false);
        loadPo();
      }
    } catch (err) {
      console.error('Cancel PO error:', err);
      const msg = err.response?.data?.error?.message || 'Failed to cancel purchase order';
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    try {
      setSending(true);
      const res = await purchaseOrderService.sendPurchaseOrder(id);
      if (res.success) {
        notify.success(`PO sent to ${po.vendor?.email}`);
        setShowSendModal(false);
        loadPo();
      }
    } catch (err) {
      console.error('Send PO error:', err);
      const errData = err.response?.data?.error;
      if (errData?.code === 'VENDOR_HAS_NO_EMAIL') {
        notify.error('Vendor has no email — add one on the vendor record.');
      } else if (errData?.code === 'SMTP_NOT_CONFIGURED') {
        notify.error('Configure SMTP in Settings (coming in Story 26).');
      } else if (err.response?.status === 502) {
        notify.error('Send failed: Email delivery error. Retry from Email Log (Story 26).');
      } else {
        const msg = errData?.message || 'Failed to send purchase order';
        notify.error(msg);
      }
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPdf = () => {
    if (po?.pdf_url) {
      const baseUrl = api.defaults.baseURL?.replace('/api', '') || 'http://localhost:5000';
      window.open(`${baseUrl}${po.pdf_url}`, '_blank');
    }
  };

  // Available products for the line picker — vendor catalog if available, else all
  const productPickerSource = useMemo(() => {
    if (vendorCatalog.length > 0) {
      const map = new Map();
      vendorCatalog.forEach((vp) => {
        map.set(vp.product_id, {
          product_id: vp.product_id,
          name: vp.product_name,
          vendor_cost_price: Number(vp.vendor_cost_price) || 0,
          default_reorder_qty: Number(vp.default_reorder_qty) || 1
        });
      });
      // Also include all-products for fallback when owner wants to add a non-linked product
      allProducts.forEach((p) => {
        if (!map.has(p.product_id)) {
          map.set(p.product_id, {
            product_id: p.product_id,
            name: p.name,
            vendor_cost_price: 0,
            default_reorder_qty: 1
          });
        }
      });
      return Array.from(map.values());
    }
    return allProducts.map((p) => ({
      product_id: p.product_id,
      name: p.name,
      vendor_cost_price: 0,
      default_reorder_qty: 1
    }));
  }, [vendorCatalog, allProducts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base text-primary flex items-center justify-center">
        <div className="text-muted">Loading purchase order…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base text-primary flex">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      <main className="flex-1 ml-0 md:ml-28 p-4 md:p-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/purchase-orders')}
            className="p-2 rounded-xl hover:bg-section text-muted hover:text-primary transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <span>{isCreate ? 'New Purchase Order' : po?.po_number || 'Purchase Order'}</span>
              {po?.source === 'auto_ml' && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400"
                  title="Auto-generated from ML predictions"
                >
                  <Sparkles size={12} /> Auto
                </span>
              )}
            </h1>
            {!isCreate && po && (
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold ${
                    STATUS_BADGE[po.status] || 'bg-section text-muted'
                  }`}
                >
                  {STATUS_LABEL[po.status] || po.status}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {isView && po?.status === 'draft' && (
            <button
              onClick={() => navigate(`/purchase-orders/${id}/edit`)}
              className="px-3 py-2 rounded-xl bg-section text-primary text-sm font-semibold flex items-center gap-2 hover:bg-elevated"
            >
              <Edit size={16} /> Edit
            </button>
          )}
          {isView && po && ['draft', 'sent'].includes(po.status) && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-3 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/30"
            >
              Cancel PO
            </button>
          )}
          {isView && po?.status === 'draft' && (
            <button
              onClick={() => setShowSendModal(true)}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-indigo-500"
            >
              <Send size={16} /> Send
            </button>
          )}
          {isView && po?.pdf_url && (
            <button
              onClick={handleDownloadPdf}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-500"
            >
              <Download size={16} /> Download PDF
            </button>
          )}
          {isView && po && ['sent', 'partially_received'].includes(po.status) && (
            <button
              onClick={() => setShowReceiveModal(true)}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-500"
            >
              <Package size={16} /> Receive
            </button>
          )}
          {isView && history.length > 0 && (
            <button
              onClick={() => setShowHistory(true)}
              className="px-3 py-2 rounded-xl bg-section text-primary text-sm font-semibold flex items-center gap-2 hover:bg-elevated"
            >
              <Clock size={16} /> History
            </button>
          )}
          {isView && po && po.po_id && po.status !== 'draft' && (
            <button
              onClick={() => navigate(`/email-log?related_po_id=${po.po_id}`)}
              className="px-3 py-2 rounded-xl bg-section text-primary text-sm font-semibold flex items-center gap-2 hover:bg-elevated"
              title="View email send log for this PO"
            >
              <Mail size={16} /> Email Log
            </button>
          )}
          {isView && po && po.po_id && (
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-indigo-500"
              title="Capture an invoice for this PO"
            >
              <FileText size={16} /> Capture Invoice
            </button>
          )}
        </div>

        {/* Vendor selector */}
        <div className="bg-elevated rounded-2xl p-5 mb-4 border border-default">
          <label className="text-xs uppercase tracking-wider text-muted mb-2 block">Vendor</label>
          {isCreate ? (
            <div className="flex gap-2 flex-col md:flex-row">
              <select
                value={vendorId || ''}
                onChange={(e) => handleVendorChange(e.target.value)}
                className="flex-1 bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select a vendor —</option>
                {vendors.map((v) => (
                  <option key={v.vendor_id} value={v.vendor_id}>
                    {v.name} ({v.email})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAutofillFromCatalog}
                disabled={!vendorId || vendorCatalog.length === 0}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} />
                Autofill from catalog
              </button>
            </div>
          ) : (
            <div className="text-primary font-semibold">
              {po?.vendor?.name}
              <div className="text-sm text-muted font-normal">{po?.vendor?.email}</div>
            </div>
          )}
        </div>

        {/* Line items editor */}
        <div className="bg-elevated rounded-2xl p-5 mb-4 border border-default">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Line items</h2>
            {!readOnly && (
              <button
                onClick={addLine}
                className="px-3 py-1.5 rounded-lg bg-section text-primary text-sm flex items-center gap-1 hover:bg-elevated border border-default"
              >
                <Plus size={14} /> Add line
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="text-left py-2 px-2">Product</th>
                  <th className="text-right py-2 px-2 w-20">Qty</th>
                  <th className="text-right py-2 px-2 w-32">Unit Cost</th>
                  <th className="text-right py-2 px-2 w-28">Tax</th>
                  <th className="text-right py-2 px-2 w-32">Line Total</th>
                  {!readOnly && <th className="w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const lineTotal = (Number(it.quantity_ordered) || 0) * (Number(it.unit_cost) || 0) + (Number(it.tax_amount) || 0);
                  return (
                    <tr key={it._key} className="border-t border-default">
                      <td className="py-2 px-2">
                        {readOnly ? (
                          <span className="flex items-center gap-1">
                            {it.product_name || '—'}
                            {it.ml_confidence != null && it.ml_confidence < 0.6 && (
                              <span className="text-amber-400" title="ML prediction confidence below 60% — review carefully before sending">
                                <AlertTriangle size={14} />
                              </span>
                            )}
                            {it.ml_confidence != null && (
                              <span className="text-xs text-muted ml-1">
                                ({Math.round(it.ml_confidence * 100)}%)
                              </span>
                            )}
                          </span>
                        ) : (
                          <select
                            value={it.product_id || ''}
                            onChange={(e) => {
                              const productId = Number(e.target.value) || null;
                              const picked = productPickerSource.find((p) => p.product_id === productId);
                              updateLine(it._key, {
                                product_id: productId,
                                product_name: picked?.name || '',
                                unit_cost:
                                  // Pre-fill unit_cost from vendor catalog only if line is fresh (still 0)
                                  Number(it.unit_cost) === 0 && picked?.vendor_cost_price > 0
                                    ? picked.vendor_cost_price
                                    : it.unit_cost
                              });
                            }}
                            className="w-full bg-section border border-default rounded-lg px-2 py-1.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">— Pick a product —</option>
                            {productPickerSource.map((p) => (
                              <option key={p.product_id} value={p.product_id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {readOnly ? (
                          it.quantity_ordered
                        ) : (
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={it.quantity_ordered}
                            onChange={(e) =>
                              updateLine(it._key, { quantity_ordered: e.target.value })
                            }
                            className="w-full text-right bg-section border border-default rounded-lg px-2 py-1.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {readOnly ? (
                          formatMmk(it.unit_cost)
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={it.unit_cost}
                            onChange={(e) => updateLine(it._key, { unit_cost: e.target.value })}
                            className="w-full text-right bg-section border border-default rounded-lg px-2 py-1.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {readOnly ? (
                          formatMmk(it.tax_amount)
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={it.tax_amount}
                            onChange={(e) => updateLine(it._key, { tax_amount: e.target.value })}
                            className="w-full text-right bg-section border border-default rounded-lg px-2 py-1.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold">{formatMmk(lineTotal)}</td>
                      {!readOnly && (
                        <td className="py-2 px-2">
                          <button
                            onClick={() => removeLine(it._key)}
                            disabled={items.length === 1}
                            className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            aria-label="Remove line"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="text-sm">
                <tr className="border-t border-default">
                  <td colSpan={4} className="py-2 px-2 text-right text-muted">Subtotal</td>
                  <td className="py-2 px-2 text-right font-semibold">{formatMmk(totals.subtotal)}</td>
                  {!readOnly && <td></td>}
                </tr>
                <tr>
                  <td colSpan={4} className="py-1 px-2 text-right text-muted">Tax total</td>
                  <td className="py-1 px-2 text-right">{formatMmk(totals.tax)}</td>
                  {!readOnly && <td></td>}
                </tr>
                <tr className="border-t border-default">
                  <td colSpan={4} className="py-2 px-2 text-right text-muted uppercase tracking-wider text-xs">Grand total</td>
                  <td className="py-2 px-2 text-right font-bold text-lg text-indigo-400">{formatMmk(totals.total)}</td>
                  {!readOnly && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Auto-generated notice (Story 31) */}
        {isView && po?.source === 'auto_ml' && notes && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <Sparkles size={18} className="text-amber-500 flex-none mt-0.5" />
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold mb-1">
                ML Auto-Generated
              </p>
              <p className="text-sm whitespace-pre-wrap">{notes}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-elevated rounded-2xl p-5 mb-4 border border-default">
          <label className="text-xs uppercase tracking-wider text-muted mb-2 block">
            Notes {!readOnly && <span className="lowercase text-muted/60">(max 2000 chars)</span>}
          </label>
          {readOnly ? (
            <p className="whitespace-pre-wrap text-sm">{notes || <span className="text-muted">—</span>}</p>
          ) : (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              placeholder="Optional — anything you want to remember about this PO."
              className="w-full bg-section border border-default rounded-xl px-3 py-2 text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
            />
          )}
        </div>

        {/* Cancellation reason for cancelled POs */}
        {isView && po?.status === 'cancelled' && po.cancellation_reason && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 mb-4">
            <div className="text-xs uppercase tracking-wider text-red-400 mb-1">Cancellation reason</div>
            <div className="text-sm">{po.cancellation_reason}</div>
          </div>
        )}

        {/* Captured Invoices (Story 27) */}
        {isView && po?.po_id && (
          <div className="bg-elevated rounded-2xl p-5 mb-4 border border-default">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-muted" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                  Captured Invoices ({poInvoices.length})
                </h3>
              </div>
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500"
              >
                + Add
              </button>
            </div>
            {poInvoices.length === 0 ? (
              <p className="text-sm text-muted italic">No invoices captured for this PO yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted border-b border-default">
                    <th className="text-left py-2">Invoice #</th>
                    <th className="text-left py-2">Date</th>
                    <th className="text-right py-2">Total</th>
                    <th className="text-left py-2 pl-4">Status</th>
                    <th className="text-left py-2 pl-4">Attachment</th>
                    <th className="text-right py-2 pl-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {poInvoices.map((inv) => (
                    <tr key={inv.invoice_id} className="border-b border-default/50 last:border-0">
                      <td className="py-2 font-semibold">{inv.invoice_number}</td>
                      <td className="py-2 text-muted">{inv.invoice_date?.slice(0, 10)}</td>
                      <td className="py-2 text-right font-semibold">
                        {Number(inv.total).toLocaleString()} {inv.currency}
                      </td>
                      <td className="py-2 pl-4">
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${
                          inv.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                          inv.status === 'overdue' ? 'bg-rose-500/20 text-rose-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-2 pl-4">
                        {inv.attachment_url ? (
                          <a
                            href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5002'}${inv.attachment_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 text-xs underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 pl-4 text-right">
                        {(inv.status === 'unpaid' || inv.status === 'overdue') && (
                          <button
                            onClick={() => setMarkPaidInvoice(inv)}
                            className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Footer actions */}
        {!readOnly && (
          <div className="flex justify-end gap-2 sticky bottom-4 mt-6">
            <button
              onClick={() => navigate(isEdit ? `/purchase-orders/${id}` : '/purchase-orders')}
              className="px-4 py-2.5 rounded-xl bg-section text-primary font-semibold hover:bg-elevated border border-default flex items-center gap-2"
            >
              <X size={16} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-500/30"
            >
              <Save size={16} />
              {saving ? 'Saving…' : 'Save as Draft'}
            </button>
          </div>
        )}
      </main>

      {/* Cancel PO modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-elevated rounded-2xl p-6 max-w-md w-full border border-default"
          >
            <h3 className="text-lg font-bold mb-2">Cancel Purchase Order</h3>
            <p className="text-sm text-muted mb-4">
              Cancelling <span className="font-mono font-semibold text-primary">{po?.po_number}</span> is non-reversible.
              Stock that was already received (if any) is unaffected.
            </p>
            <label className="text-xs uppercase tracking-wider text-muted mb-2 block">Reason</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value.slice(0, 500))}
              placeholder="Why are you cancelling? (optional but recommended for the audit trail)"
              className="w-full bg-section border border-default rounded-xl px-3 py-2 text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-section text-primary font-semibold hover:bg-elevated border border-default"
              >
                Keep PO
              </button>
              <button
                onClick={handleCancelPo}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50"
              >
                {saving ? 'Cancelling…' : 'Cancel PO'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Send PO modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-elevated rounded-2xl p-6 max-w-md w-full border border-default"
          >
            <h3 className="text-lg font-bold mb-2">Send Purchase Order</h3>
            <p className="text-sm text-muted mb-4">
              Send <span className="font-mono font-semibold text-primary">{po?.po_number}</span> to{' '}
              <span className="font-semibold text-primary">{po?.vendor?.email}</span>?
            </p>
            <p className="text-sm text-muted mb-4">
              A PDF will be attached and emailed to the vendor.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSendModal(false)}
                disabled={sending}
                className="px-4 py-2 rounded-xl bg-section text-primary font-semibold hover:bg-elevated border border-default"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={16} />
                {sending ? 'Sending…' : 'Send PO'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Receive PO modal */}
      {showReceiveModal && po && (
        <ReceivePurchaseOrderModal
          po={po}
          onClose={() => setShowReceiveModal(false)}
          onSuccess={() => {
            setShowReceiveModal(false);
            loadPo();
          }}
        />
      )}

      {/* Vendor Invoice capture modal */}
      <VendorInvoiceCaptureModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onSaved={() => {
          setShowInvoiceModal(false);
          refreshPoInvoices();
        }}
        vendorId={po?.vendor_id}
        poId={po?.po_id}
        vendorName={po?.vendor?.name}
        poNumber={po?.po_number}
      />

      {/* Mark Invoice Paid modal */}
      <MarkInvoicePaidModal
        isOpen={!!markPaidInvoice}
        invoice={markPaidInvoice}
        onClose={() => setMarkPaidInvoice(null)}
        onSaved={() => { setMarkPaidInvoice(null); refreshPoInvoices(); }}
      />

      {/* History modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-elevated rounded-2xl p-6 max-w-lg w-full border border-default max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Clock size={20} /> Purchase Order History
              </h3>
              <button onClick={() => setShowHistory(false)} className="p-1 rounded-lg hover:bg-section">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              {history.map(event => (
                <div key={event.history_id} className="p-3 bg-section rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs uppercase font-semibold px-2 py-0.5 rounded-full ${
                      event.event_type === 'received' ? 'bg-emerald-500/20 text-emerald-400' :
                      event.event_type === 'partially_received' ? 'bg-amber-500/20 text-amber-400' :
                      event.event_type === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                      event.event_type === 'created' ? 'bg-section text-muted' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {event.event_type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    by {event.actor_name || 'Unknown'}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderEditorPage;
