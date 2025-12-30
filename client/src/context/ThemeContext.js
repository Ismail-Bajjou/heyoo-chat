import React, { createContext, useState, useCallback, useEffect } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('isDark');
    return saved ? JSON.parse(saved) : false;
  });

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const newValue = !prev;
      localStorage.setItem('isDark', JSON.stringify(newValue));
      return newValue;
    });
  }, []);

  const theme = {
    isDark,
    toggleTheme,
    colors: isDark ? {
      primary: '#1e293b',
      secondary: '#334155',
      accent: '#0ea5e9',
      text: '#f1f5f9',
      textMuted: '#cbd5e1',
      background: '#0f172a',
      surface: '#1e293b',
      border: '#334155',
      hover: '#334155'
    } : {
      primary: '#ffffff',
      secondary: '#f1f5f9',
      accent: '#0ea5e9',
      text: '#0f172a',
      textMuted: '#64748b',
      background: '#f8fafc',
      surface: '#ffffff',
      border: '#e2e8f0',
      hover: '#f1f5f9'
    }
  };

  // Reflect theme in CSS variables by toggling [data-theme="dark"] on the root element
  useEffect(() => {
    try {
      const root = document.documentElement;
      if (isDark) {
        root.setAttribute('data-theme', 'dark');
      } else {
        root.removeAttribute('data-theme');
      }
    } catch {}
  }, [isDark]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};
