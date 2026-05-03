import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import WelcomePage from './pages/WelcomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import POSPage from './pages/POSPage';
import ProductsPage from './pages/ProductsPage';
import ReportsPage from './pages/ReportsPage';
import AIInsightsPage from './pages/AIInsightsPage';
import PromotionsPage from './pages/PromotionsPage';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
          <Router>
            {/* Toast Notification System */}
            <Toaster
              position="top-right"
              reverseOrder={false}
              gutter={8}
              toastOptions={{
                // Default options for all toasts
                duration: 4000,
                style: {
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                },
              }}
              containerStyle={{
                top: 20,
                right: 20,
              }}
              // Max 3 notifications visible at once
              limit={3}
            />

            <Routes>
              {/* Redirect root to welcome */}
              <Route path="/" element={<Navigate to="/welcome" replace />} />

              {/* Public route - Welcome */}
              <Route path="/welcome" element={<WelcomePage />} />

              {/* Public route - Login */}
              <Route path="/login" element={<LoginPage />} />

              {/* Public route - Register */}
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/pos" element={<POSPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/promotions" element={<PromotionsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/ai-insights" element={<AIInsightsPage />} />
              </Route>

              {/* Catch all - redirect to login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
        </CartProvider>
      </AuthProvider>
  );
}

export default App;
