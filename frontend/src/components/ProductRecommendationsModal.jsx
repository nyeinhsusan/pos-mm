/**
 * Product Recommendations Modal
 *
 * Displays AI-powered product recommendations based on market basket analysis
 * Shows frequently bought-together products with confidence, lift, and support metrics
 *
 * @module components/ProductRecommendationsModal
 */

import { useState, useEffect } from 'react';
import aiService from '../services/aiService';

function ProductRecommendationsModal({ isOpen, onClose, product }) {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && product) {
      fetchRecommendations();
    }
  }, [isOpen, product]);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await aiService.getRecommendations(product.product_id, 5);
      setRecommendations(response.data);
    } catch (err) {
      console.error('Fetch recommendations error:', err);
      setError(err.response?.data?.error?.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-500/30 via-purple-500/30 to-pink-500/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
      {/* Background overlay - clickable to close */}
      <div
        className="fixed inset-0"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto fade-in-up hover-lift">
        <div className="relative">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 gradient-animate">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center">
                <span className="mr-3 text-2xl pulse">✨</span>
                AI Product Recommendations
              </h3>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-all btn-press hover:rotate-90 text-2xl"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {/* Product Info */}
            <div className="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-200 fade-in">
              <p className="text-sm text-blue-600 mb-1">🛍️ Customers who bought</p>
              <p className="text-lg font-bold text-blue-900">📦 {product?.name}</p>
              <p className="text-sm text-blue-600 mt-1">also frequently bought these products:</p>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex flex-col justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600 flex items-center">
                  Loading recommendations
                  <span className="loading-dot ml-1">.</span>
                  <span className="loading-dot">.</span>
                  <span className="loading-dot">.</span>
                </p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shake">
                <p className="font-semibold">⚠️ Error loading recommendations</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {/* Recommendations */}
            {!loading && !error && recommendations && (
              <>
                {recommendations.recommendations && recommendations.recommendations.length > 0 ? (
                  <div className="space-y-3 stagger-children">
                    {recommendations.recommendations.map((rec, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition card-hover fade-in"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full pulse">
                              <span className="text-blue-600 font-bold text-sm">#{index + 1}</span>
                            </div>
                            <h4 className="text-lg font-semibold text-gray-800">🛒 {rec.product_name}</h4>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">💪 Confidence</p>
                            <p className="text-lg font-bold text-blue-600 count-up">{(rec.confidence * 100).toFixed(1)}%</p>
                            <p className="text-xs text-gray-500">Co-purchase rate</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">📊 Lift</p>
                            <p className="text-lg font-bold text-gray-700 count-up">{rec.lift.toFixed(2)}</p>
                            <p className="text-xs text-gray-500">Association strength</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">📈 Support</p>
                            <p className="text-lg font-bold text-gray-700 count-up">{(rec.support * 100).toFixed(1)}%</p>
                            <p className="text-xs text-gray-500">Frequency</p>
                          </div>
                        </div>

                        {/* Confidence Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300 progress-animate"
                            style={{ width: `${rec.confidence * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 fade-in">
                    <div className="text-6xl mb-4 bounce-slow">📭</div>
                    <p className="text-lg font-medium">No recommendations available</p>
                    <p className="text-sm mt-1">Insufficient purchase history for this product</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-between items-center fade-in-delay-1">
            <div className="text-sm text-gray-600 flex items-center">
              <span className="mr-2">🤖</span>
              AI-powered predictions based on market basket analysis
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all btn-press shadow-md hover:shadow-lg"
            >
              ✅ Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductRecommendationsModal;
