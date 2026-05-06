/**
 * LowStockBadge Component
 *
 * Displays visual indicators for product stock status
 * - Low Stock: When stock is at or below threshold
 * - Out of Stock: When stock is 0
 *
 * Future Enhancement: AI-powered stockout predictions
 *
 * @param {Object} product - Product object with stock_quantity and is_low_stock
 * @param {Object} aiPrediction - Optional AI prediction data (future use)
 */
const LowStockBadge = ({ product, aiPrediction = null }) => {
  // Out of Stock - Highest Priority
  if (product.stock_quantity === 0) {
    return (
      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-section text-muted">
        Out of Stock
      </span>
    );
  }

  // AI Prediction (Future Enhancement)
  // If AI predicts stockout within 7 days, show AI-powered warning
  if (aiPrediction && aiPrediction.days_until_stockout <= 7) {
    return (
      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
        Stockout in {aiPrediction.days_until_stockout} days
      </span>
    );
  }

  // Low Stock - Static Threshold Check
  if (product.is_low_stock === 1 || product.is_low_stock === true) {
    return (
      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
        Low Stock
      </span>
    );
  }

  // Normal Stock - No Badge
  return null;
};

export default LowStockBadge;
