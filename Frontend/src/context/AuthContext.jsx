import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check initial authentication token persistence on boot
  useEffect(() => {
    const token = localStorage.getItem('pce_token');
    const storedUser = localStorage.getItem('pce_user');
    if (token) {
      setIsAuthenticated(true);
      if (storedUser) {
        try { setUser(JSON.parse(storedUser)); } catch (e) {}
      }
    }
    setLoading(false);
  }, []);

  const login = async (password) => {
    try {
      const response = await api.post('/login', { password });
      const { token, user: userData } = response.data;
      
      localStorage.setItem('pce_token', token);
      localStorage.setItem('pce_user', JSON.stringify(userData));
      
      setIsAuthenticated(true);
      setUser(userData);
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Network error - unable to connect to security server.';
      return { success: false, error: errorMsg };
    }
  };

  const logout = () => {
    localStorage.removeItem('pce_token');
    localStorage.removeItem('pce_user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
