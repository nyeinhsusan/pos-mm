import { useState } from 'react';
import api from '../services/api';

const AddProductModal = ({ isOpen, onClose, onProductAdded }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    cost_price: '',
    stock_quantity: '',
    low_stock_threshold: '10',
    sku: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!formData.name || !formData.price || !formData.cost_price) {
      setError('Name, price, and cost price are required');
      setLoading(false);
      return;
    }

    if (parseFloat(formData.price) < 0 || parseFloat(formData.cost_price) < 0) {
      setError('Price and cost price must be non-negative');
      setLoading(false);
      return;
    }

    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        cost_price: parseFloat(formData.cost_price),
        stock_quantity: formData.stock_quantity
          ? parseInt(formData.stock_quantity)
          : 0,
        low_stock_threshold: formData.low_stock_threshold
          ? parseInt(formData.low_stock_threshold)
          : 10
      };

      const response = await api.post('/products', productData);

      if (response.data.success) {
        onProductAdded(response.data.data);
        handleClose();
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.error?.message || 'Failed to create product';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      category: '',
      price: '',
      cost_price: '',
      stock_quantity: '',
      low_stock_threshold: '10',
      sku: '',
      description: ''
    });
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-500/30 via-purple-500/30 to-pink-500/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto fade-in-up hover-lift">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-gradient-to-r from-blue-400 to-purple-400">
            <h3 className="text-2xl font-bold text-gray-800 flex items-center">
              <span className="mr-3 text-3xl pulse">➕</span>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Add New Product
              </span>
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-red-500 text-2xl transition-all btn-press hover:rotate-90"
            >
              ✕
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 shake">
              <span className="mr-2">⚠️</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 stagger-children">
            {/* Name */}
            <div className="fade-in">
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <span className="mr-2">📦</span>
                Product Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-400 focus:shadow-lg"
                placeholder="e.g., Coca-Cola 500ml"
              />
            </div>

            {/* Category and SKU */}
            <div className="grid grid-cols-2 gap-4">
              <div className="fade-in">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <span className="mr-2">🏷️</span>
                  Category *
                </label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-400 focus:shadow-lg"
                  placeholder="e.g., Beverage"
                />
              </div>
              <div className="fade-in">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <span className="mr-2">🔖</span>
                  SKU
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-400 focus:shadow-lg"
                  placeholder="e.g., COKE-500"
                />
              </div>
            </div>

            {/* Price and Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div className="fade-in">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <span className="mr-2">💰</span>
                  Price (MMK) *
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-400 focus:shadow-lg"
                  placeholder="1500"
                />
              </div>
              <div className="fade-in">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <span className="mr-2">💵</span>
                  Cost Price (MMK) *
                </label>
                <input
                  type="number"
                  name="cost_price"
                  value={formData.cost_price}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-400 focus:shadow-lg"
                  placeholder="1000"
                />
              </div>
            </div>

            {/* Stock Quantity and Threshold */}
            <div className="grid grid-cols-2 gap-4">
              <div className="fade-in">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <span className="mr-2">📊</span>
                  Initial Stock Quantity *
                </label>
                <input
                  type="number"
                  name="stock_quantity"
                  value={formData.stock_quantity}
                  onChange={handleChange}
                  required
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-400 focus:shadow-lg"
                  placeholder="100"
                />
              </div>
              <div className="fade-in">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <span className="mr-2">⚠️</span>
                  Low Stock Threshold *
                </label>
                <input
                  type="number"
                  name="low_stock_threshold"
                  value={formData.low_stock_threshold}
                  onChange={handleChange}
                  required
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-400 focus:shadow-lg"
                  placeholder="10"
                />
              </div>
            </div>

            {/* Description */}
            <div className="fade-in">
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <span className="mr-2">📝</span>
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-400 focus:shadow-lg resize-none"
                placeholder="Product description..."
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6 fade-in-delay-1">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all btn-press hover:shadow-md hover:border-gray-400"
              >
                ❌ Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-2 rounded-lg text-white transition-all btn-press shadow-md ${
                  loading
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg'
                }`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </span>
                ) : (
                  '✨ Create Product'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddProductModal;
