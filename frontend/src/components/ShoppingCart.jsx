import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, X, Sparkles, ShoppingBag, Trash2, Tag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import aiService from '../services/aiService';
import DiscountModal from './DiscountModal';

// Helper to get full image URL
const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
  const base = apiBase.replace('/api', '');
  return `${base}${path}`;
};

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
      const item = cart.find(i => i.product_id === discountData.sale_item_id);
      if (item) {
        applyItemDiscount(item.product_id, discountData);
      }
    } else {
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
        const response = await aiService.getRecommendations(cart[0].product_id, 3);
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
    <div className="w-[380px] bg-surface/80 backdrop-blur-3xl border-l border-default h-full flex flex-col rounded-l-xl">
      {/* Cart Header */}
      <div className="p-6 border-b border-default flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-btn-primary-bg text-btn-primary-text rounded-xl flex items-center justify-center shadow-2xl">
            <ShoppingBag size={18} strokeWidth={2.5} />
          </div>
          <h2 className="text-lg font-black tracking-tight uppercase text-primary">Current Order</h2>
        </div>
        <button
          onClick={clearCart}
          className="w-10 h-10 flex items-center justify-center text-muted hover:text-red-500 dark:hover:text-red-400 transition-colors"
          title="Clear Cart"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Cart Items - Horizontal Strip Layout */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-muted py-20 text-center">
            <ShoppingBag size={48} strokeWidth={1} className="mb-4 opacity-20" />
            <p className="text-[8px] font-black uppercase tracking-[0.3em]">Cart Empty</p>
          </div>
        ) : (
          <AnimatePresence>
            {cart.map((item) => (
              <motion.div
                key={item.product_id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex gap-3 p-3 bg-surface border border-default rounded-2xl group/item"
              >
                {/* Product Image */}
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-none border border-default shadow-2xl">
                  {item.image ? (
                    <img
                      src={getImageUrl(item.image)}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-elevated flex items-center justify-center">
                      <span className="text-muted text-xs">N/A</span>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <h4 className="font-black text-[11px] text-primary truncate uppercase">
                    {item.name}
                  </h4>
                  <div className="flex items-center justify-between mt-1">
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2 bg-elevated p-1 px-2 rounded-lg border border-default scale-90 origin-left">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuantityChange(item.product_id, item.quantity, -1);
                        }}
                        className="p-1 text-muted hover:text-btn-primary-text transition-colors"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="text-[10px] font-black min-w-[16px] text-center text-primary">
                        {item.quantity}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuantityChange(item.product_id, item.quantity, 1);
                        }}
                        disabled={item.quantity >= item.stock_quantity}
                        className="p-1 text-muted hover:text-primary transition-colors disabled:opacity-30"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                    {/* Subtotal */}
                    <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-black">
                      {(item.price * item.quantity).toLocaleString()}
                      <span className="opacity-40 text-[8px]"> MMK</span>
                    </span>
                  </div>
                </div>

                {/* Remove Button - appears on hover */}
                <button
                  onClick={() => removeFromCart(item.product_id)}
                  className="text-muted hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100 self-center"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* AI Recommendations */}
      {cart.length > 0 && (
        <div className="border-t border-default p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-muted uppercase tracking-wider">Also bought</h3>
            <Sparkles size={14} className="text-indigo-700 dark:text-indigo-400" />
          </div>

          {loadingRecs ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400 mx-auto"></div>
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
                    stock_quantity: rec.stock_quantity || 0,
                    image: rec.image || null
                  })}
                  className="w-full p-2 bg-surface hover:bg-section border border-default rounded-xl transition text-left flex items-center gap-2"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-elevated flex-none">
                    {rec.image ? (
                      <img src={getImageUrl(rec.image)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted text-[8px]">N/A</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-primary truncate uppercase">{rec.product_name}</p>
                    <p className="text-[8px] text-indigo-700 dark:text-indigo-400">{(rec.confidence * 100).toFixed(0)}% match</p>
                  </div>
                  <Plus size={14} className="text-muted" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted text-center py-2">No recommendations</p>
          )}
        </div>
      )}

      {/* Cart Footer */}
      <div className="p-6 bg-surface border-t border-default flex-shrink-0">
        {/* Discount Display */}
        {(cartDiscount || Object.keys(itemDiscounts).length > 0) && (
          <div className="space-y-2 pb-3 border-b border-default">
            {Object.entries(itemDiscounts).map(([productId, discount]) => {
              const item = cart.find(i => i.product_id === parseInt(productId));
              return (
                <div key={productId} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted truncate max-w-[120px]">
                      {item?.name}
                    </span>
                    <button
                      onClick={() => removeItemDiscount(parseInt(productId))}
                      className="text-red-600 dark:hover:text-red-400 hover:text-red-500"
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <span className="text-red-600 dark:text-red-400 font-black text-[10px]">
                    -{discount.amount.toLocaleString()}
                  </span>
                </div>
              );
            })}

            {cartDiscount && (
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted">
                    Discount
                  </span>
                  <button
                    onClick={removeCartDiscount}
                    className="text-red-600 dark:hover:text-red-400 hover:text-red-500"
                  >
                    <X size={10} />
                  </button>
                </div>
                <span className="text-rose-700 dark:text-rose-400 font-black text-[10px]">
                  -{cartDiscount.amount.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Totals - Reference Style */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted">
            <span>Gross Value</span>
            <span>{getSubtotal().toLocaleString()} MMK</span>
          </div>
          {getTotalDiscount() > 0 && (
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-400">
              <span className="flex items-center gap-2"><Tag size={10} /> Discount</span>
              <span>-{getTotalDiscount().toLocaleString()} MMK</span>
            </div>
          )}
          <div className="flex justify-between items-end pt-3 border-t border-default">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-widest text-muted mb-1">Payable Amount</span>
              <span className="text-3xl font-[1000] tracking-tighter text-primary">{getCartTotal().toLocaleString()}</span>
            </div>
            <span className="text-[10px] font-black text-muted uppercase tracking-widest">MMK</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => setShowDiscountModal(true)}
            disabled={cart.length === 0 || loading}
            className="w-full bg-section hover:bg-elevated border border-default text-primary py-3 rounded-xl font-black text-xs uppercase tracking-wider transition disabled:opacity-30 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <Sparkles size={12} className="text-rose-700 dark:text-rose-400" />
            Apply Discount
          </button>

          <button
            onClick={onCompleteSale}
            disabled={cart.length === 0 || loading}
            className="w-full bg-btn-primary-bg hover:opacity-90 text-btn-primary-text py-3 rounded-xl font-black text-sm uppercase tracking-wider transition disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {loading ? 'Processing...' : 'Complete Sale'}
          </button>

          <button
            onClick={clearCart}
            disabled={cart.length === 0 || loading}
            className="w-full bg-section hover:bg-elevated border border-default text-muted py-3 rounded-xl font-black text-xs uppercase tracking-wider transition disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-accent"
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