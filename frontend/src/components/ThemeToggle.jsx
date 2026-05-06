/**
 * ThemeToggle Component - Simple working version
 */

import { useState, useEffect } from 'react';

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('pos-myanmar-theme');
    return saved === 'dark';
  });

  // Apply theme on mount and when it changes
  useEffect(() => {
    const html = document.documentElement;

    if (isDark) {
      html.classList.remove('light');
      html.classList.add('dark');
      localStorage.setItem('pos-myanmar-theme', 'dark');
      console.log('✓ Dark mode applied');
      console.log('HTML classes:', html.className);
      console.log('HTML element:', html);
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
      localStorage.setItem('pos-myanmar-theme', 'light');
      console.log('✓ Light mode applied');
      console.log('HTML classes:', html.className);
      console.log('HTML element:', html);
    }
  }, [isDark]);

  const handleToggle = () => {
    console.log('Theme toggle clicked, current:', isDark ? 'dark' : 'light');
    setIsDark(!isDark);
  };

  return (
    <button
      onClick={handleToggle}
      className="relative group px-3 py-2 rounded-lg transition-all hover:bg-section focus:outline-none focus:ring-2 focus:ring-accent"
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {/* Theme Icon */}
      <span className="text-2xl" role="img" aria-hidden="true">
        {isDark ? '🌙' : '☀️'}
      </span>

      {/* Tooltip */}
      <div className="absolute hidden group-hover:block top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-btn-primary-bg text-btn-primary-text text-xs rounded-md whitespace-nowrap z-50">
        {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      </div>
    </button>
  );
};

export default ThemeToggle;
