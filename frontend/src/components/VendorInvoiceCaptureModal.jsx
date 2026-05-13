import { useState, useEffect, useMemo } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import vendorInvoiceService from '../services/vendorInvoiceService';
import vendorService from '../services/vendorService';
import { listPurchaseOrders } from '../services/purchaseOrderService';
import notify from '../services/notificationService';

const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const emptyForm = {
  invoice_number: '',
  invoice_date: todayISO(),
  due_date: '',
  subtotal: '',
  tax_amount: '',
  total: '',
  currency: 'MMK',
  notes: ''
};

const VendorInvoiceCaptureModal = ({
  isOpen,
  onClose,
  onSaved,
  vendorId,         // optional: locks vendor
  poId,             // optional: locks PO
  vendorName,       // display only
  poNumber          // display only
}) => {
  const [form, setForm] = useState(emptyForm);
  const [vendors, setVendors] = useState([]);
  const [pos, setPos] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedPoId, setSelectedPoId] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const vendorLocked = !!vendorId;
  const poLocked = !!poId;

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyForm);
    setErrors({});
    setFile(null);
    setSelectedVendorId(vendorId ? String(vendorId) : '');
    setSelectedPoId(poId ? String(poId) : '');
  }, [isOpen, vendorId, poId]);

  // Load vendors when needed (vendor not locked)
  useEffect(() => {
    if (!isOpen || vendorLocked) return;
    let alive = true;
    (async () => {
      try {
        const res = await vendorService.listVendors({ status: 'active' });
        if (alive && res.success) setVendors(res.data || []);
      } catch (err) {
        console.error('Failed to load vendors', err);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, vendorLocked]);

  // Load POs for selected vendor (when PO not locked and vendor chosen)
  useEffect(() => {
    if (!isOpen || poLocked) {
      setPos([]);
      return;
    }
    const vid = selectedVendorId || vendorId;
    if (!vid) {
      setPos([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await listPurchaseOrders({ vendor_id: vid });
        if (alive && res.success) setPos(res.data || []);
      } catch (err) {
        console.error('Failed to load POs', err);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, poLocked, selectedVendorId, vendorId]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Auto-compute total when subtotal/tax change (unless owner has typed a total)
  const computedTotal = useMemo(() => {
    const s = Number(form.subtotal) || 0;
    const t = Number(form.tax_amount) || 0;
    return (s + t).toFixed(2);
  }, [form.subtotal, form.tax_amount]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.invoice_number.trim()) next.invoice_number = 'Required';
    if (!form.invoice_date) next.invoice_date = 'Required';
    const effectiveVendor = vendorLocked ? vendorId : selectedVendorId;
    if (!effectiveVendor) next.vendor = 'Vendor required';
    const totalNum = Number(form.total || computedTotal);
    if (!totalNum || totalNum < 0) next.total = 'Total must be ≥ 0';
    if (form.due_date && form.due_date < form.invoice_date) {
      next.due_date = 'Due date cannot be before invoice date';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        invoice_number: form.invoice_number.trim(),
        vendor_id: Number(vendorLocked ? vendorId : selectedVendorId),
        po_id: poLocked
          ? Number(poId)
          : (selectedPoId ? Number(selectedPoId) : null),
        invoice_date: form.invoice_date,
        due_date: form.due_date || null,
        subtotal: Number(form.subtotal) || 0,
        tax_amount: Number(form.tax_amount) || 0,
        total: Number(form.total || computedTotal),
        currency: form.currency || 'MMK',
        notes: form.notes || null
      };

      const createRes = await vendorInvoiceService.createInvoice(payload);
      if (!createRes.success) {
        notify.error(createRes.error?.message || 'Failed to create invoice');
        return;
      }
      const created = createRes.data;

      // Upload attachment if selected
      if (file) {
        try {
          await vendorInvoiceService.uploadAttachment(created.invoice_id, file);
        } catch (uploadErr) {
          notify.error('Invoice saved, but attachment upload failed: ' + (uploadErr.response?.data?.error?.message || uploadErr.message));
        }
      }

      notify.success('Invoice captured.');
      if (onSaved) onSaved(created);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to capture invoice';
      notify.error(msg);
      // Map server-side field errors when possible
      const code = err.response?.data?.error?.code;
      if (code === 'DUPLICATE_INVOICE_NUMBER') {
        setErrors((prev) => ({ ...prev, invoice_number: 'Already used for this vendor' }));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-default rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default sticky top-0 bg-surface z-10">
          <div>
            <h2 className="text-lg font-bold text-primary">Capture Invoice</h2>
            <p className="text-xs text-muted mt-1">
              {vendorName && `Vendor: ${vendorName}`}
              {vendorName && poNumber && ' • '}
              {poNumber && `PO: ${poNumber}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary p-2 rounded-lg hover:bg-elevated transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Vendor selector (if not locked) */}
          {!vendorLocked && (
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Vendor *</label>
              <select
                value={selectedVendorId}
                onChange={(e) => { setSelectedVendorId(e.target.value); setSelectedPoId(''); }}
                className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select vendor —</option>
                {vendors.map((v) => (
                  <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
                ))}
              </select>
              {errors.vendor && <p className="text-xs text-rose-500 mt-1">{errors.vendor}</p>}
            </div>
          )}

          {/* PO selector (if not locked and vendor chosen) */}
          {!poLocked && (
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">
                Related PO (optional)
              </label>
              <select
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                disabled={!selectedVendorId && !vendorId}
                className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">— Ad-hoc (no PO) —</option>
                {pos.map((p) => (
                  <option key={p.po_id} value={p.po_id}>{p.po_number} ({p.status})</option>
                ))}
              </select>
            </div>
          )}

          {/* Invoice number + date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Invoice Number *</label>
              <input
                type="text"
                value={form.invoice_number}
                onChange={(e) => handleChange('invoice_number', e.target.value)}
                placeholder="INV-001"
                className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.invoice_number && <p className="text-xs text-rose-500 mt-1">{errors.invoice_number}</p>}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Invoice Date *</label>
              <input
                type="date"
                value={form.invoice_date}
                onChange={(e) => handleChange('invoice_date', e.target.value)}
                className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.invoice_date && <p className="text-xs text-rose-500 mt-1">{errors.invoice_date}</p>}
            </div>
          </div>

          {/* Due date + currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => handleChange('due_date', e.target.value)}
                className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.due_date && <p className="text-xs text-rose-500 mt-1">{errors.due_date}</p>}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Currency</label>
              <input
                type="text"
                value={form.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Subtotal / tax / total */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Subtotal</label>
              <input
                type="number"
                step="0.01"
                value={form.subtotal}
                onChange={(e) => handleChange('subtotal', e.target.value)}
                placeholder="0.00"
                className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Tax</label>
              <input
                type="number"
                step="0.01"
                value={form.tax_amount}
                onChange={(e) => handleChange('tax_amount', e.target.value)}
                placeholder="0.00"
                className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted block mb-1">Total *</label>
              <input
                type="number"
                step="0.01"
                value={form.total}
                onChange={(e) => handleChange('total', e.target.value)}
                placeholder={computedTotal}
                className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.total && <p className="text-xs text-rose-500 mt-1">{errors.total}</p>}
            </div>
          </div>
          <p className="text-xs text-muted">Auto-computed total: <span className="font-semibold text-primary">{computedTotal}</span> {form.currency}. Override above if vendor's total differs.</p>

          {/* Notes */}
          <div>
            <label className="text-xs uppercase tracking-wider text-muted block mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
              className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Attachment */}
          <div>
            <label className="text-xs uppercase tracking-wider text-muted block mb-1">Attachment (PDF or image)</label>
            <label className="flex items-center gap-2 px-3 py-2.5 bg-section border border-dashed border-default rounded-xl cursor-pointer hover:bg-elevated transition-colors">
              <Upload size={16} className="text-muted" />
              <span className="text-sm text-primary truncate">
                {file ? file.name : 'Click to choose a file (PDF, JPG, PNG, WebP — max 10MB)'}
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs text-rose-500 mt-1 hover:underline"
              >
                Remove
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-default">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-section text-primary text-sm font-semibold hover:bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2"
            >
              <FileText size={16} />
              {saving ? 'Saving…' : 'Capture Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VendorInvoiceCaptureModal;
