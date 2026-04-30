import React from 'react';

const Receipt = ({ receiptData }) => {
  if (!receiptData) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        No receipt data available
      </div>
    );
  }

  const {
    receipt_number,
    sale_date,
    store,
    items,
    subtotal,
    tax,
    total,
    payments,
    cash_tendered,
    change,
    cashier
  } = receiptData;

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Payment method display names
  const paymentMethodNames = {
    cash: 'Cash',
    card: 'Card',
    kbzpay: 'KBZPay',
    wavepay: 'WavePay',
    ayapay: 'AYA Pay'
  };

  return (
    <div id="receipt-content" className="receipt-container bg-white text-gray-900 p-6 font-mono text-sm max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-4 border-b-2 border-dashed border-gray-300 pb-4">
        <h1 className="text-xl font-bold mb-2 text-gray-900">{store.name}</h1>
        <p className="text-xs whitespace-pre-line text-gray-600 my-2 leading-relaxed">
          {store.address}
        </p>
        {store.phone && (
          <p className="text-xs text-gray-600 mt-1">Tel: {store.phone}</p>
        )}
        {store.email && (
          <p className="text-xs text-gray-600 mt-1">{store.email}</p>
        )}
      </div>

      {/* Receipt Info */}
      <div className="mb-4 text-xs border-b border-dashed border-gray-300 pb-3">
        <div className="flex justify-between mb-1">
          <span className="text-gray-600">Receipt #:</span>
          <span className="font-semibold text-gray-900">{receipt_number}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="text-gray-600">Date:</span>
          <span className="text-gray-900">{formatDate(sale_date)}, {formatTime(sale_date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Cashier:</span>
          <span className="text-gray-900">{cashier}</span>
        </div>
      </div>

      {/* Items */}
      <div className="mb-4">
        <h2 className="font-bold mb-2 text-xs text-gray-900">ITEMS</h2>
        <div className="border-t border-b border-gray-300 py-2">
          {items.map((item, index) => (
            <div key={index} className="mb-2">
              <div className="flex justify-between text-xs text-gray-900">
                <span className="flex-1">{item.product_name}</span>
                <span className="w-16 text-right">x{item.quantity}</span>
                <span className="w-20 text-right">{formatCurrency(item.unit_price)}</span>
                <span className="w-24 text-right font-semibold">{formatCurrency(item.total)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="mb-4 text-xs">
        <div className="flex justify-between mb-1">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-semibold text-gray-900">{formatCurrency(subtotal)} {store.currency}</span>
        </div>
        {tax > 0 && (
          <div className="flex justify-between mb-1">
            <span className="text-gray-600">Tax:</span>
            <span className="font-semibold text-gray-900">{formatCurrency(tax)} {store.currency}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold border-t-2 border-gray-300 pt-2 mt-2 text-gray-900">
          <span>TOTAL:</span>
          <span>{formatCurrency(total)} {store.currency}</span>
        </div>
      </div>

      {/* Payment Details */}
      {payments && payments.length > 0 && (
        <div className="mb-4 border-t-2 border-dashed border-gray-300 pt-3">
          <h2 className="font-bold mb-2 text-xs text-gray-900">PAYMENT DETAILS</h2>
          {payments.map((payment, index) => (
            <div key={index} className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">
                {paymentMethodNames[payment.method] || payment.method}:
              </span>
              <span className="font-semibold text-gray-900">{formatCurrency(payment.amount)} {store.currency}</span>
            </div>
          ))}

          {cash_tendered !== null && (
            <>
              <div className="border-t border-gray-300 mt-2 pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">Cash Tendered:</span>
                  <span className="text-gray-900">{formatCurrency(cash_tendered)} {store.currency}</span>
                </div>
                {change !== null && change > 0 && (
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-900">Change:</span>
                    <span className="text-green-600">
                      {formatCurrency(change)} {store.currency}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center border-t-2 border-dashed border-gray-300 pt-4 mt-4">
        <p className="text-xs whitespace-pre-line text-gray-600 mb-2">
          {store.receipt_footer}
        </p>
        <div className="mt-3 text-xs text-gray-500">
          Powered by POS Myanmar
        </div>
      </div>
    </div>
  );
};

export default Receipt;
