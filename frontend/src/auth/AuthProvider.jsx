import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAuthTokenGetter, fetchCurrentUser, loginUser, signupUser, acceptInviteUser } from '../api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'macai_auth_token';
const USER_KEY = 'macai_auth_user';

function getInitials(name = '', email = '') {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'AD';
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Synchronize api.js token getter immediately and keep updated
  if (token) {
    setAuthTokenGetter(async () => token);
  }

  useEffect(() => {
    setAuthTokenGetter(async () => token);
  }, [token]);

  // If token exists on load, verify session in background with /api/v1/me
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    fetchCurrentUser()
      .then((profile) => {
        if (!isMounted) return;
        const initials = getInitials(profile.name, profile.email);
        const updatedUser = { ...profile, initials };
        setUser(updatedUser);
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        } catch (e) {
          console.warn('Could not save user profile to localStorage', e);
        }
      })
      .catch((err) => {
        console.warn('Stored token background verification warning:', err);
        if (
          err.message &&
          (err.message.includes('401') ||
            err.message.includes('Authentication required') ||
            err.message.includes('Invalid'))
        ) {
          if (isMounted) {
            setToken(null);
            setUser(null);
            try {
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(USER_KEY);
            } catch {}
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const login = useCallback(async ({ email, password }) => {
    const data = await loginUser({ email, password });
    const authToken = data.access_token || data.id_token;
    const profile = data.user || {};
    const initials = getInitials(profile.name, profile.email);
    const fullUser = { ...profile, initials };

    setToken(authToken);
    setUser(fullUser);

    try {
      localStorage.setItem(TOKEN_KEY, authToken);
      localStorage.setItem(USER_KEY, JSON.stringify(fullUser));
    } catch (e) {
      console.warn('Could not persist session', e);
    }
    return fullUser;
  }, []);

  const signup = useCallback(async ({ email, password, name }) => {
    const data = await signupUser({ email, password, name });
    const authToken = data.access_token || data.id_token;
    const profile = data.user || {};
    const initials = getInitials(profile.name, profile.email);
    const fullUser = { ...profile, initials };

    setToken(authToken);
    setUser(fullUser);

    try {
      localStorage.setItem(TOKEN_KEY, authToken);
      localStorage.setItem(USER_KEY, JSON.stringify(fullUser));
    } catch (e) {
      console.warn('Could not persist session', e);
    }
    return fullUser;
  }, []);

  const acceptInvite = useCallback(async ({ inviteToken, password }) => {
    const data = await acceptInviteUser({ inviteToken, password });
    const authToken = data.access_token || data.id_token;
    const profile = data.user || {};
    const initials = getInitials(profile.name, profile.email);
    const fullUser = { ...profile, initials };

    setToken(authToken);
    setUser(fullUser);

    try {
      localStorage.setItem(TOKEN_KEY, authToken);
      localStorage.setItem(USER_KEY, JSON.stringify(fullUser));
    } catch (e) {
      console.warn('Could not persist session', e);
    }
    return fullUser;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setError(null);
    setAuthTokenGetter(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}
  }, []);

  const role = user?.role || 'Admin';
  const isSuperAdmin = role === 'Super Admin';
  const isAdmin = role === 'Admin' || isSuperAdmin;
  const isAuthenticated = Boolean(token && user);

  const value = {
    isAuthenticated,
    isLoading,
    error,
    user,
    role,
    isSuperAdmin,
    isAdmin,
    login,
    signup,
    acceptInvite,
    loginWithRedirect: login,
    logout,
    isMockAuth: false,
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
