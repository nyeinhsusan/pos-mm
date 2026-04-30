import { useState, useEffect } from 'react';

const DISCOUNT_REASONS = [
  { id: 'promotion', label: 'Promotion', icon: '🎁' },
  { id: 'damaged', label: 'Damaged Goods', icon: '📦' },
  { id: 'employee', label: 'Employee Discount', icon: '👤' },
  { id: 'manager', label: 'Manager Discretion', icon: '⭐' },
  { id: 'other', label: 'Other', icon: '📝' }
];

const DiscountModal = ({
  isOpen,
  onClose,
  onApplyDiscount,
  cartItems = [],
  cartTotal = 0,
  currentSaleId = null
}) => {
  const [discountTarget, setDiscountTarget] = useState('cart'); // 'cart' or 'item'
  const [selectedItem, setSelectedItem] = useState(null);
  const [discountType, setDiscountType] = useState('percentage'); // 'percentage' or 'fixed'
  const [discountValue, setDiscountValue] = useState('');
  const [reason, setReason] = useState('promotion');
  const [error, setError] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setDiscountTarget('cart');
      setSelectedItem(null);
      setDiscountType('percentage');
      setDiscountValue('');
      setReason('promotion');
      setError('');
      setIsApplying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getTargetAmount = () => {
    if (discountTarget === 'item' && selectedItem) {
      return selectedItem.subtotal;
    }
    return cartTotal;
  };

  const calculatePreview = () => {
    const targetAmount = getTargetAmount();
    let discountAmount = 0;

    if (discountValue && !isNaN(discountValue)) {
      const value = parseFloat(discountValue);
      if (discountType === 'percentage') {
        discountAmount = targetAmount * (value / 100);
      } else {
        discountAmount = Math.min(value, targetAmount);
      }
    }

    return {
      original: targetAmount,
      discount: discountAmount,
      newTotal: targetAmount - discountAmount
    };
  };

  const preview = calculatePreview();

  const handleApply = async () => {
    // Validation
    if (!discountValue || discountValue <= 0) {
      setError('Please enter a valid discount value');
      return;
    }

    if (discountType === 'percentage' && parseFloat(discountValue) > 100) {
      setError('Percentage cannot exceed 100%');
      return;
    }

    if (discountTarget === 'item' && !selectedItem) {
      setError('Please select an item to discount');
      return;
    }

    setError('');
    setIsApplying(true);

    try {
      const discountData = {
        type: discountType,
        value: parseFloat(discountValue),
        reason,
        sale_item_id: discountTarget === 'item' ? selectedItem?.product_id : null
      };

      await onApplyDiscount(discountData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to apply discount');
    } finally {
      setIsApplying(false);
    }
  };

  const selectedReason = DISCOUNT_REASONS.find(r => r.id === reason);

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 dark:from-red-600 dark:to-orange-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Apply Discount</h2>
              <p className="text-red-100 dark:text-red-200 mt-1">
                {discountTarget === 'cart' ? 'Cart-level discount' : 'Item-level discount'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Discount Target Toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Apply Discount To:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setDiscountTarget('cart');
                  setSelectedItem(null);
                  setError('');
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  discountTarget === 'cart'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-600'
                    : 'border-gray-300 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-700'
                }`}
              >
                <div className="text-2xl mb-1">🛒</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">Entire Cart</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{cartTotal.toLocaleString()} MMK</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscountTarget('item');
                  setError('');
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  discountTarget === 'item'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-600'
                    : 'border-gray-300 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-700'
                }`}
              >
                <div className="text-2xl mb-1">📦</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">Single Item</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Select below</div>
              </button>
            </div>
          </div>

          {/* Item Selection (if item discount) */}
          {discountTarget === 'item' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Select Item:
              </label>
              <div className="max-h-40 overflow-y-auto space-y-2 border dark:border-gray-700 rounded-lg p-2">
                {cartItems.map((item) => (
                  <button
                    key={item.product_id}
                    type="button"
                    onClick={() => {
                      setSelectedItem(item);
                      setError('');
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedItem?.product_id === item.product_id
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-600'
                        : 'border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Qty: {item.quantity} × {item.price.toLocaleString()} MMK
                        </div>
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {item.subtotal.toLocaleString()} MMK
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Discount Type Tabs */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Discount Type:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setDiscountType('percentage');
                  setDiscountValue('');
                  setError('');
                }}
                className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                  discountType === 'percentage'
                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-600 dark:text-red-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-red-300 dark:hover:border-red-700'
                }`}
              >
                Percentage (%)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscountType('fixed');
                  setDiscountValue('');
                  setError('');
                }}
                className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                  discountType === 'fixed'
                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-600 dark:text-red-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-red-300 dark:hover:border-red-700'
                }`}
              >
                Fixed Amount (MMK)
              </button>
            </div>
          </div>

          {/* Discount Value Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {discountType === 'percentage' ? 'Discount Percentage:' : 'Discount Amount (MMK):'}
            </label>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => {
                setDiscountValue(e.target.value);
                setError('');
              }}
              placeholder={discountType === 'percentage' ? 'e.g., 10' : 'e.g., 1000'}
              className="w-full p-4 text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       focus:border-red-500 dark:focus:border-red-600 focus:outline-none"
              min="0"
              max={discountType === 'percentage' ? '100' : undefined}
              step="any"
            />
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Reason:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DISCOUNT_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReason(r.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    reason === r.id
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-600'
                      : 'border-gray-300 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-700'
                  }`}
                >
                  <div className="text-xl mb-1">{r.icon}</div>
                  <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{r.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {discountValue && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Preview:
              </div>
              <div className="flex justify-between text-gray-700 dark:text-gray-300">
                <span>Original:</span>
                <span className="line-through">{preview.original.toLocaleString()} MMK</span>
              </div>
              <div className="flex justify-between text-red-600 dark:text-red-400 font-semibold">
                <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Fixed'}):</span>
                <span>-{preview.discount.toLocaleString()} MMK</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-green-600 dark:text-green-400 pt-2 border-t dark:border-gray-600">
                <span>New Total:</span>
                <span>{preview.newTotal.toLocaleString()} MMK</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-3">
              <div className="flex items-center text-red-700 dark:text-red-300">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-b-lg flex gap-3">
          <button
            onClick={onClose}
            disabled={isApplying}
            className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200
                     rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600
                     transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isApplying || !discountValue}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500
                     dark:from-red-600 dark:to-orange-600 text-white rounded-lg font-semibold
                     hover:from-red-600 hover:to-orange-600 dark:hover:from-red-700 dark:hover:to-orange-700
                     transition-all disabled:opacity-50 disabled:cursor-not-allowed
                     shadow-lg hover:shadow-xl"
          >
            {isApplying ? 'Applying...' : `Apply Discount ${selectedReason?.icon || ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiscountModal;
