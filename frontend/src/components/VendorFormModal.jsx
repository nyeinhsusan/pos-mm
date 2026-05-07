import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import vendorService from '../services/vendorService';
import notify from '../services/notificationService';

const PAYMENT_TERMS = ['NET_7', 'NET_15', 'NET_30', 'COD', 'PREPAID'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyForm = {
  name: '',
  email: '',
  contact_name: '',
  phone: '',
  address: '',
  payment_terms: 'NET_15',
  lead_time_days: 7,
  currency: 'MMK',
  notes: ''
};

const VendorFormModal = ({ isOpen, onClose, onSaved, vendor }) => {
  const isEdit = Boolean(vendor);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (vendor) {
        setForm({
          name: vendor.name || '',
          email: vendor.email || '',
          contact_name: vendor.contact_name || '',
          phone: vendor.phone || '',
          address: vendor.address || '',
          payment_terms: vendor.payment_terms || 'NET_15',
          lead_time_days: vendor.lead_time_days != null ? vendor.lead_time_days : 7,
          currency: vendor.currency || 'MMK',
          notes: vendor.notes || ''
        });
      } else {
        setForm(emptyForm);
      }
      setErrors({});
      setLogoFile(null);
      setLogoPreview(null);
    }
  }, [isOpen, vendor]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (form.name.length > 255) next.name = 'Name too long (max 255)';
    if (!form.email.trim()) next.email = 'Email is required';
    else if (!EMAIL_REGEX.test(form.email)) next.email = 'Invalid email format';
    const ld = Number(form.lead_time_days);
    if (!Number.isInteger(ld) || ld < 0 || ld > 365) {
      next.lead_time_days = 'Must be 0–365';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || saving) return;

    setSaving(true);
    try {
      const payload = {
        ...form,
        lead_time_days: Number(form.lead_time_days),
        contact_name: form.contact_name || null,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null
      };

      let savedVendor;
      if (isEdit) {
        const res = await vendorService.updateVendor(vendor.vendor_id, payload);
        savedVendor = res.data;
      } else {
        const res = await vendorService.createVendor(payload);
        // POST returns { vendor_id }; refetch full row
        const full = await vendorService.getVendor(res.data.vendor_id);
        savedVendor = full.data;
      }

      // Logo upload (after create/update so we have the vendor_id)
      if (logoFile) {
        try {
          const logoRes = await vendorService.uploadLogo(savedVendor.vendor_id, logoFile);
          savedVendor = { ...savedVendor, logo_url: logoRes.data.logo_url };
        } catch (logoErr) {
          notify.error('Vendor saved, but logo upload failed');
          console.error('Logo upload error:', logoErr);
        }
      }

      notify.success(isEdit ? `Updated ${savedVendor.name}` : `Created ${savedVendor.name}`);
      onSaved(savedVendor);
    } catch (err) {
      const msg = err.response?.data?.error?.details
        || err.response?.data?.error?.message
        || 'Failed to save vendor';
      notify.error(msg);
      console.error('Save vendor error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-elevated border border-default rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto fade-in-up">
        <div className="sticky top-0 bg-elevated border-b border-default px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-primary">
            {isEdit ? 'Edit Vendor' : 'New Vendor'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary transition-colors p-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-section border border-default overflow-hidden flex items-center justify-center flex-none">
              {logoPreview ? (
                <img src={logoPreview} alt="" className="w-full h-full object-cover" />
              ) : vendor?.logo_url ? (
                <img
                  src={`${(import.meta.env.VITE_API_URL || 'http://localhost:5002/api').replace('/api', '')}${vendor.logo_url}`}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-[9px] text-muted uppercase tracking-widest">No Logo</span>
              )}
            </div>
            <label className="text-sm text-primary cursor-pointer">
              <span className="px-3 py-2 inline-block bg-section hover:bg-elevated border border-default rounded-lg font-medium text-xs">
                {logoFile ? 'Change logo' : 'Upload logo'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="sr-only"
              />
            </label>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="ACME Distribution Co."
            />
            {errors.name && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="sales@vendor.example.com"
            />
            {errors.email && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.email}</p>
            )}
          </div>

          {/* Contact + Phone (2 cols) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Contact name</label>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => handleChange('contact_name', e.target.value)}
                className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="U Aung"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="+95 9 ..."
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
            />
          </div>

          {/* Payment terms + Lead time + Currency (3 cols) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Payment terms</label>
              <select
                value={form.payment_terms}
                onChange={(e) => handleChange('payment_terms', e.target.value)}
                className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                {PAYMENT_TERMS.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Lead time (days)</label>
              <input
                type="number"
                min="0"
                max="365"
                value={form.lead_time_days}
                onChange={(e) => handleChange('lead_time_days', e.target.value)}
                className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
              {errors.lead_time_days && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.lead_time_days}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Currency</label>
              <input
                type="text"
                value={form.currency}
                disabled
                className="w-full px-3 py-2 border border-default rounded-lg bg-section text-muted cursor-not-allowed"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-default">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-section hover:bg-elevated border border-default text-primary rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-btn-primary-bg hover:opacity-90 text-btn-primary-text rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VendorFormModal;
