import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GroupProvider } from './context/GroupContext';
import { NotificationProvider } from './context/NotificationContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { ThemeProvider } from './context/ThemeContext';
import { ChatProvider } from './context/ChatContext';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/toaster';
import Loading from './components/common/Loading';
import ErrorBoundary from './components/common/ErrorBoundary';
import OfflineIndicator from './components/common/OfflineIndicator';
import PwaInstallPrompt from './components/common/PwaInstallPrompt';
import PushNotificationPrompt from './components/common/PushNotificationPrompt';
import './App.css';

// Lazy load pages for better performance
const Index = lazy(() => import('./pages/Index'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Groups = lazy(() => import('./pages/Groups'));
const GroupDetail = lazy(() => import('./pages/GroupDetail'));
const AddExpense = lazy(() => import('./pages/AddExpense'));
const Insights = lazy(() => import('./pages/Insights'));
const Settlements = lazy(() => import('./pages/Settlements'));
const Profile = lazy(() => import('./pages/Profile'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'));
const JoinGroup = lazy(() => import('./pages/JoinGroup'));
const NotFound = lazy(() => import('./pages/NotFound'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));

// PrivateRoute wrapper component
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Create a combined AppProvider
const AppProvider = ({ children }) => (
  <ThemeProvider>
    <AuthProvider>
      <GroupProvider>
        <NotificationProvider>
          <CurrencyProvider>
            <ChatProvider>
              {children}
            </ChatProvider>
          </CurrencyProvider>
        </NotificationProvider>
      </GroupProvider>
    </AuthProvider>
  </ThemeProvider>
);

function App() {
  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
        <BrowserRouter>
          <AppProvider>
            <TooltipProvider>
              <OfflineIndicator />
              <PwaInstallPrompt />
              <PushNotificationPrompt />
              <Toaster />
              <Suspense fallback={<Loading />}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/join/:inviteCode" element={<JoinGroup />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/terms-of-service" element={<TermsOfService />} />

                  {/* Protected Routes */}
                  <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                  <Route path="/groups" element={<PrivateRoute><Groups /></PrivateRoute>} />
                  <Route path="/group/:id" element={<PrivateRoute><GroupDetail /></PrivateRoute>} />
                  <Route path="/add-expense" element={<PrivateRoute><AddExpense /></PrivateRoute>} />
                  <Route path="/insights" element={<PrivateRoute><Insights /></PrivateRoute>} />
                  <Route path="/settlements" element={<PrivateRoute><Settlements /></PrivateRoute>} />
                  <Route path="/summary" element={<Navigate to="/insights" replace />} />
                  <Route path="/analytics" element={<Navigate to="/insights" replace />} />
                  <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                  <Route path="/settings/notifications" element={<PrivateRoute><NotificationSettings /></PrivateRoute>} />

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </TooltipProvider>
          </AppProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}

export default App;
