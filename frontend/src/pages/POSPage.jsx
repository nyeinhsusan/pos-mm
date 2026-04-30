import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import api from '../services/api';
import notify from '../services/notificationService';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import ThemeToggle from '../components/ThemeToggle';
import CommandPalette from '../components/CommandPalette';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';
import ShoppingCart from '../components/ShoppingCart';
import SaleSuccessModal from '../components/SaleSuccessModal';
import PaymentModal from '../components/PaymentModal';
import ReceiptModal from '../components/ReceiptModal';
import LowStockBadge from '../components/LowStockBadge';

const POSPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { cart, clearCart, addToCart, removeFromCart, updateQuantity, cartDiscount, itemDiscounts, getCartTotal } = useCart();
  const searchInputRef = useRef(null);

  const [products, setProducts] = useState([]);
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

      const params = {};
      if (selectedCategory) params.category = selectedCategory;

      const response = await api.get('/products', { params });

      if (response.data.success) {
        setProducts(response.data.data);
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

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const uniqueCategories = [
    ...new Set(products.map((p) => p.category).filter(Boolean))
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Navigation Bar */}
      <nav className="bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">POS Myanmar</h1>
              <div className="hidden md:flex space-x-4">
                <button
                  onClick={() => navigate('/pos')}
                  className="text-blue-600 dark:text-blue-400 font-medium px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-900/50 shadow-md"
                >
                  🛒 POS
                </button>
                <button
                  onClick={() => navigate('/products')}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md transition-all hover-lift"
                >
                  📦 Products
                </button>
                {user?.role === 'owner' && (
                  <>
                    <button
                      onClick={() => navigate('/reports')}
                      className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md transition-all hover-lift"
                    >
                      📊 Reports
                    </button>
                    <button
                      onClick={() => navigate('/ai-insights')}
                      className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md transition-all hover-lift"
                    >
                      ✨ AI Insights
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className="text-gray-700 dark:text-gray-300">
                <strong>{user?.full_name}</strong> ({user?.role})
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all btn-press hover:shadow-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Grid - Left/Main Area */}
          <div className="lg:col-span-2 slide-in-left">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover-lift">
              {/* Header */}
              <div className="mb-6 fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    🛍️ Select Products
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

                {/* Quick Tip */}
                {topProducts.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      <strong>💡 Quick Add:</strong> Press <kbd className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded text-xs font-mono">F1</kbd>-<kbd className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded text-xs font-mono">F9</kbd> to add top products instantly | <kbd className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded text-xs font-mono">Ctrl+K</kbd> for command palette
                    </p>
                  </div>
                )}

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Search */}
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="🔍 Search products... (Ctrl+F)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-400 dark:hover:border-blue-500"
                    title="Press Ctrl+F to focus search"
                  />

                  {/* Category Filter */}
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-400 dark:hover:border-blue-500"
                  >
                    <option value="">All Categories</option>
                    {uniqueCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
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
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400 flex items-center justify-center">
                    Loading products
                    <span className="loading-dot ml-1">.</span>
                    <span className="loading-dot">.</span>
                    <span className="loading-dot">.</span>
                  </p>
                </div>
              ) : (
                <>
                  {/* Product Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 stagger-children">
                    {filteredProducts.length === 0 ? (
                      <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
                        No products found
                      </div>
                    ) : (
                      filteredProducts.map((product) => (
                        <ProductCard
                          key={product.product_id}
                          product={product}
                        />
                      ))
                    )}
                  </div>

                  {/* Summary */}
                  <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
                    Showing {filteredProducts.length} of {products.length}{' '}
                    products
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Shopping Cart - Right Sidebar */}
          <div className="lg:col-span-1 slide-in-right">
            <div className="lg:sticky lg:top-8">
              <ShoppingCart
                onCompleteSale={handleCompleteSale}
                loading={saleLoading}
              />
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

  const handleAddToCart = () => {
    if (!isOutOfStock) {
      addToCart(product);
      notify.success(`${product.name} added to cart!`);
    }
  };

  return (
    <div
      onClick={handleAddToCart}
      className={`bg-white dark:bg-gray-700 rounded-lg shadow-md p-4 cursor-pointer transition-all card-hover btn-press ${
        isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {/* Product Name */}
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 truncate">
        🛒 {product.name}
      </h3>

      {/* Category Badge */}
      <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 mb-2">
        {product.category || 'N/A'}
      </span>

      {/* Price */}
      <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-2">
        {parseInt(product.price).toLocaleString()} MMK
      </p>

      {/* Stock Info */}
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
        <span>Stock: {product.stock_quantity}</span>
        <LowStockBadge product={product} />
      </div>

      {/* Add Button */}
      <button
        disabled={isOutOfStock}
        className={`w-full py-2 rounded-lg font-medium transition ${
          isOutOfStock
            ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
      </button>
    </div>
  );
};

export default POSPage;
