import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import notify from '../services/notificationService';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { user, register } = useAuth();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'cashier',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.full_name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register({
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      notify.success('Registration successful!');
      navigate('/login');
    } catch (err) {
      const errorMessage =
        err.response?.data?.error?.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      notify.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8 fade-in">
          {/* Logo/Icon */}
          <div className="mb-4 flex justify-center">
            <div className="w-16 h-16 bg-btn-primary-bg rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-btn-primary-text">🛍️</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">Register</h1>
          <p className="text-muted">Create a new account</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-elevated border border-default rounded-lg shadow-lg p-8 fade-in-up">
          <div className="mb-4">
            <label className="block text-primary font-semibold mb-2">Full Name</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded border border-default bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-primary font-semibold mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded border border-default bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-primary font-semibold mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded border border-default bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-primary font-semibold mb-2">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded border border-default bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-primary font-semibold mb-2">Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded border border-default bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="cashier">Cashier</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          {error && <div className="text-red-600 dark:text-red-400 mb-4 text-center">{error}</div>}
          <button
            type="submit"
            className="w-full bg-btn-primary-bg hover:opacity-90 text-btn-primary-text font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-accent transition duration-200 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
          <div className="mt-4 text-center">
            <span className="text-muted">Already have an account? </span>
            <button
              type="button"
              className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-accent rounded"
              onClick={() => navigate('/login')}
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
