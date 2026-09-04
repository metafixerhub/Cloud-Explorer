import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://cloud-explorer.onrender.com/api',
  withCredentials: true, // Send secure HTTP-only cookies across network requests
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach JWT fallback header if present in desktop storage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pce_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle session expiration gracefully
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 401 && !window.location.pathname.includes('/login')) {
    localStorage.removeItem('pce_token');
    localStorage.removeItem('pce_user');
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

export const STORE_API_URL = import.meta.env.VITE_STORE_API_URL || 'https://cloud-explorer-store.onrender.com';
export default api;
