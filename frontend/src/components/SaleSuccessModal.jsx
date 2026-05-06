import { useEffect, useState } from 'react';

const SaleSuccessModal = ({ isOpen, onClose, saleData, onViewReceipt }) => {
  const [autoCloseTimer, setAutoCloseTimer] = useState(3);

  useEffect(() => {
    if (isOpen) {
      // Auto-close after 3 seconds
      let countdown = 3;
      setAutoCloseTimer(countdown);

      const interval = setInterval(() => {
        countdown -= 1;
        setAutoCloseTimer(countdown);
        if (countdown <= 0) {
          clearInterval(interval);
          onClose();
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !saleData) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
      <div className="bg-elevated border border-default rounded-lg shadow-2xl max-w-md w-full p-6 fade-in-up hover-lift">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/40 dark:to-green-800/40 p-3 pulse">
            <div className="text-6xl bounce-slow">✅</div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center mb-4">
          <span className="bg-gradient-to-r from-green-600 to-blue-600 dark:from-green-400 dark:to-blue-400 bg-clip-text text-transparent">
            🎉 Sale Completed!
          </span>
        </h2>

        {/* Sale Details */}
        <div className="space-y-3 mb-6 stagger-children">
          <div className="flex justify-between items-center py-2 border-b border-default fade-in">
            <span className="text-muted flex items-center">
              <span className="mr-2">🔖</span>
              Sale ID:
            </span>
            <span className="font-semibold text-primary">
              #{saleData.sale_id}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-default fade-in">
            <span className="text-muted flex items-center">
              <span className="mr-2">🛒</span>
              Items Sold:
            </span>
            <span className="font-semibold text-primary">
              {saleData.items?.length || 0} items
            </span>
          </div>

          <div className="flex justify-between items-center py-3 bg-section rounded-lg px-3 fade-in glow">
            <span className="text-lg font-medium text-primary flex items-center">
              <span className="mr-2">💰</span>
              Total:
            </span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400 count-up">
              {parseFloat(saleData.total_amount).toLocaleString()} MMK
            </span>
          </div>

          {saleData.profit && (
            <div className="flex justify-between items-center py-2 fade-in">
              <span className="text-muted flex items-center">
                <span className="mr-2">📈</span>
                Profit:
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400 count-up">
                {parseFloat(saleData.profit).toLocaleString()} MMK
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              onViewReceipt(saleData.sale_id);
            }}
            className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white py-3 rounded-lg font-semibold transition-all btn-press shadow-md hover:shadow-lg flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Receipt
          </button>
          <button
            onClick={onClose}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 rounded-lg font-semibold transition-all btn-press shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent"
          >
            ✨ New Sale
          </button>
        </div>

        {/* Auto-close message */}
        <p className="text-center text-sm text-muted mt-3 flex items-center justify-center fade-in-delay-1">
          <span className="mr-2">⏱️</span>
          Auto-closing in {autoCloseTimer} {autoCloseTimer === 1 ? 'second' : 'seconds'}
        </p>
      </div>
    </div>
  );
};

export default SaleSuccessModal;
