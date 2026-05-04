import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import notify from '../services/notificationService';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import Sidebar from '../components/Sidebar';
import CommandPalette from '../components/CommandPalette';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';
import ShoppingCart from '../components/ShoppingCart';
import SaleSuccessModal from '../components/SaleSuccessModal';
import PaymentModal from '../components/PaymentModal';
import ReceiptModal from '../components/ReceiptModal';
import LowStockBadge from '../components/LowStockBadge';

// Helper to get full image URL
const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
  const base = apiBase.replace('/api', '');
  return `${base}${path}`;
};

const POSPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { cart, clearCart, addToCart, removeFromCart, updateQuantity, cartDiscount, itemDiscounts, getCartTotal } = useCart();
  const { isDark, toggleTheme } = useTheme();
  const searchInputRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saleLoading, setSaleLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [saleData, setSaleData] = useState(null);
  const [receiptSaleId, setReceiptSaleId] = useState(null);
  const [topProducts, setTopProducts] = useState([]);

  // Keyboard shortcuts handlers
  const handleRemoveLastCartItem = () => {
    if (cart.length > 0) {
      const lastItem = cart[cart.length - 1];
      removeFromCart(lastItem.product_id);
      notify.info(`Removed ${lastItem.name} from cart`);
    }
  };

  const handleIncreaseQuantity = () => {
    if (cart.length > 0) {
      const lastItem = cart[cart.length - 1];
      updateQuantity(lastItem.product_id, lastItem.quantity + 1);
      notify.success(`Increased ${lastItem.name} quantity`);
    }
  };

  const handleDecreaseQuantity = () => {
    if (cart.length > 0) {
      const lastItem = cart[cart.length - 1];
      if (lastItem.quantity > 1) {
        updateQuantity(lastItem.product_id, lastItem.quantity - 1);
        notify.info(`Decreased ${lastItem.name} quantity`);
      }
    }
  };

  const handleAddTopProduct = (index) => {
    if (topProducts[index]) {
      const product = topProducts[index];
      addToCart(product);
      notify.success(`${product.name} added to cart! (F${index + 1})`);
    }
  };

  const handleFocusSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleClearCart = () => {
    if (cart.length > 0) {
      clearCart();
      notify.info('Cart cleared');
    }
  };

  const handleCompleteSale = () => {
    if (cart.length === 0) return;
    // Open payment modal instead of directly completing sale
    setShowPaymentModal(true);
  };

  const handlePaymentComplete = async (payments) => {
    if (cart.length === 0) return;

    setSaleLoading(true);
    setError('');
    setShowPaymentModal(false);

    try {
      // Format items for API
      const items = cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity
      }));

      // Format discounts for API
      const discounts = {};

      // Add cart discount if exists
      if (cartDiscount) {
        discounts.cart = cartDiscount;
      }

      // Add item discounts if exist
      if (itemDiscounts && Object.keys(itemDiscounts).length > 0) {
        discounts.items = itemDiscounts;
      }

      const response = await api.post('/sales', {
        items,
        payments,
        notes: `POS sale by ${user.full_name}`,
        discounts: Object.keys(discounts).length > 0 ? discounts : undefined
      });

      if (response.data.success) {
        setSaleData(response.data.data);
        setShowSuccessModal(true);
        clearCart();

        // Show success notification
        notify.success(`Sale completed successfully! Total: ${parseInt(response.data.data.total_amount).toLocaleString()} MMK 🎉`);

        // Update product stock levels in UI
        if (response.data.data.items) {
          setProducts((prevProducts) =>
            prevProducts.map((product) => {
              const soldItem = response.data.data.items.find(
                (item) => item.product_id === product.product_id
              );
              if (soldItem) {
                return {
                  ...product,
                  stock_quantity: soldItem.updated_stock
                };
              }
              return product;
            })
          );
        }
      }
    } catch (err) {
      console.error('Complete sale error:', err);
      const errorMsg =
        err.response?.data?.error?.details || 'Failed to complete sale';
      setError(errorMsg);
      notify.error(errorMsg);
    } finally {
      setSaleLoading(false);
    }
  };

  const handleViewReceipt = (saleId) => {
    setReceiptSaleId(saleId);
    setShowReceiptModal(true);
  };

  const handleLogout = () => {
    logout();
    notify.info('Logged out successfully. See you soon!');
    navigate('/login');
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const params = { include_promotions: true }; // Include promotions
      if (selectedCategory) params.category = selectedCategory;

      const response = await api.get('/products', { params });

      if (response.data.success) {
        setProducts(response.data.data);
        // Store all products when no category filter is applied
        if (!selectedCategory) {
          setAllProducts(response.data.data);
        }
      }
    } catch (err) {
      console.error('Fetch products error:', err);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Initialize keyboard shortcuts
  const { showCommandPalette, setShowCommandPalette, showHelp, setShowHelp } = useKeyboardShortcuts({
    onCompleteSale: handleCompleteSale,
    onClearCart: handleClearCart,
    onRemoveLastCartItem: handleRemoveLastCartItem,
    onIncreaseQuantity: handleIncreaseQuantity,
    onDecreaseQuantity: handleDecreaseQuantity,
    onAddTopProduct: handleAddTopProduct,
    onFocusSearch: handleFocusSearch,
    enableF1toF9: true,
    enableCartShortcuts: true,
    enableSaleShortcuts: true,
  });

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  // Fetch top 9 products for F1-F9 shortcuts
  useEffect(() => {
    const fetchTopProducts = async () => {
      try {
        // For now, just use the first 9 products sorted by name
        // TODO: Replace with actual top products endpoint when available
        if (products.length > 0) {
          setTopProducts(products.slice(0, 9));
        }
      } catch (err) {
        console.error('Failed to fetch top products:', err);
      }
    };
    fetchTopProducts();
  }, [products]);

  const filteredProducts = products.filter((product) => {
    const productName = product.name || '';
    const searchLower = searchTerm.toLowerCase();
    return productName.toLowerCase().includes(searchLower);
  });

  const uniqueCategories = [
    ...new Set((allProducts.length > 0 ? allProducts : products).map((p) => p.category?.trim()).filter(Boolean))
  ].sort();

  return (
    <div className="min-h-screen bg-[#02040a]">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      {/* Main Content - shifted right by sidebar width */}
      <div className="ml-24 transition-all duration-300">
        {/* Main Content - Full Width */}
        <div className="py-8 pl-4">
          <div className="flex gap-0">
            {/* Product Grid - Left/Main Area */}
            <div className="flex-1 slide-in-left px-12">
                {/* Header */}
                <div className="mb-8 fade-in">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">
                      Select Products
                    </h2>
                  <button
                    onClick={() => setShowHelp(true)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
                    title="View keyboard shortcuts"
                  >
                    <span>⌨️</span>
                    <span>Shortcuts (Ctrl+H)</span>
                  </button>
                </div>

                {/* Search Bar - Top */}
                <div className="relative w-full max-w-2xl mb-6 group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={22} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search products... (Ctrl+F)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/5 rounded-[1.5rem] py-4 pl-14 pr-6 outline-none focus:border-indigo-500/50 focus:bg-white/5 transition-all text-sm font-medium placeholder:text-slate-600 text-white"
                    title="Press Ctrl+F to focus search"
                  />
                </div>

                {/* Quick Tip */}
                {topProducts.length > 0 && (
                  <div className="mb-4 p-3 bg-indigo-900/20 border border-indigo-800 rounded-lg">
                    <p className="text-sm text-indigo-300">
                      <strong>Quick Add:</strong> Press <kbd className="px-1.5 py-0.5 bg-indigo-900 border border-indigo-700 rounded text-xs font-mono">F1</kbd>-<kbd className="px-1.5 py-0.5 bg-indigo-900 border border-indigo-700 rounded text-xs font-mono">F9</kbd> to add top products instantly | <kbd className="px-1.5 py-0.5 bg-indigo-900 border border-indigo-700 rounded text-xs font-mono">Ctrl+K</kbd> for command palette
                    </p>
                  </div>
                )}

                {/* Promotion Banner - Reduced by 40% */}
                <div className="mb-6 p-4 bg-gradient-to-r from-indigo-900/60 via-purple-900/60 to-indigo-900/60 border border-indigo-500/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🎉</span>
                      <div>
                        <p className="text-sm font-bold text-white">Flash Sale!</p>
                        <p className="text-xs text-indigo-300">Get 20% off on all Electronics until midnight</p>
                      </div>
                    </div>
                    <button className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-full transition-colors">
                      Shop Now
                    </button>
                  </div>
                </div>

                {/* Category Tabs */}
                <div className="flex gap-4 mb-8 overflow-x-auto pb-2 custom-scrollbar">
                  <button
                    onClick={() => setSelectedCategory('')}
                    className={`flex-none px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all border ${
                      selectedCategory === ''
                        ? 'bg-white text-black border-white shadow-[0_10px_30px_rgba(255,255,255,0.1)]'
                        : 'bg-white/[0.03] border-white/5 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    All
                  </button>
                  {uniqueCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`flex-none px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all border ${
                        selectedCategory === category
                          ? 'bg-white text-black border-white shadow-[0_10px_30px_rgba(255,255,255,0.1)]'
                          : 'bg-white/[0.03] border-white/5 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-4 shake">
                  ⚠️ {error}
                </div>
              )}

              {/* Loading State */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
                  <p className="mt-4 text-gray-400 flex items-center justify-center">
                    Loading products
                    <span className="loading-dot ml-1">.</span>
                    <span className="loading-dot">.</span>
                    <span className="loading-dot">.</span>
                  </p>
                </div>
              ) : (
                <>
                  {/* Product Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8 stagger-children">
                    {filteredProducts.length === 0 ? (
                      <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
                        <span className="text-gray-500">No products found</span>
                      </div>
                    ) : (
                      filteredProducts.map((product, index) => (
                        <motion.div
                          key={product.product_id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <ProductCard
                            product={product}
                          />
                        </motion.div>
                      ))
                    )}
                  </div>

                  {/* Summary */}
                  <div className="mt-6 text-sm text-gray-400">
                    Showing {filteredProducts.length} of {products.length}{' '}
                    products
                  </div>
                </>
              )}
            </div>

            {/* Shopping Cart - Right Sidebar */}
            <div className="w-[380px] flex-shrink-0 slide-in-right">
              <div className="lg:sticky lg:top-8">
                <ShoppingCart
                  onCompleteSale={handleCompleteSale}
                  loading={saleLoading}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        cartTotal={getCartTotal()}
        onPaymentComplete={handlePaymentComplete}
      />

      {/* Sale Success Modal */}
      <SaleSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        saleData={saleData}
        onViewReceipt={handleViewReceipt}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        saleId={receiptSaleId}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={(path) => navigate(path)}
        onAction={(action) => {
          if (action === 'help') {
            setShowHelp(true);
          } else if (action === 'focusSearch') {
            handleFocusSearch();
          }
        }}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
};

// Product Card Component
const ProductCard = ({ product }) => {
  const { addToCart } = useCart();

  const isOutOfStock = product.stock_quantity === 0;
  const hasPromotion = product.has_promotion;
  const discount = product.discount || 0;

  const handleAddToCart = () => {
    if (!isOutOfStock) {
      addToCart(product);
      if (hasPromotion) {
        notify.success(`${product.name} added with ${product.promotion.discount_value}${product.promotion.discount_type === 'percentage' ? '%' : ' MMK'} discount!`);
      } else {
        notify.success(`${product.name} added to cart!`);
      }
    }
  };

  // Get display price - use promotional_price if there's a promotion
  const displayPrice = hasPromotion ? product.promotional_price : product.price;
  const originalPrice = hasPromotion ? product.original_price : product.price;

  return (
    <div
      onClick={handleAddToCart}
      className={`group bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden cursor-pointer backdrop-blur-xl transition-all hover:border-indigo-500/40 hover:bg-white/[0.05] ${
        isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden">
        {product.image ? (
          <img
            src={getImageUrl(product.image)}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <span className="text-gray-500 text-xs">No Image</span>
          </div>
        )}
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Discount Badge */}
        {discount > 0 && (
          <div className="absolute top-4 left-4 px-3 py-1 bg-indigo-600 rounded-full text-[8px] font-black text-white shadow-xl">
            {discount}%
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-5">
        {/* Category */}
        <p className="text-[8px] text-indigo-400 uppercase tracking-[0.25em] font-black mb-1">
          {product.category || 'N/A'}
        </p>

        {/* Product Name */}
        <h3 className="text-xs font-black text-white leading-tight uppercase truncate">
          {product.name}
        </h3>

        {/* Price and Add Button */}
        <div className="mt-4 pt-4 border-t border-white/5 flex items-end justify-between">
          <div>
            {hasPromotion && originalPrice !== displayPrice && (
              <p className="text-[8px] text-gray-500 line-through">
                {parseInt(originalPrice).toLocaleString()}
              </p>
            )}
            <p className="text-sm font-[1000] tracking-tighter text-white whitespace-nowrap">
              {parseInt(displayPrice).toLocaleString()}{' '}
              <span className="text-[8px] font-bold opacity-30 ml-0.5">MMK</span>
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <Plus size={14} strokeWidth={3} />
          </div>
        </div>

        {/* Stock Info */}
        <div className="flex items-center justify-between text-[10px] text-gray-500 mt-3">
          <span>Stock: {product.stock_quantity}</span>
          <LowStockBadge product={product} />
        </div>
      </div>
    </div>
  );
};

export default POSPage;
