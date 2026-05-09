import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import notify from '../services/notificationService';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      // Redirect to Products page on successful login
      navigate('/products');
    } catch (err) {
      const errorMessage =
        err.response?.data?.error?.message || 'Login failed. Please try again.';
      setError(errorMessage);
      notify.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-page to-section flex items-center justify-center p-4 gradient-animate">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8 fade-in">
          <h1 className="text-4xl font-bold text-primary mb-2">
            🏪 POS Myanmar
          </h1>
          <p className="text-muted">Sign in to your account</p>
        </div>

        {/* Login Card */}
        <div className="bg-surface border border-default rounded-lg shadow-xl p-8 fade-in-up hover-lift">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg shake">
                <p className="text-sm">⚠️ {error}</p>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-primary mb-2"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-default bg-surface text-primary placeholder-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                placeholder="📧 owner@pos.com"
                autoComplete="email"
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-primary mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-default bg-surface text-primary placeholder-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                placeholder="🔒 Enter your password"
                autoComplete="current-password"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-full bg-btn-primary-bg text-btn-primary-text font-medium transition-all btn-press shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent ${
                loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo Accounts Info */}
          <div className="mt-6 p-4 bg-section border border-default rounded-lg">
            <p className="text-xs text-primary font-medium mb-2">
             Welcome to POS Myanmar
            </p>
            <div className="text-xs text-muted space-y-1">
              <p>
                <strong>Simple </strong> and modern point of sale system
              </p>
              <p>
                <strong>Designed</strong>  for daily business needs
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-muted text-sm mt-6">
          &copy; 2026 POS Myanmar. University of Roehampton Final Year Project.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
