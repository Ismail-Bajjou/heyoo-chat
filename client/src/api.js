export const API_BASE =
  (typeof window !== 'undefined' && window.__API_BASE__) ||
  process.env.REACT_APP_API_BASE ||
  'http://localhost:5000';

export const withBase = (path) => `${API_BASE}${path}`;
