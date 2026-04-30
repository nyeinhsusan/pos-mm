import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 *
 * @param {Array} allowedRoles - Optional array of allowed roles ['owner', 'cashier']
 */
const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access
  if (allowedRoles && allowedRoles.length > 0) {
    if (!user || !allowedRoles.includes(user.role)) {
      // User doesn't have required role
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-red-600 mb-4">403</h1>
            <p className="text-xl text-gray-700">Access Denied</p>
            <p className="text-gray-600 mt-2">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      );
    }
  }

  // User is authenticated and authorized, render child routes
  return <Outlet />;
};

export default ProtectedRoute;
