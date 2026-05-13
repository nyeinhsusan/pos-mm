import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';
import { Edit2, Trash2, Sparkles, Grid, List } from 'lucide-react';
import api from '../services/api';
import notify from '../services/notificationService';
import Sidebar from '../components/Sidebar';
import AddProductModal from '../components/AddProductModal';
import EditProductModal from '../components/EditProductModal';
import ProductRecommendationsModal from '../components/ProductRecommendationsModal';

// Helper to get full image URL
const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // Use API base URL (strip /api from end)
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  const base = apiBase.replace('/api', '');
  return `${base}${path}`;
};

const ProductsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRecommendationsModal, setShowRecommendationsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  useEffect(() => {
    fetchProducts();
  }, [showLowStockOnly]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (showLowStockOnly) params.low_stock = true;

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDelete = async (productId, productName) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}"?`)) {
      return;
    }

    try {
      const response = await api.delete(`/products/${productId}`);

      if (response.data.success) {
        setProducts(products.filter((p) => p.product_id !== productId));
        notify.success(`${productName} deleted successfully`);
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.error?.details || 'Failed to delete product';
      notify.error(errorMsg);
    }
  };

  const handleProductAdded = (newProduct) => {
    setProducts([...products, newProduct]);
    setShowAddModal(false);
    notify.success(`${newProduct.name} added successfully!`);
  };

  const handleProductUpdated = (updatedProduct) => {
    setProducts(
      products.map((p) =>
        p.product_id === updatedProduct.product_id ? updatedProduct : p
      )
    );
    setShowEditModal(false);
    setSelectedProduct(null);
    notify.success(`${updatedProduct.name} updated successfully!`);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === '' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const uniqueCategories = [
    ...new Set(products.map((p) => p.category).filter(Boolean))
  ].sort();

  return (
    <div className="min-h-screen bg-page">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      {/* Main Content - shifted right by sidebar width */}
      <div className="ml-0 md:ml-20 lg:ml-28 transition-all duration-300">
        {/* Main Content - Full Width */}
        <div className="w-full px-12 py-12">
          <div className="bg-surface border border-default rounded-2xl p-14">
          {/* Header */}
          <div className="flex justify-between items-center mb-12 fade-in">
            <div>
              <h2 className="text-4xl font-black tracking-tighter text-primary uppercase">
                Stock Matrix
              </h2>
              <p className="text-sm text-muted font-bold uppercase tracking-widest mt-1">
                Asset management and supply optimization
              </p>
            </div>
            {/* Search in Header */}
            <div className="w-full max-w-md">
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-5 py-3 border border-default bg-surface text-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted"
              />
            </div>
            <div className="flex items-center space-x-3">
              {/* View Toggle */}
              <div className="flex bg-section rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-accent ${
                    viewMode === 'grid'
                      ? 'bg-btn-primary-bg text-btn-primary-text'
                      : 'text-muted hover:text-primary'
                  }`}
                  title="Grid View"
                >
                  <Grid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-accent ${
                    viewMode === 'list'
                      ? 'bg-btn-primary-bg text-btn-primary-text'
                      : 'text-muted hover:text-primary'
                  }`}
                  title="List View"
                >
                  <List size={18} />
                </button>
              </div>
              {user?.role === 'owner' && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-btn-primary-bg hover:opacity-90 text-btn-primary-text px-4 py-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-accent flex items-center shadow-md hover:shadow-lg"
                >
                  <span className="text-xl mr-2">+</span>
                  Add Product
                </button>
              )}
            </div>
          </div>
        </div>

          {/* Category Tabs */}
          <div className="flex gap-4 mt-4 mb-14 overflow-x-auto pb-3 custom-scrollbar fade-in-delay-1">
            <button
              onClick={() => setSelectedCategory('')}
              className={`flex-none px-8 py-3.5 rounded-full text-[11px] font-black uppercase tracking-[0.15em] transition-all border focus:outline-none focus:ring-2 focus:ring-accent ${
                selectedCategory === ''
                  ? 'bg-btn-primary-bg text-btn-primary-text border-transparent'
                  : 'bg-surface border-default text-muted hover:bg-elevated hover:text-primary'
              }`}
            >
              All
            </button>
            {uniqueCategories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`flex-none px-8 py-3.5 rounded-full text-[11px] font-black uppercase tracking-[0.15em] transition-all border focus:outline-none focus:ring-2 focus:ring-accent ${
                  selectedCategory === category
                    ? 'bg-btn-primary-bg text-btn-primary-text border-transparent'
                    : 'bg-surface border-default text-muted hover:bg-elevated hover:text-primary'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Low Stock Filter */}
          <div className="flex items-center space-x-2 cursor-pointer mb-8 fade-in-delay-1">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
              className="w-5 h-5 accent-[var(--color-btn-primary-bg)] rounded focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <span className="text-primary">Show Low Stock Only</span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-4 shake">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
              <p className="mt-4 text-muted flex items-center justify-center">
                Loading products
                <span className="loading-dot ml-1">.</span>
                <span className="loading-dot">.</span>
                <span className="loading-dot">.</span>
              </p>
            </div>
          ) : (
            <>
              {/* Products Grid */}
              {viewMode === 'grid' && (
                <div className="fade-in-delay-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                  {filteredProducts.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted">
                      No products found
                    </div>
                  ) : (
                    filteredProducts.map((product, index) => (
                      <motion.div
                        key={product.product_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group bg-elevated border border-default rounded-2xl overflow-hidden transition-all hover:border-accent hover:bg-section"
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
                            <div className="w-full h-full bg-elevated flex items-center justify-center">
                              <span className="text-muted text-xs">No Image</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        </div>

                        {/* Card Content */}
                        <div className="p-4">
                          {/* Category */}
                          <p className="text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-[0.2em] font-black mb-1">
                            {product.category || 'N/A'}
                          </p>

                          {/* Product Name */}
                          <h3 className="text-base font-bold text-primary truncate">
                            {product.name}
                          </h3>
                          <p className="text-xs text-muted mb-3">
                            {product.sku}
                          </p>

                          {/* Price & Stock */}
                          <div className="flex items-end justify-between mb-3">
                            <div>
                              <p className="text-xl font-bold text-primary">
                                {parseInt(product.price).toLocaleString()}
                                <span className="text-xs font-normal opacity-50 ml-1">MMK</span>
                              </p>
                              <p className="text-xs text-muted">
                                Cost: {parseInt(product.cost_price).toLocaleString()} MMK
                              </p>
                            </div>
                            {/* Glassmorphism Stock Badge */}
                            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-widest ${
                              product.stock_quantity < 10
                                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            }`}>
                              {product.stock_quantity}
                            </div>
                          </div>

                          {/* Compact Action Buttons */}
                          {user?.role === 'owner' && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setShowEditModal(true);
                                }}
                                className="flex-1 text-sm px-3 py-2 bg-btn-primary-bg hover:opacity-90 rounded-md text-btn-primary-text focus:outline-none focus:ring-2 focus:ring-accent transition-all flex items-center justify-center gap-1.5"
                              >
                                <Edit2 size={14} />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setShowRecommendationsModal(true);
                                }}
                                className="text-sm px-3 py-2 bg-section hover:bg-elevated border border-default rounded-md text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
                                title="AI Recommendations"
                              >
                                <Sparkles size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(product.product_id, product.name)}
                                className="text-sm px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-md text-rose-700 dark:text-rose-400 focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                    )}
                  </div>
                )}

                {/* List View - Full Width Table */}
                {viewMode === 'list' && (
                  <div className="fade-in-delay-2 bg-surface border border-default rounded-[3rem] overflow-x-auto shadow-2xl">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-default text-xs font-black uppercase tracking-[0.35em] text-muted">
                          <th className="px-10 py-8">Asset Profile</th>
                          <th className="px-10 py-8">Category</th>
                          <th className="px-10 py-8">Valuation</th>
                          <th className="px-10 py-8 text-center">In Stock</th>
                          <th className="px-10 py-8 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-default)]">
                        {filteredProducts.map((product) => (
                          <tr key={product.product_id} className="group hover:bg-section transition-colors leading-relaxed">
                            <td className="px-10 py-6">
                              <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden bg-elevated border border-default shadow-2xl group/img relative">
                                  {product.image ? (
                                    <img src={getImageUrl(product.image)} className="w-full h-full object-cover transition-transform group-hover/img:scale-125" alt={product.name} referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted text-xs">N/A</div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-black text-lg tracking-tighter text-primary group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors uppercase">{product.name}</p>
                                  <p className="text-xs text-muted font-black uppercase tracking-widest mt-1">Ref: {product.sku}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-10 py-6 text-sm font-black uppercase tracking-widest text-muted italic">
                              {product.category || 'N/A'}
                            </td>
                            <td className="px-10 py-6">
                              <p className="font-black text-xl text-primary tracking-tighter">{parseInt(product.price).toLocaleString()} <span className="text-xs opacity-30 font-bold ml-1">MMK</span></p>
                            </td>
                            <td className="px-10 py-6">
                              <div className="flex flex-col items-center gap-2">
                                <span className={`text-xs font-black uppercase tracking-widest ${product.stock_quantity < 10 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                  {product.stock_quantity} Units
                                </span>
                                <div className="w-20 h-1 bg-elevated rounded-full overflow-hidden">
                                  <div className={`h-full ${product.stock_quantity < 10 ? 'bg-rose-500 w-1/4' : 'bg-emerald-500 w-full'}`} />
                                </div>
                              </div>
                            </td>
                            <td className="px-10 py-6 text-right">
                              <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                                {user?.role === 'owner' && (
                                  <>
                                    <button onClick={() => { setSelectedProduct(product); setShowEditModal(true); }} className="p-3 bg-elevated rounded-xl hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-400 transition-all border border-transparent hover:border-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-accent"><Edit2 size={18} /></button>
                                    <button onClick={() => handleDelete(product.product_id, product.name)} className="p-3 bg-elevated rounded-xl hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-400 transition-all border border-transparent hover:border-rose-500/20 focus:outline-none focus:ring-2 focus:ring-accent"><Trash2 size={18} /></button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              {/* Summary */}
              <div className="mt-6 text-sm text-muted">
                Showing {filteredProducts.length} of {products.length} products
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onProductAdded={handleProductAdded}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onProductUpdated={handleProductUpdated}
      />

      {/* Product Recommendations Modal */}
      <ProductRecommendationsModal
        isOpen={showRecommendationsModal}
        onClose={() => {
          setShowRecommendationsModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
      />
    </div>
  );
};

export default ProductsPage;
