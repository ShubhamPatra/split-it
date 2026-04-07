import React, { Suspense } from 'react';
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
import { getRouterBasename } from './utils/frontendPaths';
import Loading from './components/common/Loading';
import ErrorBoundary from './components/common/ErrorBoundary';
import OfflineIndicator from './components/common/OfflineIndicator';
import PwaInstallPrompt from './components/common/PwaInstallPrompt';
import PushNotificationPrompt from './components/common/PushNotificationPrompt';
import './App.css';

// Direct imports for offline support (no code splitting)
import Index from './pages/Index';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import AddExpense from './pages/AddExpense';
import Summary from './pages/Summary';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import NotificationSettings from './pages/NotificationSettings';
import JoinGroup from './pages/JoinGroup';
import NotFound from './pages/NotFound';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import People from './pages/People';
import PersonDetail from './pages/PersonDetail';

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
  const basename = getRouterBasename();

  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
        <BrowserRouter basename={basename}>
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
                  <Route path="/summary" element={<PrivateRoute><Summary /></PrivateRoute>} />
                  <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
                  <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                  <Route path="/settings/notifications" element={<PrivateRoute><NotificationSettings /></PrivateRoute>} />
                  <Route path="/people" element={<PrivateRoute><People /></PrivateRoute>} />
                  <Route path="/people/:personId" element={<PrivateRoute><PersonDetail /></PrivateRoute>} />

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
