import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore authenticated session on mount and listen for authorization invalidations
  useEffect(() => {
    let mounted = true;

    const handleUnauthorized = () => {
      if (mounted) setUser(null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('serviq:unauthorized', handleUnauthorized);
    }

    authApi.getMe()
      .then((sessionUser) => {
        if (mounted) {
          setUser(sessionUser || null);
        }
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('serviq:unauthorized', handleUnauthorized);
      }
    };
  }, []);

  const login = async ({ email, password, rememberMe }) => {
    const result = await authApi.login({ email, password, rememberMe });
    if (result?.user) {
      setUser(result.user);
    }
    return result?.user;
  };

  const signup = async (formData) => {
    const result = await authApi.signup(formData);
    if (result?.user) {
      setUser(result.user);
    }
    return result?.user;
  };

  const forgotPassword = async (email) => {
    return await authApi.forgotPassword(email);
  };

  const resetPassword = async (payload) => {
    return await authApi.resetPassword(payload);
  };

  const changePassword = async (payload) => {
    const res = await authApi.changePassword(payload);
    setUser(null);
    return res;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const updateRates = async (hourlyRate) => {
    const updated = await authApi.updateWorkerRates(hourlyRate);
    if (updated) {
      setUser({ ...updated });
    }
    return updated;
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      try {
        localStorage.setItem('serviq_session_user', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save session user:', e);
      }
      return updated;
    });
  };

  const value = {
    user,
    role: user?.role || null,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    forgotPassword,
    resetPassword,
    changePassword,
    logout,
    updateRates,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
