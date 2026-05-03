import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize authentication state on mount
  useEffect(() => {
    const initAuth = () => {
      const storedToken = authService.getToken();
      const storedUser = authService.getCurrentUser();

      // Check if token exists and is not expired
      if (storedToken && !authService.isTokenExpired(storedToken)) {
        setToken(storedToken);
        setUser(storedUser);
      } else {
        // Token expired or doesn't exist, clear storage
        authService.clearAuthData();
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  /**
   * Login function
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} User data
   */
  const login = async (email, password) => {
    try {
      const data = await authService.login(email, password);

      // Save to state and localStorage
      setToken(data.token);
      setUser(data.user);
      authService.saveAuthData(data.token, data.user);

      return data;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Logout function
   */
  const logout = () => {
    setToken(null);
    setUser(null);
    authService.clearAuthData();
  };

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  const isAuthenticated = () => {
    return token !== null && user !== null && !authService.isTokenExpired(token);
  };

  /**
   * Check if user has specific role
   * @param {string} role - 'owner' or 'cashier'
   * @returns {boolean}
   */
  const hasRole = (role) => {
    return user?.role === role;
  };

  /**
   * Register function
   * @param {Object} userData - {full_name, email, password, role}
   * @returns {Promise<Object>} Response data
   */
  const register = async (userData) => {
    try {
      const data = await authService.register(userData);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated,
    hasRole
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to use auth context
 * @returns {Object} Auth context value
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
