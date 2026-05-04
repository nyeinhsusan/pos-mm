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
    notify.info('Logged out successfully. See you soon!');
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
    <div className="min-h-screen bg-[#02040a]">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      {/* Main Content - shifted right by sidebar width */}
      <div className="ml-0 md:ml-20 lg:ml-28 transition-all duration-300">
        {/* Main Content - Full Width */}
        <div className="w-full px-10 py-10">
          <div className="bg-[#0a0e17] border border-[#1a2332] rounded-2xl p-10">
          {/* Header */}
          <div className="flex justify-between items-center mb-8 fade-in">
            <div>
              <h2 className="text-4xl font-black tracking-tighter text-white uppercase">
                Stock Matrix
              </h2>
              <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">
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
                className="w-full px-5 py-3 border border-white/5 bg-white/[0.03] text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:border-indigo-500/50 placeholder:text-slate-500"
              />
            </div>
            <div className="flex items-center space-x-3">
              {/* View Toggle */}
              <div className="flex bg-[#1a2332] rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'grid'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Grid View"
                >
                  <Grid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'list'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="List View"
                >
                  <List size={18} />
                </button>
              </div>
              {user?.role === 'owner' && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-all flex items-center shadow-md hover:shadow-lg"
                >
                  <span className="text-xl mr-2">+</span>
                  Add Product
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-4 mb-10 overflow-x-auto pb-2 custom-scrollbar fade-in-delay-1">
            <button
              onClick={() => setSelectedCategory('')}
              className={`flex-none px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all border ${
                selectedCategory === ''
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_10px_30px_rgba(79,70,229,0.3)]'
                  : 'bg-white/[0.03] border-white/5 text-slate-400 hover:bg-white/5'
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
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_10px_30px_rgba(79,70,229,0.3)]'
                    : 'bg-white/[0.03] border-white/5 text-slate-400 hover:bg-white/5'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Low Stock Filter */}
          <div className="flex items-center space-x-2 cursor-pointer mb-6 fade-in-delay-1">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
              className="w-5 h-5 text-indigo-600 rounded"
            />
            <span className="text-gray-300">Show Low Stock Only</span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 shake">
              {error}
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
              {/* Products Grid */}
              {viewMode === 'grid' && (
                <div className="fade-in-delay-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                  {filteredProducts.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">
                      No products found
                    </div>
                  ) : (
                    filteredProducts.map((product, index) => (
                      <motion.div
                        key={product.product_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden backdrop-blur-xl transition-all hover:border-indigo-500/40 hover:bg-white/[0.05]"
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
                            <div className="w-full h-full bg-[#1a2332] flex items-center justify-center">
                              <span className="text-gray-500 text-xs">No Image</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        </div>

                        {/* Card Content */}
                        <div className="p-4">
                          {/* Category */}
                          <p className="text-[8px] text-indigo-400 uppercase tracking-[0.2em] font-black mb-1">
                            {product.category || 'N/A'}
                          </p>

                          {/* Product Name */}
                          <h3 className="text-sm font-bold text-white truncate">
                            {product.name}
                          </h3>
                          <p className="text-[10px] text-gray-500 mb-3">
                            {product.sku}
                          </p>

                          {/* Price & Stock */}
                          <div className="flex items-end justify-between mb-3">
                            <div>
                              <p className="text-lg font-bold text-white">
                                {parseInt(product.price).toLocaleString()}
                                <span className="text-[8px] font-normal opacity-50 ml-1">MMK</span>
                              </p>
                              <p className="text-[10px] text-gray-500">
                                Cost: {parseInt(product.cost_price).toLocaleString()} MMK
                              </p>
                            </div>
                            {/* Glassmorphism Stock Badge */}
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                              product.stock_quantity < 10
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-emerald-500/10 text-emerald-400'
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
                                className="flex-1 text-xs px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-md text-white transition-colors flex items-center justify-center gap-1"
                              >
                                <Edit2 size={12} />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setShowRecommendationsModal(true);
                                }}
                                className="text-xs px-2 py-1.5 bg-[#1a2332] hover:bg-[#2a3342] rounded-md text-gray-300 transition-colors"
                                title="AI Recommendations"
                              >
                                <Sparkles size={12} />
                              </button>
                              <button
                                onClick={() => handleDelete(product.product_id, product.name)}
                                className="text-xs px-2 py-1.5 bg-rose-900/30 hover:bg-rose-900/50 rounded-md text-rose-400 transition-colors"
                              >
                                <Trash2 size={12} />
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
                  <div className="fade-in-delay-2 bg-[#0a0f1e]/40 border border-white/5 rounded-[3rem] overflow-hidden backdrop-blur-3xl shadow-2xl">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-[0.35em] text-slate-600">
                          <th className="px-10 py-8">Asset Profile</th>
                          <th className="px-10 py-8">Category</th>
                          <th className="px-10 py-8">Valuation</th>
                          <th className="px-10 py-8 text-center">In Stock</th>
                          <th className="px-10 py-8 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredProducts.map((product) => (
                          <tr key={product.product_id} className="group hover:bg-indigo-600/[0.02] transition-colors leading-relaxed">
                            <td className="px-10 py-6">
                              <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden bg-slate-900 border border-white/5 shadow-2xl group/img relative">
                                  {product.image ? (
                                    <img src={getImageUrl(product.image)} className="w-full h-full object-cover transition-transform group-hover/img:scale-125" alt={product.name} referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">N/A</div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-black text-lg tracking-tighter group-hover:text-indigo-400 transition-colors uppercase">{product.name}</p>
                                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Ref: {product.sku}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
                              {product.category || 'N/A'}
                            </td>
                            <td className="px-10 py-6">
                              <p className="font-black text-xl text-white tracking-tighter">{parseInt(product.price).toLocaleString()} <span className="text-[10px] opacity-30 font-bold ml-1">MMK</span></p>
                            </td>
                            <td className="px-10 py-6">
                              <div className="flex flex-col items-center gap-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${product.stock_quantity < 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                  {product.stock_quantity} Units
                                </span>
                                <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                                  <div className={`h-full ${product.stock_quantity < 10 ? 'bg-rose-500 w-1/4' : 'bg-emerald-500 w-full'}`} />
                                </div>
                              </div>
                            </td>
                            <td className="px-10 py-6 text-right">
                              <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                                {user?.role === 'owner' && (
                                  <>
                                    <button onClick={() => { setSelectedProduct(product); setShowEditModal(true); }} className="p-3 bg-white/5 rounded-xl hover:bg-indigo-600/10 hover:text-indigo-400 transition-all border border-transparent hover:border-indigo-500/20"><Edit2 size={18} /></button>
                                    <button onClick={() => handleDelete(product.product_id, product.name)} className="p-3 bg-white/5 rounded-xl hover:bg-rose-600/10 hover:text-rose-400 transition-all border border-transparent hover:border-rose-500/20"><Trash2 size={18} /></button>
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
              <div className="mt-6 text-sm text-gray-400">
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
