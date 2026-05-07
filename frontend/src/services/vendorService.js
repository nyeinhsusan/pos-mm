import api from './api';

/**
 * List vendors with optional status / search filters.
 * @param {Object} params - { status?: 'active'|'archived', search?: string }
 */
export const listVendors = async (params = {}) => {
  const response = await api.get('/vendors', { params });
  return response.data;
};

/**
 * Get a single vendor by id.
 */
export const getVendor = async (id) => {
  const response = await api.get(`/vendors/${id}`);
  return response.data;
};

/**
 * Create a new vendor.
 */
export const createVendor = async (data) => {
  const response = await api.post('/vendors', data);
  return response.data;
};

/**
 * Update vendor fields (whitelist enforced server-side).
 */
export const updateVendor = async (id, data) => {
  const response = await api.put(`/vendors/${id}`, data);
  return response.data;
};

/**
 * Soft-delete a vendor (status='archived').
 */
export const archiveVendor = async (id) => {
  const response = await api.post(`/vendors/${id}/archive`);
  return response.data;
};

/**
 * Reverse soft-delete (status='active').
 */
export const restoreVendor = async (id) => {
  const response = await api.post(`/vendors/${id}/restore`);
  return response.data;
};

/**
 * Hard-delete a vendor. Server rejects if vendor has open POs.
 */
export const deleteVendor = async (id) => {
  const response = await api.delete(`/vendors/${id}`);
  return response.data;
};

/**
 * Upload a vendor logo (multipart, field name 'logo').
 * @param {number} id
 * @param {File} file
 */
export const uploadLogo = async (id, file) => {
  const formData = new FormData();
  formData.append('logo', file);
  const response = await api.post(`/vendors/${id}/logo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

// ---- Vendor↔Product catalog (Story 21) ----------------------------------

/** GET /api/vendors/:vendorId/products */
export const getVendorProducts = async (vendorId) => {
  const response = await api.get(`/vendors/${vendorId}/products`);
  return response.data;
};

/** GET /api/products/:productId/vendors */
export const getProductVendors = async (productId) => {
  const response = await api.get(`/products/${productId}/vendors`);
  return response.data;
};

/** POST /api/vendors/:vendorId/products */
export const linkProductToVendor = async (vendorId, payload) => {
  const response = await api.post(`/vendors/${vendorId}/products`, payload);
  return response.data;
};

/** PUT /api/vendor-products/:id (whitelist: vendor_cost_price, default_reorder_qty, min_order_qty, is_preferred) */
export const updateVendorProduct = async (id, payload) => {
  const response = await api.put(`/vendor-products/${id}`, payload);
  return response.data;
};

/** DELETE /api/vendor-products/:id */
export const unlinkVendorProduct = async (id) => {
  const response = await api.delete(`/vendor-products/${id}`);
  return response.data;
};

/** POST /api/vendor-products/:id/set-preferred (atomic swap with any existing preferred sibling) */
export const setPreferredVendorProduct = async (id) => {
  const response = await api.post(`/vendor-products/${id}/set-preferred`);
  return response.data;
};

const vendorService = {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  archiveVendor,
  restoreVendor,
  deleteVendor,
  uploadLogo,
  getVendorProducts,
  getProductVendors,
  linkProductToVendor,
  updateVendorProduct,
  unlinkVendorProduct,
  setPreferredVendorProduct
};

export default vendorService;
