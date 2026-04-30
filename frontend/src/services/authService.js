import api from './api';

const authService = {
  /**
   * User login
   * @param {string} email
   * @param {string} password
   * @returns {Promise} Response with token and user data
   */
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  /**
   * Register new user (Owner only)
   * @param {Object} userData - {email, password, full_name, role}
   * @returns {Promise} Response with user_id
   */
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  /**
   * Get current user from localStorage
   * @returns {Object|null} User object or null
   */
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        return null;
      }
    }
    return null;
  },

  /**
   * Get token from localStorage
   * @returns {string|null} JWT token or null
   */
  getToken: () => {
    return localStorage.getItem('token');
  },

  /**
   * Save token and user to localStorage
   * @param {string} token
   * @param {Object} user
   */
  saveAuthData: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  /**
   * Remove token and user from localStorage
   */
  clearAuthData: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  /**
   * Check if token is expired
   * @param {string} token
   * @returns {boolean} True if expired
   */
  isTokenExpired: (token) => {
    if (!token) return true;

    try {
      // Decode JWT token (simple base64 decode)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }
};

export default authService;
