import api from './api';

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );

export const listInvoices = async (params = {}) => {
  const response = await api.get('/vendor-invoices', { params: cleanParams(params) });
  return response.data;
};

export const getSummary = async () => {
  const response = await api.get('/vendor-invoices/summary');
  return response.data;
};

export const getInvoice = async (id) => {
  const response = await api.get(`/vendor-invoices/${id}`);
  return response.data;
};

export const createInvoice = async (data) => {
  const response = await api.post('/vendor-invoices', data);
  return response.data;
};

export const updateInvoice = async (id, data) => {
  const response = await api.put(`/vendor-invoices/${id}`, data);
  return response.data;
};

export const markPaid = async (id, { paid_date, payment_method, payment_reference }) => {
  const response = await api.post(`/vendor-invoices/${id}/mark-paid`, {
    paid_date,
    payment_method,
    payment_reference
  });
  return response.data;
};

export const uploadAttachment = async (id, file) => {
  const form = new FormData();
  form.append('attachment', file);
  const response = await api.post(`/vendor-invoices/${id}/attachment`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const deleteInvoice = async (id) => {
  const response = await api.delete(`/vendor-invoices/${id}`);
  return response.data;
};

const vendorInvoiceService = {
  listInvoices,
  getSummary,
  getInvoice,
  createInvoice,
  updateInvoice,
  markPaid,
  uploadAttachment,
  deleteInvoice
};

export default vendorInvoiceService;
