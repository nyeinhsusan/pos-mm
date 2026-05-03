import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const WelcomePage = () => {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Trigger animation on mount with a small delay
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-2xl w-full text-center">
        {/* Logo */}
        <div className={`mb-8 transform transition-all duration-1000 ${isLoaded ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center shadow-2xl">
              <span className="text-6xl animate-bounce">🛍️</span>
            </div>
          </div>
        </div>

        {/* Main Heading */}
        <div className={`mb-6 transform transition-all duration-1000 delay-300 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <h1 className="text-5xl md:text-6xl font-bold text-white dark:text-gray-100 mb-4 leading-tight">
            Welcome to <span className="bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">POS Myanmar</span>
          </h1>
        </div>

        {/* Subtitle */}
        <div className={`mb-12 transform transition-all duration-1000 delay-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <p className="text-xl md:text-2xl text-gray-100 dark:text-gray-300 mb-3">
            Modern Point of Sale Management System
          </p>
          <p className="text-lg text-gray-200 dark:text-gray-400">
            Streamline your sales, boost productivity, and grow your business
          </p>
        </div>

        {/* Features */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 transform transition-all duration-1000 delay-700 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="bg-white dark:bg-gray-800 bg-opacity-10 dark:bg-opacity-20 backdrop-blur-md rounded-lg p-6 hover:bg-opacity-20 dark:hover:bg-opacity-30 transition-all hover:scale-105">
            <div className="text-4xl mb-3">💳</div>
            <h3 className="text-white font-semibold mb-2">Fast Checkout</h3>
            <p className="text-gray-200 dark:text-gray-300 text-sm">Quick and secure payment processing</p>
          </div>

          <div className="bg-white dark:bg-gray-800 bg-opacity-10 dark:bg-opacity-20 backdrop-blur-md rounded-lg p-6 hover:bg-opacity-20 dark:hover:bg-opacity-30 transition-all hover:scale-105">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-white font-semibold mb-2">Analytics</h3>
            <p className="text-gray-200 dark:text-gray-300 text-sm">Real-time sales insights and reports</p>
          </div>

          <div className="bg-white dark:bg-gray-800 bg-opacity-10 dark:bg-opacity-20 backdrop-blur-md rounded-lg p-6 hover:bg-opacity-20 dark:hover:bg-opacity-30 transition-all hover:scale-105">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="text-white font-semibold mb-2">Promotions</h3>
            <p className="text-gray-200 dark:text-gray-300 text-sm">Create and manage promotional campaigns</p>
          </div>
        </div>

        {/* Call to Action Buttons */}
        <div className={`flex flex-col sm:flex-row gap-4 justify-center transform transition-all duration-1000 delay-1000 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-4 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-100 transform transition-all hover:scale-105 active:scale-95 shadow-lg"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/register')}
            className="px-8 py-4 bg-gradient-to-r from-cyan-400 to-pink-400 text-white font-bold rounded-lg hover:shadow-lg transform transition-all hover:scale-105 active:scale-95 shadow-lg"
          >
            Get Started
          </button>
        </div>

        {/* Footer Text */}
        <div className={`mt-12 transform transition-all duration-1000 delay-1200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-gray-200 dark:text-gray-400 text-sm">
            © 2026 POS Myanmar. All rights reserved. | <a href="#" className="hover:text-white transition">Privacy Policy</a>
          </p>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default WelcomePage;
