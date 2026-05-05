import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
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
      active: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
      inactive: 'bg-slate-500/20 text-slate-700 dark:text-slate-400 border border-slate-500/30',
      upcoming: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30',
      expired: 'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30',
      'inactive-time': 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
    };

    const labels = {
      active: 'Active',
      inactive: 'Inactive',
      upcoming: 'Upcoming',
      expired: 'Expired',
      'inactive-time': 'Off Hours'
    };

    return (
      <span className={`px-3 py-1.5 inline-flex text-[10px] font-black leading-none uppercase tracking-wider rounded-xl ${badges[status]}`}>
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
      <div className="min-h-screen bg-page transition-colors">
        <Sidebar isDark={isDark} toggleTheme={toggleTheme} />
        <div className="ml-0 md:ml-20 lg:ml-28 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-muted">Loading promotions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page transition-colors">
      <Sidebar isDark={isDark} toggleTheme={toggleTheme} />

      {/* Main Content - full width */}
      <main className="ml-0 md:ml-20 lg:ml-28 px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Bar */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setSelectedPromotion(null);
                setIsEditMode(false);
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-btn-primary-bg text-btn-primary-text hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent rounded-full font-medium shadow-sm transition-all"
            >
              + Create Promotion
            </button>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex-none px-8 py-3.5 rounded-full text-[11px] font-black uppercase tracking-[0.15em] transition-all border focus:outline-none focus:ring-2 focus:ring-accent ${
                filterStatus === 'all'
                  ? 'bg-btn-primary-bg text-btn-primary-text border-transparent'
                  : 'bg-surface border-default text-muted hover:bg-elevated hover:text-primary'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`flex-none px-8 py-3.5 rounded-full text-[11px] font-black uppercase tracking-[0.15em] transition-all border focus:outline-none focus:ring-2 focus:ring-accent ${
                filterStatus === 'active'
                  ? 'bg-btn-primary-bg text-btn-primary-text border-transparent'
                  : 'bg-surface border-default text-muted hover:bg-elevated hover:text-primary'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus('inactive')}
              className={`flex-none px-8 py-3.5 rounded-full text-[11px] font-black uppercase tracking-[0.15em] transition-all border focus:outline-none focus:ring-2 focus:ring-accent ${
                filterStatus === 'inactive'
                  ? 'bg-btn-primary-bg text-btn-primary-text border-transparent'
                  : 'bg-surface border-default text-muted hover:bg-elevated hover:text-primary'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search promotions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-default rounded-lg bg-surface text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors"
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
          <div className="bg-surface border border-default rounded-lg shadow-sm p-12 text-center transition-colors">
            <p className="text-muted text-lg">
              {searchTerm ? 'No promotions found matching your search' : 'No promotions yet'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-6 py-2 bg-btn-primary-bg text-btn-primary-text hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent rounded-full font-medium transition-all"
              >
                Create Your First Promotion
              </button>
            )}
          </div>
        ) : (
          <div className="bg-surface border border-default rounded-[2rem] overflow-x-auto shadow-2xl">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-default text-[9px] font-black uppercase tracking-[0.3em] text-muted">
                  <th className="px-8 py-6 text-left min-w-[200px]">Promotion Identity</th>
                  <th className="px-8 py-6 text-left">Discount</th>
                  <th className="px-8 py-6 text-left">Date Range</th>
                  <th className="px-8 py-6 text-left">Applies To</th>
                  <th className="px-8 py-6 text-left">Status</th>
                  <th className="px-8 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-default)]">
                <AnimatePresence mode="popLayout">
                  {filteredPromotions.map((promotion) => (
                    <motion.tr
                      key={promotion.promotion_id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.2 }}
                      className="group hover:bg-section transition-colors"
                    >
                    <td className="px-8 py-6">
                      <div>
                        <div className="text-sm font-bold text-primary">
                          {promotion.name}
                        </div>
                        {promotion.description && (
                          <div className="text-xs text-muted">
                            {promotion.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <span className="text-sm font-bold text-primary">
                        {formatDiscount(promotion)}
                      </span>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="text-xs text-muted">
                        {formatDateRange(promotion)}
                      </div>
                      {promotion.start_time && promotion.end_time && (
                        <div className="text-xs text-muted">
                          {promotion.start_time} - {promotion.end_time}
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <span className="text-sm text-primary capitalize">
                        {promotion.applies_to}
                        {promotion.applies_to === 'products' && promotion.products && (
                          <span className="text-xs text-muted">
                            {' '}({promotion.products.length})
                          </span>
                        )}
                        {promotion.applies_to === 'categories' && promotion.categories && (
                          <span className="text-xs text-muted">
                            {' '}({promotion.categories.length})
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      {getStatusBadge(promotion)}
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleToggleActive(promotion)}
                          className={`px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent transition-all ${
                            promotion.is_active
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-700 dark:text-amber-400'
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                          }`}
                          title={promotion.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {promotion.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleEdit(promotion)}
                          className="px-3 py-1.5 bg-elevated hover:bg-section border border-default rounded-lg text-primary text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleClone(promotion)}
                          className="px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-lg text-violet-700 dark:text-violet-400 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                          title="Clone promotion"
                        >
                          Clone
                        </button>
                        <button
                          onClick={() => handleDelete(promotion.promotion_id, promotion.name)}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-700 dark:text-red-400 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-default rounded-2xl p-4">
            <div className="text-xs text-muted uppercase tracking-wider">Total Promotions</div>
            <div className="text-2xl font-bold text-primary">{promotions.length}</div>
          </div>
          <div className="bg-surface border border-default rounded-2xl p-4">
            <div className="text-xs text-muted uppercase tracking-wider">Active</div>
            <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">
              {promotions.filter((p) => getPromotionStatus(p) === 'active').length}
            </div>
          </div>
          <div className="bg-surface border border-default rounded-2xl p-4">
            <div className="text-xs text-muted uppercase tracking-wider">Upcoming</div>
            <div className="text-2xl font-bold text-blue-500 dark:text-blue-400">
              {promotions.filter((p) => getPromotionStatus(p) === 'upcoming').length}
            </div>
          </div>
          <div className="bg-surface border border-default rounded-2xl p-4">
            <div className="text-xs text-muted uppercase tracking-wider">Expired</div>
            <div className="text-2xl font-bold text-red-500 dark:text-red-400">
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
