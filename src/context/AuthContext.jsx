import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

// Create the context with default values
const AuthContext = createContext(undefined);

// AuthProvider component that wraps the app
export const AuthProvider = ({ children }) => {
  // State to store the current logged-in user
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated
  const isAuthenticated = user !== null;

  // Create session helper
  const createSession = (userData, token) => {
    const session = {
      user: { 
        id: userData.id, 
        name: userData.name, 
        email: userData.email,
        upiId: userData.upiId || ''
      },
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    localStorage.setItem('splitit_session', JSON.stringify(session));
    setUser(session.user);
    return session;
  };

  // Load user session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessionData = localStorage.getItem('splitit_session');
        if (sessionData) {
          const { token, expiresAt } = JSON.parse(sessionData);
          if (new Date(expiresAt) > new Date() && token) {
            // Verify token is still valid by fetching user data
            try {
              const userData = await apiClient.get('/auth/me');
              setUser({ 
                id: userData.id, 
                name: userData.name, 
                email: userData.email,
                upiId: userData.upiId || ''
              });
            } catch (error) {
              console.error('Session invalid:', error);
              localStorage.removeItem('splitit_session');
            }
          } else {
            localStorage.removeItem('splitit_session');
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, []);



  // Register function - creates user via API
  const register = async (name, email, password) => {
    try {
      const response = await apiClient.post('/auth/register', { name, email, password });
      createSession(response.user, response.token);
      console.log('Registration successful:', email);
      return { success: response.success, needsConfirmation: response.needsConfirmation };
    } catch (error) {
      throw new Error(error.message || 'Registration failed');
    }
  };

  // Login function - authenticates via API
  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      createSession(response.user, response.token);
      console.log('Login successful:', email);
      return true;
    } catch (error) {
      throw new Error(error.message || 'Login failed');
    }
  };

  // Google login function - authenticates with Google credential
  const googleLogin = async (credential) => {
    try {
      const response = await apiClient.post('/auth/google', { credential });
      createSession(response.user, response.token);
      console.log('Google login successful:', response.user.email);
      return true;
    } catch (error) {
      throw new Error(error.message || 'Google login failed');
    }
  };

  // Signup function - alias for register
  const signup = async (name, email, password) => {
    return register(name, email, password);
  };

  // Update user profile
  const updateUserProfile = async (updates) => {
    if (!user) return false;
    try {
      const response = await apiClient.put('/users/profile', updates);
      createSession(response, localStorage.getItem('splitit_session') ? JSON.parse(localStorage.getItem('splitit_session')).token : null);
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };

  // Logout function - clears localStorage session and revokes Google token
  const logout = async () => {
    // Revoke Google OAuth session if available
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    localStorage.removeItem('splitit_session');
    setUser(null);
  };

  // Provide the context value to children
  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      login,
      googleLogin,
      signup, 
      register,
      logout, 
      updateUserProfile, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the Auth Context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

