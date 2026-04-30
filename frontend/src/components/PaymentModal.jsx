import { useState, useEffect } from 'react';
import NumericKeypad from './NumericKeypad';
import { calculateDenominationBreakdown } from '../utils/currencyUtils';

const PAYMENT_METHODS = [
  {
    id: 'cash',
    name: 'Cash',
    icon: '💵',
    bgColor: 'bg-green-100 dark:bg-green-900/20',
    borderColor: 'border-green-500 dark:border-green-600',
    textColor: 'text-green-700 dark:text-green-300',
    hoverColor: 'hover:bg-green-200 dark:hover:bg-green-900/40'
  },
  {
    id: 'card',
    name: 'Card',
    icon: '💳',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    borderColor: 'border-blue-500 dark:border-blue-600',
    textColor: 'text-blue-700 dark:text-blue-300',
    hoverColor: 'hover:bg-blue-200 dark:hover:bg-blue-900/40'
  },
  {
    id: 'kbzpay',
    name: 'KBZPay',
    icon: '📱',
    bgColor: 'bg-orange-100 dark:bg-orange-900/20',
    borderColor: 'border-orange-500 dark:border-orange-600',
    textColor: 'text-orange-700 dark:text-orange-300',
    hoverColor: 'hover:bg-orange-200 dark:hover:bg-orange-900/40'
  },
  {
    id: 'wavepay',
    name: 'WavePay',
    icon: '📲',
    bgColor: 'bg-pink-100 dark:bg-pink-900/20',
    borderColor: 'border-pink-500 dark:border-pink-600',
    textColor: 'text-pink-700 dark:text-pink-300',
    hoverColor: 'hover:bg-pink-200 dark:hover:bg-pink-900/40'
  },
  {
    id: 'ayapay',
    name: 'AYA Pay',
    icon: '💰',
    bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    borderColor: 'border-purple-500 dark:border-purple-600',
    textColor: 'text-purple-700 dark:text-purple-300',
    hoverColor: 'hover:bg-purple-200 dark:hover:bg-purple-900/40'
  }
];

const PaymentModal = ({ isOpen, onClose, cartTotal, onPaymentComplete }) => {
  const [splitPayment, setSplitPayment] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(cartTotal);
  const [addedPayments, setAddedPayments] = useState([]);
  const [cashTendered, setCashTendered] = useState('');
  const [error, setError] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSplitPayment(false);
      setSelectedMethod(null);
      setPaymentAmount(cartTotal);
      setAddedPayments([]);
      setCashTendered('');
      setError('');
      setShowSummary(false);
    }
  }, [isOpen, cartTotal]);

  if (!isOpen) return null;

  const remainingAmount = splitPayment
    ? cartTotal - addedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
    : 0;

  const calculateChange = () => {
    if (!cashTendered || cashTendered === '') return 0;
    const tendered = parseFloat(cashTendered);
    const amount = splitPayment ? paymentAmount : cartTotal;
    return Math.max(0, tendered - amount);
  };

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setError('');
    if (!splitPayment) {
      setPaymentAmount(cartTotal);
    } else {
      setPaymentAmount(Math.min(remainingAmount, cartTotal));
    }
  };

  const handleAddPayment = () => {
    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }

    const amount = parseFloat(paymentAmount);

    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount > remainingAmount) {
      setError(`Amount cannot exceed remaining ${remainingAmount.toLocaleString()} MMK`);
      return;
    }

    const newPayment = {
      payment_method: selectedMethod.id,
      amount: amount,
      method_name: selectedMethod.name,
      icon: selectedMethod.icon,
      transaction_id: null
    };

    setAddedPayments([...addedPayments, newPayment]);
    setSelectedMethod(null);
    setCashTendered('');
    setPaymentAmount(0);
    setError('');
  };

  const handleRemovePayment = (index) => {
    setAddedPayments(addedPayments.filter((_, i) => i !== index));
  };

  const handleConfirmPayment = () => {
    let payments = [];

    if (splitPayment) {
      if (addedPayments.length === 0) {
        setError('Please add at least one payment');
        return;
      }

      if (Math.abs(remainingAmount) > 0.01) {
        setError('Total payments must equal sale amount');
        return;
      }

      payments = addedPayments;
    } else {
      // Single payment mode
      if (!selectedMethod) {
        setError('Please select a payment method');
        return;
      }

      // For cash in single payment mode, validate tender amount
      if (selectedMethod.id === 'cash') {
        const tendered = parseFloat(cashTendered);
        if (!tendered || tendered < cartTotal) {
          setError('Tendered amount must be equal to or greater than total');
          return;
        }
      }

      payments = [{
        payment_method: selectedMethod.id,
        amount: cartTotal,
        transaction_id: null
      }];
    }

    // Show summary before finalizing
    setShowSummary(true);
  };

  const handleFinalizePayment = () => {
    let payments = [];

    if (splitPayment) {
      payments = addedPayments;
    } else {
      payments = [{
        payment_method: selectedMethod.id,
        amount: cartTotal,
        transaction_id: null
      }];
    }

    onPaymentComplete(payments);
  };

  const handleQuickAmount = (add) => {
    const current = parseFloat(cashTendered) || 0;
    setCashTendered((current + add).toString());
  };

  // Numeric keypad handlers
  const handleNumericInput = (value) => {
    const newValue = cashTendered + value;
    setCashTendered(newValue);
  };

  const handleClearInput = () => {
    setCashTendered('');
  };

  const handleBackspace = () => {
    setCashTendered(cashTendered.slice(0, -1));
  };

  if (showSummary) {
    const finalPayments = splitPayment ? addedPayments : [{
      payment_method: selectedMethod.id,
      amount: cartTotal,
      method_name: selectedMethod.name,
      icon: selectedMethod.icon
    }];

    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6 fade-in-up">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4 text-center">
            💳 Confirm Payment
          </h2>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
              <span className="font-bold text-xl text-gray-900 dark:text-gray-100">
                {cartTotal.toLocaleString()} MMK
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Methods:</p>
              {finalPayments.map((payment, index) => (
                <div key={index} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">
                    {payment.icon} {payment.method_name}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {parseFloat(payment.amount).toLocaleString()} MMK
                  </span>
                </div>
              ))}
            </div>

            {selectedMethod?.id === 'cash' && parseFloat(cashTendered) > cartTotal && (
              <div className="flex justify-between items-center py-3 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 border-2 border-green-500 dark:border-green-600">
                <span className="text-green-700 dark:text-green-300 font-medium">Change:</span>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {calculateChange().toLocaleString()} MMK
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowSummary(false)}
              className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 py-3 rounded-lg font-semibold transition-all"
            >
              ← Back
            </button>
            <button
              onClick={handleFinalizePayment}
              className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white py-3 rounded-lg font-semibold transition-all btn-press shadow-md hover:shadow-lg"
            >
              ✅ Complete Sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full p-6 fade-in-up max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            💳 Select Payment Method
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Sale Total */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Sale Total:</span>
            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {cartTotal.toLocaleString()} MMK
            </span>
          </div>
          {splitPayment && (
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Remaining:</span>
              <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {remainingAmount.toLocaleString()} MMK
              </span>
            </div>
          )}
        </div>

        {/* Split Payment Toggle */}
        <div className="flex items-center justify-center mb-6">
          <button
            onClick={() => {
              setSplitPayment(!splitPayment);
              setAddedPayments([]);
              setSelectedMethod(null);
              setError('');
            }}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              splitPayment
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {splitPayment ? '✓ Split Payment Mode' : '🔀 Enable Split Payment'}
          </button>
        </div>

        {/* Payment Method Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.id}
              onClick={() => handleMethodSelect(method)}
              className={`${method.bgColor} ${method.borderColor} ${method.textColor} ${method.hoverColor}
                border-2 rounded-lg p-4 transition-all hover-lift cursor-pointer
                ${selectedMethod?.id === method.id ? 'ring-4 ring-offset-2 ring-blue-500 dark:ring-blue-400 scale-105' : ''}
              `}
            >
              <div className="text-4xl mb-2">{method.icon}</div>
              <div className="font-semibold">{method.name}</div>
            </button>
          ))}
        </div>

        {/* Cash Payment Input */}
        {selectedMethod?.id === 'cash' && !splitPayment && (
          <div className="mb-6 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-500 dark:border-green-600">
            {/* Amount Display - Large */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                💵 Amount Tendered:
              </label>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-green-300 dark:border-green-700">
                <div className="text-5xl font-bold text-center text-gray-900 dark:text-gray-100 font-mono">
                  {cashTendered || '0'} <span className="text-2xl text-gray-500">MMK</span>
                </div>
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <button
                onClick={() => setCashTendered(cartTotal.toString())}
                className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg text-sm font-semibold transition-all active:scale-95"
              >
                Exact
              </button>
              <button
                onClick={() => handleQuickAmount(1000)}
                className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg text-sm font-semibold transition-all active:scale-95"
              >
                +1,000
              </button>
              <button
                onClick={() => handleQuickAmount(5000)}
                className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg text-sm font-semibold transition-all active:scale-95"
              >
                +5,000
              </button>
              <button
                onClick={() => handleQuickAmount(10000)}
                className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg text-sm font-semibold transition-all active:scale-95"
              >
                +10,000
              </button>
            </div>

            {/* Numeric Keypad */}
            <NumericKeypad
              onNumberClick={handleNumericInput}
              onClear={handleClearInput}
              onBackspace={handleBackspace}
            />

            {/* Change Display */}
            {cashTendered && parseFloat(cashTendered) >= cartTotal && (
              <div className="mt-4 p-4 bg-white dark:bg-gray-700 rounded-lg border-2 border-green-500 dark:border-green-600">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-lg font-medium text-green-700 dark:text-green-300">Change:</span>
                  <span className="text-4xl font-bold text-green-600 dark:text-green-400">
                    {calculateChange().toLocaleString()} MMK
                  </span>
                </div>

                {/* Denomination Breakdown */}
                {calculateChange() > 0 && (
                  <div className="pt-3 border-t border-green-200 dark:border-green-800">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                      💰 Denomination Breakdown:
                    </div>
                    <div className="text-sm font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      {calculateDenominationBreakdown(calculateChange()).displayText}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Warning for insufficient amount */}
            {cashTendered && parseFloat(cashTendered) < cartTotal && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg border-2 border-red-500 dark:border-red-600">
                <div className="flex items-center text-red-700 dark:text-red-300">
                  <span className="text-2xl mr-2">⚠️</span>
                  <span className="font-semibold">Insufficient amount! Need {(cartTotal - parseFloat(cashTendered)).toLocaleString()} MMK more</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Amount Input for Split Payment (ALL methods including cash) */}
        {splitPayment && selectedMethod && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Amount:
            </label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
              max={remainingAmount}
              placeholder={`Max: ${remainingAmount.toLocaleString()} MMK`}
              className="w-full px-4 py-3 text-xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Enter the amount you want to pay with {selectedMethod.name} (Max: {remainingAmount.toLocaleString()} MMK)
            </p>
          </div>
        )}

        {/* Added Payments List */}
        {splitPayment && addedPayments.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Added Payments:</h3>
            <div className="space-y-2">
              {addedPayments.map((payment, index) => (
                <div key={index} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">
                    {payment.icon} {payment.method_name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {parseFloat(payment.amount).toLocaleString()} MMK
                    </span>
                    <button
                      onClick={() => handleRemovePayment(index)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-bold"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg">
            ⚠️ {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 py-3 rounded-lg font-semibold transition-all"
          >
            Cancel
          </button>

          {splitPayment && selectedMethod ? (
            <button
              onClick={handleAddPayment}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all btn-press shadow-md hover:shadow-lg"
            >
              + Add Payment
            </button>
          ) : null}

          {((splitPayment && addedPayments.length > 0) || (!splitPayment && selectedMethod)) && (
            <button
              onClick={handleConfirmPayment}
              className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white py-3 rounded-lg font-semibold transition-all btn-press shadow-md hover:shadow-lg"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
