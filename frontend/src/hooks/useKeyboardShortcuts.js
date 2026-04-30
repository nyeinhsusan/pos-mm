/**
 * useKeyboardShortcuts Hook
 *
 * Provides keyboard shortcut functionality for pages.
 * Uses react-hotkeys-hook for key binding.
 *
 * Features:
 * - Global navigation shortcuts (Ctrl+1/2/3/4)
 * - Action shortcuts (Ctrl+K, Ctrl+H, Ctrl+L, Ctrl+F)
 * - Page-specific shortcuts (Enter, Esc, Backspace, +/-, F1-F9)
 * - Prevents default browser shortcuts where needed
 */

import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useCallback } from 'react';

export const useKeyboardShortcuts = (options = {}) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Destructure options with defaults
  const {
    onCompleteSale,
    onClearCart,
    onRemoveLastCartItem,
    onIncreaseQuantity,
    onDecreaseQuantity,
    onAddTopProduct,
    onFocusSearch,
    enableF1toF9 = false,
    enableCartShortcuts = false,
    enableSaleShortcuts = false,
  } = options;

  // Navigation Shortcuts (Global)
  useHotkeys('ctrl+1, meta+1', (e) => {
    e.preventDefault();
    navigate('/pos');
  }, { enableOnFormTags: true });

  useHotkeys('ctrl+2, meta+2', (e) => {
    e.preventDefault();
    navigate('/products');
  }, { enableOnFormTags: true });

  useHotkeys('ctrl+3, meta+3', (e) => {
    e.preventDefault();
    navigate('/reports');
  }, { enableOnFormTags: true });

  useHotkeys('ctrl+4, meta+4', (e) => {
    e.preventDefault();
    navigate('/ai-insights');
  }, { enableOnFormTags: true });

  // Command Palette
  useHotkeys('ctrl+k, meta+k', (e) => {
    e.preventDefault();
    setShowCommandPalette(prev => !prev);
  }, { enableOnFormTags: true });

  // Help Modal
  useHotkeys('ctrl+h, meta+h', (e) => {
    e.preventDefault();
    setShowHelp(prev => !prev);
  }, { enableOnFormTags: true });

  // Logout
  useHotkeys('ctrl+l, meta+l', (e) => {
    e.preventDefault();
    logout();
    navigate('/login');
  }, { enableOnFormTags: true });

  // Focus Search
  useHotkeys('ctrl+f, meta+f', (e) => {
    if (onFocusSearch) {
      e.preventDefault();
      onFocusSearch();
    }
  }, { enableOnFormTags: false });

  // Complete Sale (Enter) - Only on POS page
  useHotkeys('enter', (e) => {
    if (enableSaleShortcuts && onCompleteSale && !e.target.closest('input, textarea, button')) {
      e.preventDefault();
      onCompleteSale();
    }
  }, { enableOnFormTags: false });

  // Clear Cart / Close Modal (Escape)
  useHotkeys('escape', (e) => {
    if (enableCartShortcuts && onClearCart) {
      // Check if there's no modal open
      if (!document.querySelector('[role="dialog"], .modal')) {
        onClearCart();
      }
    }
    // Also close command palette and help
    setShowCommandPalette(false);
    setShowHelp(false);
  }, { enableOnFormTags: true });

  // Remove Last Cart Item (Backspace)
  useHotkeys('backspace', (e) => {
    if (enableCartShortcuts && onRemoveLastCartItem && !e.target.closest('input, textarea')) {
      e.preventDefault();
      onRemoveLastCartItem();
    }
  }, { enableOnFormTags: false });

  // Increase Quantity (+/=)
  useHotkeys('plus, equal', (e) => {
    if (enableCartShortcuts && onIncreaseQuantity && !e.target.closest('input, textarea')) {
      e.preventDefault();
      onIncreaseQuantity();
    }
  }, { enableOnFormTags: false });

  // Decrease Quantity (-)
  useHotkeys('minus', (e) => {
    if (enableCartShortcuts && onDecreaseQuantity && !e.target.closest('input, textarea')) {
      e.preventDefault();
      onDecreaseQuantity();
    }
  }, { enableOnFormTags: false });

  // F1-F9 for Top Products
  if (enableF1toF9 && onAddTopProduct) {
    useHotkeys('f1', (e) => { e.preventDefault(); onAddTopProduct(0); }, { enableOnFormTags: true });
    useHotkeys('f2', (e) => { e.preventDefault(); onAddTopProduct(1); }, { enableOnFormTags: true });
    useHotkeys('f3', (e) => { e.preventDefault(); onAddTopProduct(2); }, { enableOnFormTags: true });
    useHotkeys('f4', (e) => { e.preventDefault(); onAddTopProduct(3); }, { enableOnFormTags: true });
    useHotkeys('f5', (e) => { e.preventDefault(); onAddTopProduct(4); }, { enableOnFormTags: true });
    useHotkeys('f6', (e) => { e.preventDefault(); onAddTopProduct(5); }, { enableOnFormTags: true });
    useHotkeys('f7', (e) => { e.preventDefault(); onAddTopProduct(6); }, { enableOnFormTags: true });
    useHotkeys('f8', (e) => { e.preventDefault(); onAddTopProduct(7); }, { enableOnFormTags: true });
    useHotkeys('f9', (e) => { e.preventDefault(); onAddTopProduct(8); }, { enableOnFormTags: true });
  }

  return {
    showCommandPalette,
    setShowCommandPalette,
    showHelp,
    setShowHelp,
  };
};

export default useKeyboardShortcuts;
