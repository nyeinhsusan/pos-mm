/**
 * Notification Service
 *
 * Centralized service for displaying toast notifications throughout the application.
 * Uses react-hot-toast library with custom configurations.
 *
 * Features:
 * - Four notification types: success, error, warning, info
 * - Auto-dismiss after 4 seconds
 * - Max 3 notifications visible at once
 * - Swipe to dismiss on mobile
 * - Custom icons and colors for each type
 */

import toast from 'react-hot-toast';

/**
 * Default notification configuration
 */
const DEFAULT_OPTIONS = {
  duration: 4000, // 4 seconds
  position: 'top-right',
  style: {
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
};

/**
 * Display a success notification
 * @param {string} message - The message to display
 * @param {Object} options - Optional toast configuration
 * @returns {string} Toast ID
 */
export const notifySuccess = (message, options = {}) => {
  return toast.success(message, {
    ...DEFAULT_OPTIONS,
    ...options,
    icon: '✓',
    style: {
      ...DEFAULT_OPTIONS.style,
      background: '#10b981', // green-500
      color: '#ffffff',
    },
  });
};

/**
 * Display an error notification
 * @param {string} message - The message to display
 * @param {Object} options - Optional toast configuration
 * @returns {string} Toast ID
 */
export const notifyError = (message, options = {}) => {
  return toast.error(message, {
    ...DEFAULT_OPTIONS,
    ...options,
    icon: '✗',
    style: {
      ...DEFAULT_OPTIONS.style,
      background: '#ef4444', // red-500
      color: '#ffffff',
    },
  });
};

/**
 * Display a warning notification
 * @param {string} message - The message to display
 * @param {Object} options - Optional toast configuration
 * @returns {string} Toast ID
 */
export const notifyWarning = (message, options = {}) => {
  return toast(message, {
    ...DEFAULT_OPTIONS,
    ...options,
    icon: '⚠',
    style: {
      ...DEFAULT_OPTIONS.style,
      background: '#f59e0b', // yellow-500
      color: '#ffffff',
    },
  });
};

/**
 * Display an info notification
 * @param {string} message - The message to display
 * @param {Object} options - Optional toast configuration
 * @returns {string} Toast ID
 */
export const notifyInfo = (message, options = {}) => {
  return toast(message, {
    ...DEFAULT_OPTIONS,
    ...options,
    icon: 'ℹ',
    style: {
      ...DEFAULT_OPTIONS.style,
      background: '#3b82f6', // blue-500
      color: '#ffffff',
    },
  });
};

/**
 * Display a loading notification
 * @param {string} message - The message to display
 * @param {Object} options - Optional toast configuration
 * @returns {string} Toast ID
 */
export const notifyLoading = (message, options = {}) => {
  return toast.loading(message, {
    ...DEFAULT_OPTIONS,
    ...options,
  });
};

/**
 * Dismiss a specific notification
 * @param {string} toastId - The ID of the toast to dismiss
 */
export const dismissNotification = (toastId) => {
  toast.dismiss(toastId);
};

/**
 * Dismiss all notifications
 */
export const dismissAllNotifications = () => {
  toast.dismiss();
};

/**
 * Promise-based notification
 * Shows loading state, then success or error based on promise result
 * @param {Promise} promise - The promise to track
 * @param {Object} messages - Messages for each state (loading, success, error)
 * @returns {Promise} The original promise
 */
export const notifyPromise = (promise, messages) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading || 'Loading...',
      success: messages.success || 'Success!',
      error: messages.error || 'An error occurred',
    },
    DEFAULT_OPTIONS
  );
};

// Export default object with all methods
export default {
  success: notifySuccess,
  error: notifyError,
  warning: notifyWarning,
  info: notifyInfo,
  loading: notifyLoading,
  promise: notifyPromise,
  dismiss: dismissNotification,
  dismissAll: dismissAllNotifications,
};
