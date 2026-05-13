import { useState, useEffect } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import vendorInvoiceService from '../services/vendorInvoiceService';
import notify from '../services/notificationService';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'other', label: 'Other' }
];

const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const MarkInvoicePaidModal = ({ isOpen, onClose, invoice, onSaved }) => {
  const [paidDate, setPaidDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPaidDate(todayISO());
      setPaymentMethod('bank_transfer');
      setPaymentReference('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !invoice) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!paidDate || !paymentMethod) {
      notify.error('Paid date and payment method are required');
      return;
    }
    setSaving(true);
    try {
      const res = await vendorInvoiceService.markPaid(invoice.invoice_id, {
        paid_date: paidDate,
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim() || null
      });
      if (res.success) {
        notify.success('Marked paid.');
        if (onSaved) onSaved(res.data);
        onClose();
      } else {
        notify.error(res.error?.message || 'Failed to mark paid');
      }
    } catch (err) {
      notify.error(err.response?.data?.error?.message || 'Failed to mark paid');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-default rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default">
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <CheckCircle2 size={20} className="text-emerald-500" />
            Mark Invoice Paid
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary p-2 rounded-lg hover:bg-elevated"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-section border border-default rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-muted mb-1">Confirmation</p>
            <p className="text-sm text-primary">
              Mark invoice <span className="font-bold">{invoice.invoice_number}</span> as paid for{' '}
              <span className="font-bold">
                {Number(invoice.total).toLocaleString()} {invoice.currency}
              </span>?
            </p>
            {invoice.vendor_name && (
              <p className="text-xs text-muted mt-1">Vendor: {invoice.vendor_name}</p>
            )}
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted block mb-1">Paid Date *</label>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              required
              className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted block mb-1">Payment Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
              className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted block mb-1">Payment Reference</label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="TXN, receipt #, optional"
              className="w-full bg-section border border-default rounded-xl px-3 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

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
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              {saving ? 'Saving…' : 'Mark Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MarkInvoicePaidModal;
