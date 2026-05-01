import { useState, useEffect } from 'react';
import api from '../services/api';

const CreatePromotionModal = ({
  isOpen,
  onClose,
  onPromotionCreated,
  onPromotionUpdated,
  promotion,
  isEditMode
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    applies_to: 'all',
    product_ids: [],
    categories: [],
    min_purchase_amount: '',
    max_discount_amount: '',
    is_active: true,
    priority: '0'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load existing promotion data for edit mode
  useEffect(() => {
    if (isEditMode && promotion) {
      setFormData({
        name: promotion.name || '',
        description: promotion.description || '',
        discount_type: promotion.discount_type || 'percentage',
        discount_value: promotion.discount_value || '',
        start_date: promotion.start_date || '',
        end_date: promotion.end_date || '',
        start_time: promotion.start_time || '',
        end_time: promotion.end_time || '',
        applies_to: promotion.applies_to || 'all',
        product_ids: promotion.products?.map((p) => p.product_id) || [],
        categories: promotion.categories || [],
        min_purchase_amount: promotion.min_purchase_amount || '',
        max_discount_amount: promotion.max_discount_amount || '',
        is_active: promotion.is_active !== undefined ? promotion.is_active : true,
        priority: promotion.priority || '0'
      });
    } else if (promotion && !isEditMode) {
      // Clone mode
      setFormData({
        name: promotion.name || '',
        description: promotion.description || '',
        discount_type: promotion.discount_type || 'percentage',
        discount_value: promotion.discount_value || '',
        start_date: promotion.start_date || '',
        end_date: promotion.end_date || '',
        start_time: promotion.start_time || '',
        end_time: promotion.end_time || '',
        applies_to: promotion.applies_to || 'all',
        product_ids: promotion.products?.map((p) => p.product_id) || [],
        categories: promotion.categories || [],
        min_purchase_amount: promotion.min_purchase_amount || '',
        max_discount_amount: promotion.max_discount_amount || '',
        is_active: true,
        priority: promotion.priority || '0'
      });
    }
  }, [promotion, isEditMode]);

  // Fetch products and categories
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      if (response.data.success) {
        setProducts(response.data.data);

        // Extract unique categories
        const uniqueCategories = [
          ...new Set(response.data.data.map((p) => p.category).filter(Boolean))
        ];
        setCategories(uniqueCategories);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    if (error) setError('');
  };

  const handleProductSelection = (productId) => {
    const selected = formData.product_ids.includes(productId);
    if (selected) {
      setFormData({
        ...formData,
        product_ids: formData.product_ids.filter((id) => id !== productId)
      });
    } else {
      setFormData({
        ...formData,
        product_ids: [...formData.product_ids, productId]
      });
    }
  };

  const handleCategorySelection = (category) => {
    const selected = formData.categories.includes(category);
    if (selected) {
      setFormData({
        ...formData,
        categories: formData.categories.filter((c) => c !== category)
      });
    } else {
      setFormData({
        ...formData,
        categories: [...formData.categories, category]
      });
    }
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.name || !formData.discount_type || !formData.discount_value) {
          setError('Name, discount type, and discount value are required');
          return false;
        }
        if (formData.discount_type === 'percentage' && (formData.discount_value < 0 || formData.discount_value > 100)) {
          setError('Percentage discount must be between 0 and 100');
          return false;
        }
        if (formData.discount_value < 0) {
          setError('Discount value must be positive');
          return false;
        }
        break;
      case 2:
        if (!formData.start_date || !formData.end_date) {
          setError('Start date and end date are required');
          return false;
        }
        if (formData.start_date > formData.end_date) {
          setError('End date must be after start date');
          return false;
        }
        break;
      case 3:
        if (formData.applies_to === 'products' && formData.product_ids.length === 0) {
          setError('Please select at least one product');
          return false;
        }
        if (formData.applies_to === 'categories' && formData.categories.length === 0) {
          setError('Please select at least one category');
          return false;
        }
        break;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep(currentStep)) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      const promotionData = {
        ...formData,
        discount_value: parseFloat(formData.discount_value),
        min_purchase_amount: formData.min_purchase_amount
          ? parseFloat(formData.min_purchase_amount)
          : 0,
        max_discount_amount: formData.max_discount_amount
          ? parseFloat(formData.max_discount_amount)
          : null,
        priority: parseInt(formData.priority) || 0
      };

      let response;
      if (isEditMode && promotion) {
        response = await api.put(`/promotions/${promotion.promotion_id}`, promotionData);
        if (response.data.success) {
          onPromotionUpdated(response.data.data);
        }
      } else {
        response = await api.post('/promotions', promotionData);
        if (response.data.success) {
          onPromotionCreated(response.data.data);
        }
      }

      handleClose();
    } catch (err) {
      const errorMessage =
        err.response?.data?.error?.message || 'Failed to save promotion';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      start_date: '',
      end_date: '',
      start_time: '',
      end_time: '',
      applies_to: 'all',
      product_ids: [],
      categories: [],
      min_purchase_amount: '',
      max_discount_amount: '',
      is_active: true,
      priority: '0'
    });
    setCurrentStep(1);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const totalSteps = 4;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto transition-colors">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEditMode ? '✏️ Edit Promotion' : '🚀 Create New Promotion'}
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl transition-colors"
            >
              ×
            </button>
          </div>

          {/* Progress Steps */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center flex-1">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full ${
                      currentStep >= step
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    } font-semibold transition-colors`}
                  >
                    {step}
                  </div>
                  {step < totalSteps && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        currentStep > step
                          ? 'bg-blue-600'
                          : 'bg-gray-200 dark:bg-gray-700'
                      } transition-colors`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-600 dark:text-gray-400">
              <span>Basic Info</span>
              <span>Schedule</span>
              <span>Target</span>
              <span>Review</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Form Steps */}
          <form onSubmit={handleSubmit}>
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Promotion Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
                    placeholder="e.g., Summer Sale"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
                    placeholder="Brief description of this promotion"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Discount Type *
                    </label>
                    <select
                      name="discount_type"
                      value={formData.discount_type}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (MMK)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Discount Value *
                    </label>
                    <input
                      type="number"
                      name="discount_value"
                      value={formData.discount_value}
                      onChange={handleChange}
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
                      placeholder={formData.discount_type === 'percentage' ? '10' : '5000'}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Schedule */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Date *
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      value={formData.end_date}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Time (optional)
                    </label>
                    <input
                      type="time"
                      name="start_time"
                      value={formData.start_time}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Time (optional)
                    </label>
                    <input
                      type="time"
                      name="end_time"
                      value={formData.end_time}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Leave time fields empty for all-day promotions
                </p>
              </div>
            )}

            {/* Step 3: Target */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Applies To *
                  </label>
                  <select
                    name="applies_to"
                    value={formData.applies_to}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
                  >
                    <option value="all">All Products</option>
                    <option value="products">Specific Products</option>
                    <option value="categories">Product Categories</option>
                  </select>
                </div>

                {/* Product Selection */}
                {formData.applies_to === 'products' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Products ({formData.product_ids.length} selected)
                    </label>
                    <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-gray-700">
                      {products.map((product) => (
                        <label
                          key={product.product_id}
                          className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.product_ids.includes(product.product_id)}
                            onChange={() => handleProductSelection(product.product_id)}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-200">{product.name}</span>
                          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                            {product.price} MMK
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category Selection */}
                {formData.applies_to === 'categories' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Categories ({formData.categories.length} selected)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {categories.map((category) => (
                        <label
                          key={category}
                          className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.categories.includes(category)}
                            onChange={() => handleCategorySelection(category)}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-200">{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conditions */}
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Min Purchase Amount (MMK)
                    </label>
                    <input
                      type="number"
                      name="min_purchase_amount"
                      value={formData.min_purchase_amount}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Discount Amount (MMK)
                    </label>
                    <input
                      type="number"
                      name="max_discount_amount"
                      value={formData.max_discount_amount}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
                      placeholder="No limit"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Promotion Summary</h4>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Name:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formData.name}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Discount:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {formData.discount_type === 'percentage'
                          ? `${formData.discount_value}%`
                          : `${formData.discount_value} MMK`} OFF
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formData.start_date} to {formData.end_date}
                      </span>
                    </div>

                    {(formData.start_time || formData.end_time) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Time:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formData.start_time || '00:00'} - {formData.end_time || '23:59'}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Applies To:</span>
                      <span className="font-medium text-gray-900 dark:text-white capitalize">
                        {formData.applies_to}
                        {formData.applies_to === 'products' && ` (${formData.product_ids.length})`}
                        {formData.applies_to === 'categories' && ` (${formData.categories.length})`}
                      </span>
                    </div>

                    {formData.min_purchase_amount && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Min Purchase:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formData.min_purchase_amount} MMK
                        </span>
                      </div>
                    )}

                    {formData.max_discount_amount && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Max Discount:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formData.max_discount_amount} MMK
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_active"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
                    Activate promotion immediately
                  </label>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={currentStep === 1 ? handleClose : handlePrevious}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {currentStep === 1 ? 'Cancel' : 'Previous'}
              </button>

              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:bg-gray-400 transition-colors"
                >
                  {loading ? 'Saving...' : isEditMode ? 'Update Promotion' : 'Create Promotion'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreatePromotionModal;
