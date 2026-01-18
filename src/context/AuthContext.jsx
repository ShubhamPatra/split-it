import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import apiClient from '../lib/apiClient';
import { initializePushNotifications, unsubscribeFromPush } from '../utils/registerServiceWorker';
import { initializeSocket, disconnectSocket } from '../lib/socketClient';

// Create the context with default values
const AuthContext = createContext(undefined);

// AuthProvider component that wraps the app
export const AuthProvider = ({ children }) => {
  // State to store the current logged-in user
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated
  const isAuthenticated = user !== null;

  // Create session helper - stores only user info, NOT token (token is in HttpOnly cookie)
  const createSession = (userData) => {
    const session = {
      user: { 
        id: userData.id?.toString() || userData.id, 
        name: userData.name, 
        email: userData.email,
        upiId: userData.upiId || ''
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    // Use localStorage for persistent login across page refreshes and PWA restarts
    localStorage.setItem('splitit_user', JSON.stringify(session));
    setUser(session.user);
    
    // Initialize push notifications after login (async, don't block)
    initializePushNotifications().then(result => {
      if (!result.success && !result.alreadySubscribed) {
        console.log('Push notifications not enabled:', result.error);
      }
    }).catch(err => console.warn('Push init failed:', err));
    
    return session;
  };

  // Socket lifecycle management - single owner pattern
  // AuthContext owns the socket connection, initializes on login, disconnects on logout
  const socketInitializedRef = useRef(false);
  
  useEffect(() => {
    if (user && !socketInitializedRef.current) {
      // Initialize socket after successful login
      initializeSocket();
      socketInitializedRef.current = true;
    } else if (!user && socketInitializedRef.current) {
      // Disconnect socket on logout
      disconnectSocket();
      socketInitializedRef.current = false;
    }
  }, [user]);

  // Load user session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        // Check if we have a session marker (cookie auth will be sent automatically)
        const sessionData = localStorage.getItem('splitit_user');
        if (sessionData) {
          const { expiresAt } = JSON.parse(sessionData);
          if (new Date(expiresAt) > new Date()) {
            // Verify session is still valid by fetching user data
            // Cookie will be sent automatically with credentials: 'include'
            try {
              const userData = await apiClient.get('/auth/me');
              setUser({ 
                id: userData.id?.toString() || userData.id, 
                name: userData.name, 
                email: userData.email,
                upiId: userData.upiId || ''
              });
            } catch (error) {
              console.error('Session invalid:', error);
              localStorage.removeItem('splitit_user');
            }
          } else {
            localStorage.removeItem('splitit_user');
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
      createSession(response.user);
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
      createSession(response.user);
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
      createSession(response.user);
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
      createSession(response);
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };

  // Logout function - clears session and calls logout endpoint to clear cookie
  const logout = async () => {
    // Unsubscribe from push notifications
    try {
      await unsubscribeFromPush();
    } catch (error) {
      console.warn('Push unsubscribe failed:', error);
    }
    
    try {
      await apiClient.post('/auth/logout', {});
    } catch (error) {
      console.error('Logout API error:', error);
    }
    localStorage.removeItem('splitit_user');
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

