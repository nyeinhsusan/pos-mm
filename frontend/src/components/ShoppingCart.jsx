import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import aiService from '../services/aiService';
import DiscountModal from './DiscountModal';

const ShoppingCart = ({ onCompleteSale, loading }) => {
  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    getCartTotal,
    getItemCount,
    clearCart,
    cartDiscount,
    itemDiscounts,
    applyCartDiscount,
    applyItemDiscount,
    removeCartDiscount,
    removeItemDiscount,
    getSubtotal,
    getTotalDiscount
  } = useCart();
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  const handleQuantityChange = (product_id, currentQuantity, change) => {
    const newQuantity = currentQuantity + change;
    if (newQuantity > 0) {
      updateQuantity(product_id, newQuantity);
    }
  };

  const handleApplyDiscount = (discountData) => {
    if (discountData.sale_item_id) {
      // Item-level discount
      const item = cart.find(i => i.product_id === discountData.sale_item_id);
      if (item) {
        applyItemDiscount(item.product_id, discountData);
      }
    } else {
      // Cart-level discount
      applyCartDiscount(discountData);
    }
    setShowDiscountModal(false);
  };

  // Fetch AI recommendations based on cart items
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (cart.length === 0) {
        setRecommendations([]);
        return;
      }

      setLoadingRecs(true);
      try {
        // Get recommendations for the first product in cart
        const response = await aiService.getRecommendations(cart[0].product_id, 3);

        // Filter out products already in cart
        const cartProductIds = cart.map(item => item.product_id);
        const filtered = response.data.recommendations
          ? response.data.recommendations
              .filter(rec => !cartProductIds.includes(rec.product_id))
              .slice(0, 3)
          : [];

        setRecommendations(filtered);
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
        setRecommendations([]);
      } finally {
        setLoadingRecs(false);
      }
    };

    fetchRecommendations();
  }, [cart]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-full flex flex-col">
      {/* Cart Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Shopping Cart</h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">{getItemCount()} items</span>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto mb-6 space-y-4">
        {cart.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">No items in cart</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Click on products to add them to cart
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.product_id}
              className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              {/* Product Info */}
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {item.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {item.price.toLocaleString()} MMK
                </p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    handleQuantityChange(item.product_id, item.quantity, -1)
                  }
                  className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-100 font-bold transition"
                >
                  -
                </button>
                <span className="w-8 text-center font-medium text-gray-900 dark:text-gray-100">
                  {item.quantity}
                </span>
                <button
                  onClick={() =>
                    handleQuantityChange(item.product_id, item.quantity, 1)
                  }
                  disabled={item.quantity >= item.stock_quantity}
                  className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>

              {/* Subtotal */}
              <div className="text-right w-20">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {(item.price * item.quantity).toLocaleString()}
                </p>
              </div>

              {/* Remove Button */}
              <button
                onClick={() => removeFromCart(item.product_id)}
                className="text-red-600 hover:text-red-800 transition"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* AI Recommendations */}
      {cart.length > 0 && (
        <div className="border-t border-b border-gray-200 dark:border-gray-700 py-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Customers also bought</h3>
            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
            </svg>
          </div>

          {loadingRecs ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-2">
              {recommendations.map((rec) => (
                <button
                  key={rec.product_id}
                  onClick={() => addToCart({
                    product_id: rec.product_id,
                    name: rec.product_name,
                    price: rec.price || 0,
                    stock_quantity: rec.stock_quantity || 0
                  })}
                  className="w-full p-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition text-left border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{rec.product_name}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">{(rec.confidence * 100).toFixed(0)}% bought together</p>
                    </div>
                    <div className="ml-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">No recommendations available</p>
          )}
        </div>
      )}

      {/* Cart Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
        {/* Discount Display */}
        {(cartDiscount || Object.keys(itemDiscounts).length > 0) && (
          <div className="space-y-2 pb-3 border-b border-gray-200 dark:border-gray-700">
            {/* Item Discounts */}
            {Object.entries(itemDiscounts).map(([productId, discount]) => {
              const item = cart.find(i => i.product_id === parseInt(productId));
              return (
                <div key={productId} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">
                      Discount on {item?.name}
                    </span>
                    <button
                      onClick={() => removeItemDiscount(parseInt(productId))}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    -{discount.amount.toLocaleString()} MMK
                  </span>
                </div>
              );
            })}

            {/* Cart Discount */}
            {cartDiscount && (
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    Cart Discount ({cartDiscount.type === 'percentage' ? `${cartDiscount.value}%` : 'Fixed'})
                  </span>
                  <button
                    onClick={removeCartDiscount}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    ✕
                  </button>
                </div>
                <span className="text-red-600 dark:text-red-400 font-medium">
                  -{cartDiscount.amount.toLocaleString()} MMK
                </span>
              </div>
            )}
          </div>
        )}

        {/* Subtotal (if discount applied) */}
        {getTotalDiscount() > 0 && (
          <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
            <span>Subtotal:</span>
            <span className="line-through">{getSubtotal().toLocaleString()} MMK</span>
          </div>
        )}

        {/* Total Discount */}
        {getTotalDiscount() > 0 && (
          <div className="flex justify-between items-center text-red-600 dark:text-red-400 font-semibold">
            <span>Total Discount:</span>
            <span>-{getTotalDiscount().toLocaleString()} MMK</span>
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center text-xl font-bold">
          <span className="text-gray-800 dark:text-gray-100">Total:</span>
          <span className="text-blue-600 dark:text-blue-400">
            {getCartTotal().toLocaleString()} MMK
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Apply Discount Button */}
          <button
            onClick={() => setShowDiscountModal(true)}
            disabled={cart.length === 0 || loading}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>🎁</span>
            Apply Discount
          </button>

          <button
            onClick={onCompleteSale}
            disabled={cart.length === 0 || loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Complete Sale'}
          </button>
          <button
            onClick={clearCart}
            disabled={cart.length === 0 || loading}
            className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100 py-2 rounded-lg font-medium transition disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
          >
            Clear Cart
          </button>
        </div>
      </div>

      {/* Discount Modal */}
      <DiscountModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        onApplyDiscount={handleApplyDiscount}
        cartItems={cart}
        cartTotal={getSubtotal()}
      />
    </div>
  );
};

export default ShoppingCart;
