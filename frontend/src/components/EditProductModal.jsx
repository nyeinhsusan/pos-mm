import { useState, useEffect } from 'react';
import api from '../services/api';
import { uploadProductImage } from '../services/api';

// Helper to get full image URL
const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // Use API base URL (strip /api from end)
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  const base = apiBase.replace('/api', '');
  return `${base}${path}`;
};

const EditProductModal = ({ isOpen, onClose, product, onProductUpdated }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    cost_price: '',
    stock_quantity: '',
    low_stock_threshold: '',
    sku: '',
    description: '',
    image: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        category: product.category || '',
        price: product.price || '',
        cost_price: product.cost_price || '',
        stock_quantity: product.stock_quantity || '',
        low_stock_threshold: product.low_stock_threshold || '',
        sku: product.sku || '',
        description: product.description || '',
        image: product.image || ''
      });
      setPreviewImage(product.image || null);
    }
  }, [product]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setUploadingImage(true);
    try {
      const response = await uploadProductImage(file);

      // Backend returns: { success: true, data: { imageUrl: '/uploads/products/filename' } }
      let imageUrl = '';
      if (response?.success && response?.data?.imageUrl) {
        imageUrl = response.data.imageUrl;
      }

      setFormData((prev) => ({ ...prev, image: imageUrl }));
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image: '' }));
    setPreviewImage(null);
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
        stock_quantity: parseInt(formData.stock_quantity),
        low_stock_threshold: parseInt(formData.low_stock_threshold)
      };

      const response = await api.put(
        `/products/${product.product_id}`,
        productData
      );

      if (response.data.success) {
        onProductUpdated(response.data.data);
        handleClose();
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.error?.message || 'Failed to update product';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setPreviewImage(null);
    onClose();
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-500/30 via-purple-500/30 to-pink-500/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto fade-in-up hover-lift">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-gradient-to-r from-blue-400 to-purple-400">
            <h3 className="text-2xl font-bold text-gray-800 flex items-center">
              <span className="mr-3 text-3xl pulse">✏️</span>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Edit Product
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
                />
              </div>
            </div>

            {/* Stock Quantity and Threshold */}
            <div className="grid grid-cols-2 gap-4">
              <div className="fade-in">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <span className="mr-2">📊</span>
                  Stock Quantity *
                </label>
                <input
                  type="number"
                  name="stock_quantity"
                  value={formData.stock_quantity}
                  onChange={handleChange}
                  required
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-400 focus:shadow-lg"
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
              />
            </div>

            {/* Product Image Upload */}
            <div className="fade-in">
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <span className="mr-2">🖼️</span>
                Product Image
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-gray-50 transition-all">
                  <div className="text-center">
                    {uploadingImage ? (
                      <span className="text-blue-500 text-sm">Uploading...</span>
                    ) : (
                      <>
                        <span className="text-2xl text-gray-400">📁</span>
                        <p className="text-xs text-gray-500 mt-1">Click to upload</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
                {(previewImage || formData.image) && (
                  <div className="relative">
                    <img
                      src={previewImage ? (previewImage.startsWith('data:') ? previewImage : getImageUrl(previewImage)) : getImageUrl(formData.image)}
                      alt="Preview"
                      className="w-24 h-24 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
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
                    Updating...
                  </span>
                ) : (
                  '💾 Update Product'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditProductModal;
