import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * Theme Context (Comment 7)
 * 
 * Provides dark mode toggle functionality with persistence
 */

const ThemeContext = createContext(undefined);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first
    const stored = localStorage.getItem('splitit_theme');
    if (stored && ['light', 'dark'].includes(stored)) {
      return stored;
    }
    // Default to light theme
    return 'light';
  });

  const [resolvedTheme, setResolvedTheme] = useState('light');

  // Update resolved theme and apply class
  useEffect(() => {
    setResolvedTheme(theme);

    // Apply or remove dark class from document
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Store preference
    localStorage.setItem('splitit_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setThemeValue = (newTheme) => {
    if (['light', 'dark'].includes(newTheme)) {
      setTheme(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      resolvedTheme,
      toggleTheme,
      setTheme: setThemeValue,
      isDark: resolvedTheme === 'dark',
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
