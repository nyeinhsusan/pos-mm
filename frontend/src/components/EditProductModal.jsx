import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import api from '../services/api';
import { uploadProductImage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import vendorService from '../services/vendorService';

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
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [vendors, setVendors] = useState([]);
  const [vendorsExpanded, setVendorsExpanded] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);

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

  // Load linked vendors when expanded (owner only). Endpoint is owner-only on
  // server; if Cashier somehow opens this modal, the section just stays hidden.
  useEffect(() => {
    const isOwner = user?.role === 'owner';
    if (!isOpen || !product?.product_id || !isOwner || !vendorsExpanded) return;
    let cancelled = false;
    (async () => {
      setLoadingVendors(true);
      try {
        const res = await vendorService.getProductVendors(product.product_id);
        if (!cancelled && res.success) setVendors(res.data || []);
      } catch (err) {
        if (!cancelled) console.error('Load product vendors error:', err);
      } finally {
        if (!cancelled) setLoadingVendors(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, product?.product_id, user?.role, vendorsExpanded]);

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
      <div className="bg-elevated border border-default rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto fade-in-up hover-lift">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-default">
            <h3 className="text-2xl font-bold text-primary flex items-center">
              <span className="mr-3 text-3xl pulse">✏️</span>
              <span>Edit Product</span>
            </h3>
            <button
              onClick={handleClose}
              className="text-muted hover:text-primary text-2xl transition-all btn-press hover:rotate-90 focus:outline-none focus:ring-2 focus:ring-accent rounded"
            >
              ✕
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4 shake">
              <span className="mr-2">⚠️</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 stagger-children">
            {/* Name */}
            <div className="fade-in">
              <label className="block text-sm font-medium text-primary mb-1 flex items-center">
                <span className="mr-2">📦</span>
                Product Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all focus:shadow-lg"
              />
            </div>

            {/* Category and SKU */}
            <div className="grid grid-cols-2 gap-4">
              <div className="fade-in">
                <label className="block text-sm font-medium text-primary mb-1 flex items-center">
                  <span className="mr-2">🏷️</span>
                  Category *
                </label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all focus:shadow-lg"
                />
              </div>
              <div className="fade-in">
                <label className="block text-sm font-medium text-primary mb-1 flex items-center">
                  <span className="mr-2">🔖</span>
                  SKU
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all focus:shadow-lg"
                />
              </div>
            </div>

            {/* Price and Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div className="fade-in">
                <label className="block text-sm font-medium text-primary mb-1 flex items-center">
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
                  className="w-full px-4 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all focus:shadow-lg"
                />
              </div>
              <div className="fade-in">
                <label className="block text-sm font-medium text-primary mb-1 flex items-center">
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
                  className="w-full px-4 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all focus:shadow-lg"
                />
              </div>
            </div>

            {/* Stock Quantity and Threshold */}
            <div className="grid grid-cols-2 gap-4">
              <div className="fade-in">
                <label className="block text-sm font-medium text-primary mb-1 flex items-center">
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
                  className="w-full px-4 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all focus:shadow-lg"
                />
              </div>
              <div className="fade-in">
                <label className="block text-sm font-medium text-primary mb-1 flex items-center">
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
                  className="w-full px-4 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all focus:shadow-lg"
                />
              </div>
            </div>

            {/* Description */}
            <div className="fade-in">
              <label className="block text-sm font-medium text-primary mb-1 flex items-center">
                <span className="mr-2">📝</span>
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 border border-default rounded-lg bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all focus:shadow-lg resize-none"
              />
            </div>

            {/* Product Image Upload */}
            <div className="fade-in">
              <label className="block text-sm font-medium text-primary mb-1 flex items-center">
                <span className="mr-2">🖼️</span>
                Product Image
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-default rounded-lg cursor-pointer hover:bg-section transition-all">
                  <div className="text-center">
                    {uploadingImage ? (
                      <span className="text-accent text-sm">Uploading...</span>
                    ) : (
                      <>
                        <span className="text-2xl text-muted">📁</span>
                        <p className="text-xs text-muted mt-1">Click to upload</p>
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
                      className="w-24 h-24 object-cover rounded-lg border border-default"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 bg-red-600 dark:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Linked Vendors (owner only, read-only) */}
            {user?.role === 'owner' && product?.product_id && (
              <div className="pt-4 border-t border-default fade-in">
                <button
                  type="button"
                  onClick={() => setVendorsExpanded((v) => !v)}
                  className="w-full flex items-center justify-between text-sm font-medium text-primary hover:text-primary py-1 focus:outline-none focus:ring-2 focus:ring-accent rounded"
                >
                  <span className="flex items-center gap-2">
                    <span>🏭</span> Vendors {vendors.length > 0 ? `(${vendors.length})` : ''}
                  </span>
                  {vendorsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {vendorsExpanded && (
                  <div className="mt-3 space-y-2">
                    {loadingVendors ? (
                      <div className="text-center py-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent mx-auto"></div>
                      </div>
                    ) : vendors.length === 0 ? (
                      <div className="bg-section border border-default rounded-lg p-3 text-center">
                        <p className="text-xs text-muted">No vendors linked yet.</p>
                        <button
                          type="button"
                          onClick={() => navigate('/vendors')}
                          className="text-xs text-accent hover:underline mt-1 focus:outline-none"
                        >
                          Manage in Vendors page
                        </button>
                      </div>
                    ) : (
                      <>
                        <ul className="space-y-1.5">
                          {vendors.map((v) => (
                            <li
                              key={v.vendor_product_id}
                              className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                                v.is_preferred
                                  ? 'bg-amber-500/5 border-amber-500/30'
                                  : 'bg-section border-default'
                              }`}
                            >
                              {v.is_preferred && (
                                <Star size={12} className="text-amber-500 fill-amber-500 flex-none" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-primary truncate">{v.vendor_name}</p>
                                <p className="text-[10px] text-muted truncate">{v.vendor_email}</p>
                              </div>
                              <div className="flex flex-col items-end text-[10px] text-muted">
                                <span className="font-bold text-primary">
                                  {parseInt(v.vendor_cost_price).toLocaleString()} MMK
                                </span>
                                <span>default {v.default_reorder_qty}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          onClick={() => navigate(`/vendors?open=${vendors[0].vendor_id}`)}
                          className="w-full text-[11px] text-accent hover:underline flex items-center justify-center gap-1 py-1 focus:outline-none"
                        >
                          Manage in Vendors page <ExternalLink size={11} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-default mt-6 fade-in-delay-1">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 border border-default rounded-lg text-primary hover:bg-section transition-all btn-press hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent"
              >
                ❌ Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-2 rounded-lg bg-btn-primary-bg text-btn-primary-text transition-all btn-press shadow-md focus:outline-none focus:ring-2 focus:ring-accent ${
                  loading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:opacity-90 hover:shadow-lg'
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
