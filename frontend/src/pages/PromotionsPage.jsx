import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import notify from '../services/notificationService';
import Sidebar from '../components/Sidebar';
import CreatePromotionModal from '../components/CreatePromotionModal';

const PromotionsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    // Only owners can access promotions page
    if (user?.role !== 'owner') {
      notify.error('Access denied. Owner role required.');
      navigate('/pos');
      return;
    }

    fetchPromotions();
  }, [filterStatus, user, navigate]);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }

      const response = await api.get('/promotions', { params });

      if (response.data.success) {
        setPromotions(response.data.data);
      }
    } catch (err) {
      console.error('Fetch promotions error:', err);
      setError('Failed to load promotions');
      notify.error('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (promotionId, promotionName) => {
    if (!window.confirm(`Are you sure you want to delete "${promotionName}"?`)) {
      return;
    }

    try {
      const response = await api.delete(`/promotions/${promotionId}`);

      if (response.data.success) {
        setPromotions(promotions.filter((p) => p.promotion_id !== promotionId));
        notify.success(`${promotionName} deleted successfully`);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to delete promotion';
      notify.error(errorMsg);
    }
  };

  const handleEdit = (promotion) => {
    setSelectedPromotion(promotion);
    setIsEditMode(true);
    setShowCreateModal(true);
  };

  const handleClone = async (promotion) => {
    // Clone by creating a new promotion with same details but different name
    const clonedData = {
      ...promotion,
      name: `${promotion.name} (Copy)`,
      promotion_id: undefined,
      created_at: undefined,
      updated_at: undefined,
      created_by: undefined,
      created_by_name: undefined
    };

    setSelectedPromotion(clonedData);
    setIsEditMode(false);
    setShowCreateModal(true);
  };

  const handleToggleActive = async (promotion) => {
    try {
      const response = await api.put(`/promotions/${promotion.promotion_id}`, {
        is_active: !promotion.is_active
      });

      if (response.data.success) {
        setPromotions(
          promotions.map((p) =>
            p.promotion_id === promotion.promotion_id
              ? { ...p, is_active: !p.is_active }
              : p
          )
        );
        notify.success(
          `Promotion ${!promotion.is_active ? 'activated' : 'deactivated'} successfully`
        );
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to update promotion';
      notify.error(errorMsg);
    }
  };

  const handlePromotionCreated = (newPromotion) => {
    setPromotions([newPromotion, ...promotions]);
    setShowCreateModal(false);
    setSelectedPromotion(null);
    setIsEditMode(false);
    notify.success(`${newPromotion.name} created successfully!`);
  };

  const handlePromotionUpdated = (updatedPromotion) => {
    setPromotions(
      promotions.map((p) =>
        p.promotion_id === updatedPromotion.promotion_id ? updatedPromotion : p
      )
    );
    setShowCreateModal(false);
    setSelectedPromotion(null);
    setIsEditMode(false);
    notify.success(`${updatedPromotion.name} updated successfully!`);
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    setSelectedPromotion(null);
    setIsEditMode(false);
  };

  const filteredPromotions = promotions.filter((promotion) =>
    promotion.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPromotionStatus = (promotion) => {
    if (!promotion.is_active) return 'inactive';

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    if (today < promotion.start_date) return 'upcoming';
    if (today > promotion.end_date) return 'expired';

    // Check time if specified
    if (promotion.start_time && promotion.end_time) {
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
      if (currentTime < promotion.start_time || currentTime > promotion.end_time) {
        return 'inactive-time';
      }
    }

    return 'active';
  };

  const getStatusBadge = (promotion) => {
    const status = getPromotionStatus(promotion);

    const badges = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      upcoming: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      expired: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
      'inactive-time': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
    };

    const labels = {
      active: 'Active',
      inactive: 'Inactive',
      upcoming: 'Upcoming',
      expired: 'Expired',
      'inactive-time': 'Off Hours'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatDiscount = (promotion) => {
    if (promotion.discount_type === 'percentage') {
      return `${promotion.discount_value}% OFF`;
    } else if (promotion.discount_type === 'fixed') {
      return `${promotion.discount_value} MMK OFF`;
    } else {
      return promotion.discount_type.toUpperCase();
    }
  };

  const formatDateRange = (promotion) => {
    return `${promotion.start_date} to ${promotion.end_date}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Sidebar isDark={isDark} toggleTheme={toggleTheme} />
        <div className="ml-0 md:ml-20 lg:ml-28 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading promotions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      {/* Main Content - shifted right by sidebar width */}
      <main className="ml-0 md:ml-20 lg:ml-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Bar */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setSelectedPromotion(null);
                setIsEditMode(false);
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors"
            >
              + Create Promotion
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <option value="all">All Promotions</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search promotions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Promotions Table */}
        {filteredPromotions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center transition-colors">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {searchTerm ? 'No promotions found matching your search' : 'No promotions yet'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Create Your First Promotion
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-colors">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Promotion
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Discount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Applies To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPromotions.map((promotion) => (
                  <tr key={promotion.promotion_id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {promotion.name}
                        </div>
                        {promotion.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {promotion.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {formatDiscount(promotion)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-300">
                        {formatDateRange(promotion)}
                      </div>
                      {promotion.start_time && promotion.end_time && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {promotion.start_time} - {promotion.end_time}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-gray-300 capitalize">
                        {promotion.applies_to}
                        {promotion.applies_to === 'products' && promotion.products && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {' '}({promotion.products.length})
                          </span>
                        )}
                        {promotion.applies_to === 'categories' && promotion.categories && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {' '}({promotion.categories.length})
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(promotion)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleToggleActive(promotion)}
                          className={`px-3 py-1 rounded ${
                            promotion.is_active
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30'
                              : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
                          } transition-colors`}
                          title={promotion.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {promotion.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleEdit(promotion)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleClone(promotion)}
                          className="px-3 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30 rounded transition-colors"
                          title="Clone promotion"
                        >
                          Clone
                        </button>
                        <button
                          onClick={() => handleDelete(promotion.promotion_id, promotion.name)}
                          className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 transition-colors">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Promotions</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{promotions.length}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 transition-colors">
            <div className="text-sm text-gray-500 dark:text-gray-400">Active</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {promotions.filter((p) => getPromotionStatus(p) === 'active').length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 transition-colors">
            <div className="text-sm text-gray-500 dark:text-gray-400">Upcoming</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {promotions.filter((p) => getPromotionStatus(p) === 'upcoming').length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 transition-colors">
            <div className="text-sm text-gray-500 dark:text-gray-400">Expired</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {promotions.filter((p) => getPromotionStatus(p) === 'expired').length}
            </div>
          </div>
        </div>
      </main>

      {/* Create/Edit Promotion Modal */}
      {showCreateModal && (
        <CreatePromotionModal
          isOpen={showCreateModal}
          onClose={handleModalClose}
          onPromotionCreated={handlePromotionCreated}
          onPromotionUpdated={handlePromotionUpdated}
          promotion={selectedPromotion}
          isEditMode={isEditMode}
        />
      )}
    </div>
  );
};

export default PromotionsPage;
