import React, { createContext, useState, useEffect, useContext } from 'react';
import api, { setAuthHeader } from '../services/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Custom Toast notification trigger
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Clear toast
  const clearToast = () => {
    setToast(null);
  };

  // Automatically clear toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        clearToast();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Silent session refresh check on app boot
  const checkAuth = async () => {
    try {
      // Make request to refresh endpoint to check if a valid refresh cookie exists
      const response = await api.post('/api/v1/auth/refresh');
      const { accessToken: newToken } = response.data.data;

      // Fetch user profile using the new access token
      setAuthHeader(newToken);
      const userResponse = await api.get('/api/v1/user/profile');
      
      setAccessToken(newToken);
      setUser(userResponse.data.data.user);
    } catch (err) {
      // Bypassed silently on boot if no active refresh cookie is present
      setAuthHeader(null);
      setAccessToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger login request
  const login = async (email, password) => {
    try {
      const response = await api.post('/api/v1/auth/login', { email, password });
      const { accessToken: token, user: userData } = response.data.data;
      
      setAccessToken(token);
      setUser(userData);
      setAuthHeader(token);
      showToast('Welcome back to DevLens!', 'success');
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to authenticate.';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    }
  };

  // Trigger registration request
  const register = async (email, password, name) => {
    try {
      const response = await api.post('/api/v1/auth/register', { email, password, name });
      showToast('Registration successful! Please log in.', 'success');
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Registration failed.';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    }
  };

  // Trigger logout request
  const logout = async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch (err) {
      // Fail silently on server logout, still clear local client state
    } finally {
      setAccessToken(null);
      setUser(null);
      setAuthHeader(null);
      showToast('You have logged out successfully.', 'success');
    }
  };

  // Listen for session expiration events from Axios interceptor
  useEffect(() => {
    const handleSessionExpired = () => {
      setAccessToken(null);
      setUser(null);
      setAuthHeader(null);
      showToast('Your session has expired. Please log in again.', 'error');
    };

    window.addEventListener('auth:session_expired', handleSessionExpired);
    checkAuth();

    return () => {
      window.removeEventListener('auth:session_expired', handleSessionExpired);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        toast,
        showToast,
        clearToast,
        login,
        register,
        logout,
        checkAuth,
      }}
    >
      {children}
      
      {/* Toast Notification Portal UI */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-bounce-in">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md glass transition-all ${
            toast.type === 'error' 
              ? 'border-rose-500/20 text-rose-600 dark:text-rose-400 bg-rose-50/90 dark:bg-rose-950/20' 
              : 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-50/90 dark:bg-emerald-950/20'
          }`}>
            <span className="text-sm font-medium">{toast.message}</span>
            <button 
              onClick={clearToast} 
              className="text-xs hover:opacity-70 transition-opacity font-bold ml-2 font-mono"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
