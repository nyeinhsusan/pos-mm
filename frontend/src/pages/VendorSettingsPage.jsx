import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Mail, RefreshCw, ChevronDown, ChevronUp, Send, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import vendorSettingsService from '../services/vendorSettingsService';
import notify from '../services/notificationService';
import Sidebar from '../components/Sidebar';

const AUTO_REORDER_MODES = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'approve_first', label: 'Approve First' },
  { value: 'auto_send', label: 'Auto Send' }
];

const CRON_PRESETS = [
  { value: '0 2 * * *', label: 'Daily at 2:00 AM' },
  { value: '0 2 * * 1', label: 'Weekly on Monday at 2:00 AM' },
  { value: '0 2 1 * *', label: 'Monthly on 1st at 2:00 AM' }
];

const CRON_REGEX = /^(\*|([0-5]?\d)(-([0-5]?\d))?)(\/(\d+))?(\s+(\*|([0-5]?\d)(-([0-5]?\d))?)(\/(\d+))?){4}$/;

const VendorSettingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [settings, setSettings] = useState(null);
  const [errors, setErrors] = useState({});

  // Form state
  const [fromDisplayName, setFromDisplayName] = useState('');
  const [replyToEmail, setReplyToEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');

  const [autoReorderMode, setAutoReorderMode] = useState('disabled');
  const [autoReorderCron, setAutoReorderCron] = useState('');
  const [leadTimeBufferDays, setLeadTimeBufferDays] = useState(0);
  const [digestEmailEnabled, setDigestEmailEnabled] = useState(false);

  // UI state
  const [smtpOpen, setSmtpOpen] = useState(true);
  const [autoReorderOpen, setAutoReorderOpen] = useState(true);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Defense in depth
  useEffect(() => {
    if (user && user.role !== 'owner') {
      notify.error('Access denied. Owner role required.');
      navigate('/pos');
    }
  }, [user, navigate]);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await vendorSettingsService.getSettings();
      if (res.success) {
        const s = res.data;
        setSettings(s);
        // SMTP settings
        setFromDisplayName(s.from_display_name || '');
        setReplyToEmail(s.reply_to_email || '');
        setSmtpHost(s.smtp_host || '');
        setSmtpPort(s.smtp_port ? String(s.smtp_port) : '');
        setSmtpUsername(s.smtp_username || '');
        setSmtpPassword(s.smtp_password === '***' ? '' : ''); // Empty means "keep existing"
        // Auto-reorder settings
        setAutoReorderMode(s.auto_reorder_mode || 'disabled');
        setAutoReorderCron(s.auto_reorder_cron || '');
        setLeadTimeBufferDays(s.lead_time_buffer_days || 0);
        setDigestEmailEnabled(s.digest_email_enabled || false);
      }
    } catch (err) {
      console.error('Fetch settings error:', err);
      notify.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'owner') fetchSettings();
  }, [user, fetchSettings]);

  const validateForm = () => {
    const newErrors = {};
    if (replyToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyToEmail)) {
      newErrors.reply_to_email = 'Invalid email format';
    }
    if (smtpPort && (isNaN(smtpPort) || smtpPort < 1 || smtpPort > 65535)) {
      newErrors.smtp_port = 'Port must be 1-65535';
    }
    if (autoReorderCron && !CRON_REGEX.test(autoReorderCron)) {
      newErrors.auto_reorder_cron = 'Invalid cron expression';
    }
    if (leadTimeBufferDays !== undefined && (leadTimeBufferDays < 0 || !Number.isInteger(leadTimeBufferDays))) {
      newErrors.lead_time_buffer_days = 'Must be a non-negative integer';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (section) => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const updateData = {};

      if (section === 'smtp') {
        if (fromDisplayName !== undefined) updateData.from_display_name = fromDisplayName;
        if (replyToEmail !== undefined) updateData.reply_to_email = replyToEmail;
        if (smtpHost !== undefined) updateData.smtp_host = smtpHost;
        if (smtpPort !== undefined) updateData.smtp_port = Number(smtpPort);
        if (smtpUsername !== undefined) updateData.smtp_username = smtpUsername;
        // Only update password if user typed something
        if (smtpPassword) updateData.smtp_password = smtpPassword;
      } else if (section === 'auto_reorder') {
        updateData.auto_reorder_mode = autoReorderMode;
        updateData.auto_reorder_cron = autoReorderCron;
        updateData.lead_time_buffer_days = leadTimeBufferDays;
        updateData.digest_email_enabled = digestEmailEnabled;
      }

      const res = await vendorSettingsService.updateSettings(updateData);
      if (res.success) {
        notify.success('Settings saved successfully');
        setSmtpPassword(''); // Clear password after save
        fetchSettings();
      }
    } catch (err) {
      console.error('Save settings error:', err);
      const msg = err.response?.data?.error?.message || 'Failed to save settings';
      notify.error(msg);
      // Handle field-level errors
      if (err.response?.data?.error?.code) {
        setErrors({ general: msg });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await vendorSettingsService.testEmail(testEmailAddress || undefined);
      if (res.success) {
        if (res.data.status === 'sent') {
          setTestResult({ success: true, message: 'Test email sent successfully!' });
          notify.success('Test email sent');
        } else {
          setTestResult({ success: false, message: res.data.last_error || 'Failed to send test email' });
          notify.error('Test email failed');
        }
      }
    } catch (err) {
      console.error('Test email error:', err);
      const msg = err.response?.data?.error?.message || 'Failed to send test email';
      setTestResult({ success: false, message: msg });
      notify.error(msg);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base text-primary flex">
        <Sidebar isDark={isDark} toggleTheme={toggleTheme} />
        <main className="flex-1 ml-0 md:ml-28 p-4 md:p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-elevated rounded w-1/3" />
            <div className="h-64 bg-elevated rounded" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base text-primary flex">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      <main className="flex-1 ml-0 md:ml-28 p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Settings size={32} className="text-indigo-400" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Vendor Settings</h1>
            <p className="text-sm text-muted">Configure SMTP, auto-reorder, and notification preferences</p>
          </div>
        </div>

        {/* SMTP Section */}
        <div className="bg-elevated rounded-2xl border border-default mb-6">
          <button
            onClick={() => setSmtpOpen(!smtpOpen)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <Mail size={20} className="text-indigo-400" />
              <span className="font-semibold">Email / SMTP</span>
            </div>
            {smtpOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          <AnimatePresence>
            {smtpOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                        From Display Name
                      </label>
                      <input
                        type="text"
                        value={fromDisplayName}
                        onChange={(e) => setFromDisplayName(e.target.value)}
                        placeholder="POS Myanmar"
                        className="w-full bg-base border border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                        Reply-To Email
                      </label>
                      <input
                        type="email"
                        value={replyToEmail}
                        onChange={(e) => { setReplyToEmail(e.target.value); setErrors({ ...errors, reply_to_email: null }); }}
                        placeholder="you@example.com"
                        className={`w-full bg-base border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.reply_to_email ? 'border-red-500' : 'border-default'}`}
                      />
                      {errors.reply_to_email && (
                        <p className="text-xs text-red-400 mt-1">{errors.reply_to_email}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.example.com"
                        className="w-full bg-base border border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        value={smtpPort}
                        onChange={(e) => { setSmtpPort(e.target.value); setErrors({ ...errors, smtp_port: null }); }}
                        placeholder="587"
                        className={`w-full bg-base border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.smtp_port ? 'border-red-500' : 'border-default'}`}
                      />
                      {errors.smtp_port && (
                        <p className="text-xs text-red-400 mt-1">{errors.smtp_port}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                        SMTP Username
                      </label>
                      <input
                        type="text"
                        value={smtpUsername}
                        onChange={(e) => setSmtpUsername(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full bg-base border border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                      SMTP Password
                    </label>
                    <input
                      type="password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder={settings?.smtp_password === '***' ? 'Saved (hidden) — type a new value to replace' : 'Enter password'}
                      className="w-full bg-base border border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Test Email */}
                  <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                    <button
                      onClick={() => {
                        setTestEmailAddress(replyToEmail || '');
                        setShowTestModal(true);
                      }}
                      disabled={testing}
                      className="px-4 py-2 bg-section text-muted rounded-xl hover:bg-elevated transition-colors flex items-center gap-2 text-sm"
                    >
                      {testing ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                      Test Email
                    </button>
                    {testResult && (
                      <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {testResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
                        {testResult.message}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleSave('smtp')}
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors font-semibold flex items-center gap-2"
                  >
                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                    Save SMTP Settings
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Auto-Reorder Section */}
        <div className="bg-elevated rounded-2xl border border-default mb-6">
          <button
            onClick={() => setAutoReorderOpen(!autoReorderOpen)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <RefreshCw size={20} className="text-indigo-400" />
              <span className="font-semibold">Auto-Reorder Defaults</span>
            </div>
            {autoReorderOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          <AnimatePresence>
            {autoReorderOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-4">
                  <p className="text-xs text-muted">
                    These settings configure automatic reordering. The cron schedule will be applied once auto-reorder is enabled (Epic 9).
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                        Auto-Reorder Mode
                      </label>
                      <select
                        value={autoReorderMode}
                        onChange={(e) => setAutoReorderMode(e.target.value)}
                        className="w-full bg-base border border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {AUTO_REORDER_MODES.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                        Lead Time Buffer (Days)
                      </label>
                      <input
                        type="number"
                        value={leadTimeBufferDays}
                        onChange={(e) => { setLeadTimeBufferDays(Number(e.target.value)); setErrors({ ...errors, lead_time_buffer_days: null }); }}
                        min="0"
                        className={`w-full bg-base border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.lead_time_buffer_days ? 'border-red-500' : 'border-default'}`}
                      />
                      {errors.lead_time_buffer_days && (
                        <p className="text-xs text-red-400 mt-1">{errors.lead_time_buffer_days}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                      Cron Expression
                    </label>
                    <div className="flex flex-col md:flex-row gap-2">
                      <input
                        type="text"
                        value={autoReorderCron}
                        onChange={(e) => { setAutoReorderCron(e.target.value); setErrors({ ...errors, auto_reorder_cron: null }); }}
                        placeholder="0 2 * * *"
                        className={`flex-1 bg-base border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.auto_reorder_cron ? 'border-red-500' : 'border-default'}`}
                      />
                      <select
                        onChange={(e) => { setAutoReorderCron(e.target.value); setErrors({ ...errors, auto_reorder_cron: null }); }}
                        className="bg-base border border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Presets</option>
                        {CRON_PRESETS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    {errors.auto_reorder_cron && (
                      <p className="text-xs text-red-400 mt-1">{errors.auto_reorder_cron}</p>
                    )}
                    <p className="text-xs text-muted mt-1">
                      Schedule applies once auto-reorder is enabled (Epic 9).
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="digestEmailEnabled"
                      checked={digestEmailEnabled}
                      onChange={(e) => setDigestEmailEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-default text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="digestEmailEnabled" className="text-sm">
                      Enable Digest Email
                    </label>
                  </div>

                  <button
                    onClick={() => handleSave('auto_reorder')}
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors font-semibold flex items-center gap-2"
                  >
                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                    Save Auto-Reorder Settings
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Test Email Modal */}
        <AnimatePresence>
          {showTestModal && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setShowTestModal(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 flex items-center justify-center z-50"
              >
                <div className="bg-base border border-default rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                  <h3 className="text-lg font-bold mb-4">Send Test Email</h3>
                  <div className="mb-4">
                    <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                      Send To
                    </label>
                    <input
                      type="email"
                      value={testEmailAddress}
                      onChange={(e) => setTestEmailAddress(e.target.value)}
                      placeholder={replyToEmail || 'you@example.com'}
                      className="w-full bg-base border border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowTestModal(false)}
                      className="flex-1 px-4 py-2 bg-section text-muted rounded-xl hover:bg-elevated transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { handleTestEmail(); setShowTestModal(false); }}
                      disabled={testing}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2"
                    >
                      {testing ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                      Send
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

export default VendorSettingsPage;