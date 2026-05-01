import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import notify from '../services/notificationService';
import AddProductModal from '../components/AddProductModal';
import EditProductModal from '../components/EditProductModal';
import LowStockBadge from '../components/LowStockBadge';
import ProductRecommendationsModal from '../components/ProductRecommendationsModal';
import ThemeToggle from '../components/ThemeToggle';

const ProductsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, showLowStockOnly]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (selectedCategory) params.category = selectedCategory;
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
              <h1 className="text-2xl font-bold text-blue-600">
                POS Myanmar
              </h1>
              <div className="hidden md:flex space-x-4">
                <button
                  onClick={() => navigate('/pos')}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md transition-all hover-lift"
                >
                  🛒 POS
                </button>
                <button
                  onClick={() => navigate('/products')}
                  className="text-blue-600 dark:text-blue-400 font-medium px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-900/50 shadow-md"
                >
                  📦 Products
                </button>
                {user?.role === 'owner' && (
                  <>
                    <button
                      onClick={() => navigate('/promotions')}
                      className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md transition-all hover-lift"
                    >
                      🚀 Promotions
                    </button>
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 fade-in hover-lift">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 fade-in">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              📦 Product Inventory
            </h2>
            {user?.role === 'owner' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all flex items-center btn-press shadow-md hover:shadow-lg"
              >
                <span className="text-xl mr-2">+</span>
                Add Product
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 fade-in-delay-1">
            {/* Search */}
            <input
              type="text"
              placeholder="🔍 Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-400 dark:hover:border-blue-500"
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

            {/* Low Stock Filter */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showLowStockOnly}
                onChange={(e) => setShowLowStockOnly(e.target.checked)}
                className="w-5 h-5 text-blue-600"
              />
              <span className="text-gray-700 dark:text-gray-300">Show Low Stock Only</span>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-4 shake">
              ⚠️ {error}
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400 flex items-center justify-center">
                Loading products
                <span className="loading-dot ml-1">.</span>
                <span className="loading-dot">.</span>
                <span className="loading-dot">.</span>
              </p>
            </div>
          ) : (
            <>
              {/* Products Table */}
              <div className="overflow-x-auto fade-in-delay-2">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Stock
                      </th>
                      {user?.role === 'owner' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 stagger-children">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={user?.role === 'owner' ? 6 : 5}
                          className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                        >
                          No products found
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => (
                        <tr key={product.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:shadow-md cursor-pointer">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {product.name}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {product.sku}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                              {product.category || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {parseInt(product.price).toLocaleString()} MMK
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {parseInt(product.cost_price).toLocaleString()} MMK
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-900 dark:text-gray-100">
                                {product.stock_quantity}
                              </span>
                              <LowStockBadge product={product} />
                            </div>
                          </td>
                          {user?.role === 'owner' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setShowEditModal(true);
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setShowRecommendationsModal(true);
                                }}
                                className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200"
                              >
                                AI Recs
                              </button>
                              <button
                                onClick={() =>
                                  handleDelete(
                                    product.product_id,
                                    product.name
                                  )
                                }
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200"
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
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
