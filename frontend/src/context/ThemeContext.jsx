/**
 * ThemeContext - Theme Management Provider
 *
 * Manages application theme state with support for:
 * - Light mode (default)
 * - Dark mode
 */

import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// Available themes
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

// Local storage key
const THEME_STORAGE_KEY = 'pos-myanmar-theme';

export const ThemeProvider = ({ children }) => {
  // Initialize theme from localStorage or default to light
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme && Object.values(THEMES).includes(savedTheme)) {
      return savedTheme;
    }
    return THEMES.LIGHT;
  });

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;

    // Remove both theme classes
    root.classList.remove('light', 'dark');

    // Add current theme class
    root.classList.add(theme);

    // Save to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Simple toggle between light and dark
  const toggleTheme = () => {
    setTheme(currentTheme =>
      currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT
    );
  };

  const setLightTheme = () => setTheme(THEMES.LIGHT);
  const setDarkTheme = () => setTheme(THEMES.DARK);

  const isLight = theme === THEMES.LIGHT;
  const isDark = theme === THEMES.DARK;

  const value = {
    theme,
    setTheme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    isLight,
    isDark,
    THEMES
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
