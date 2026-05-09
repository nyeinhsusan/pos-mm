import api from './api';

/**
 * List purchase orders with optional filters.
 * @param {Object} params - { status?, vendor_id?, source?, date_from?, date_to?, search? }
 */
export const listPurchaseOrders = async (params = {}) => {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const response = await api.get('/purchase-orders', { params: cleaned });
  return response.data;
};

/** Get a single purchase order with vendor + line items. */
export const getPurchaseOrder = async (id) => {
  const response = await api.get(`/purchase-orders/${id}`);
  return response.data;
};

/**
 * Create a new draft PO.
 * @param {Object} data - { vendor_id, notes?, source?, items: [{ product_id, quantity_ordered, unit_cost, tax_amount? }] }
 */
export const createPurchaseOrder = async (data) => {
  const response = await api.post('/purchase-orders', data);
  return response.data;
};

/**
 * Update a draft PO. Pass `notes` or `items` (or both).
 */
export const updatePurchaseOrder = async (id, data) => {
  const response = await api.put(`/purchase-orders/${id}`, data);
  return response.data;
};

/** Cancel a draft or sent PO. */
export const cancelPurchaseOrder = async (id, reason) => {
  const response = await api.post(`/purchase-orders/${id}/cancel`, { reason });
  return response.data;
};

/** Send a draft PO via email with PDF. */
export const sendPurchaseOrder = async (id) => {
  const response = await api.post(`/purchase-orders/${id}/send`);
  return response.data;
};

const purchaseOrderService = {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  cancelPurchaseOrder,
  sendPurchaseOrder
};

export default purchaseOrderService;
