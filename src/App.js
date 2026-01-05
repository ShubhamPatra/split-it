import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GroupProvider } from './context/GroupContext';
import { NotificationProvider } from './context/NotificationContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/toaster';
import Loading from './components/common/Loading';
import ErrorBoundary from './components/common/ErrorBoundary';
import OfflineIndicator from './components/common/OfflineIndicator';
import PwaInstallPrompt from './components/common/PwaInstallPrompt';
import './App.css';

// Lazy load pages for better performance
const Index = lazy(() => import('./pages/Index'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Groups = lazy(() => import('./pages/Groups'));
const GroupDetail = lazy(() => import('./pages/GroupDetail'));
const AddExpense = lazy(() => import('./pages/AddExpense'));
const Summary = lazy(() => import('./pages/Summary'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Profile = lazy(() => import('./pages/Profile'));
const JoinGroup = lazy(() => import('./pages/JoinGroup'));
const NotFound = lazy(() => import('./pages/NotFound'));

// PrivateRoute wrapper component
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <Loading />;
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
          <BrowserRouter>
            <AuthProvider>
              <SocketProvider>
                <GroupProvider>
                  <NotificationProvider>
                    <CurrencyProvider>
                      <TooltipProvider>
                        <OfflineIndicator />
                        <PwaInstallPrompt />
                        <Toaster />
                        <Suspense fallback={<Loading />}>
                          <Routes>
                            {/* Public Routes */}
                            <Route path="/" element={<Index />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/signup" element={<Signup />} />
                            <Route path="/join/:inviteCode" element={<JoinGroup />} />
                            
                            {/* Protected Routes */}
                            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                            <Route path="/groups" element={<PrivateRoute><Groups /></PrivateRoute>} />
                            <Route path="/group/:id" element={<PrivateRoute><GroupDetail /></PrivateRoute>} />
                            <Route path="/add-expense" element={<PrivateRoute><AddExpense /></PrivateRoute>} />
                            <Route path="/summary" element={<PrivateRoute><Summary /></PrivateRoute>} />
                            <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
                            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                            
                            {/* Catch-all */}
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </Suspense>
                      </TooltipProvider>
                    </CurrencyProvider>
                  </NotificationProvider>
                </GroupProvider>
              </SocketProvider>
            </AuthProvider>
          </BrowserRouter>
        </GoogleOAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
