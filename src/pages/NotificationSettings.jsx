import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Bell, Calendar, PiggyBank, FileText, Save, Loader2, Smartphone, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useToast } from '../hooks/use-toast';
import apiClient from '../lib/apiClient';
import {
  initializePushNotifications,
  getPushNotificationStatus,
  unsubscribeFromPush
} from '../utils/registerServiceWorker';

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailPreferences, setEmailPreferences] = useState({
    weeklyDigest: false,
    monthlyDigest: false,
    expenseAdded: true,
    settlementConfirmation: true,
    paymentReminders: true,
    recurringExpenseReminder: true,
    recurringExpenseGenerated: false,
    memberJoined: true,
    groupInvite: true,
    budgetAlerts: true,
    exportReports: true,
  });

  const [budgetSettings, setBudgetSettings] = useState({
    monthlyLimit: 0,
    alertThreshold: 80,
  });

  const [spendingData, setSpendingData] = useState(null);
  const [spendingLoading, setSpendingLoading] = useState(true);

  const [pushStatus, setPushStatus] = useState({
    supported: false,
    subscribed: false,
    permission: 'default',
    loading: false,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Fetch current preferences
    const fetchPreferences = async () => {
      try {
        const [emailPrefs, budgetPrefs, pushStatusResult] = await Promise.all([
          apiClient.get('/users/email-preferences'),
          apiClient.get('/users/budget-settings'),
          getPushNotificationStatus(),
        ]);

        setEmailPreferences(prev => ({ ...prev, ...emailPrefs }));
        setBudgetSettings(prev => ({ ...prev, ...budgetPrefs }));
        setPushStatus(prev => ({ ...prev, ...pushStatusResult }));
        
        // Fetch spending data if budget is enabled
        if (budgetPrefs.monthlyLimit > 0) {
          fetchSpendingData();
        } else {
          setSpendingLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your preferences',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [isAuthenticated, navigate, toast]);

  const fetchSpendingData = async () => {
    try {
      const spending = await apiClient.get('/users/spending');
      setSpendingData(spending);
    } catch (error) {
      console.error('Failed to fetch spending data:', error);
    } finally {
      setSpendingLoading(false);
    }
  };

  const handleToggle = (key) => {
    setEmailPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleBudgetChange = (key, value) => {
    setBudgetSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleEnablePush = async () => {
    setPushStatus(prev => ({ ...prev, loading: true }));
    try {
      const result = await initializePushNotifications();
      if (result.success) {
        setPushStatus(prev => ({
          ...prev,
          subscribed: true,
          permission: 'granted',
          loading: false
        }));
        toast({
          title: 'Push notifications enabled',
          description: 'You will now receive push notifications.',
        });
      } else {
        toast({
          title: 'Could not enable push notifications',
          description: result.error || 'Please check your browser settings.',
          variant: 'destructive',
        });
        setPushStatus(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to enable push notifications.',
        variant: 'destructive',
      });
      setPushStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDisablePush = async () => {
    setPushStatus(prev => ({ ...prev, loading: true }));
    try {
      await unsubscribeFromPush();
      setPushStatus(prev => ({
        ...prev,
        subscribed: false,
        loading: false
      }));
      toast({
        title: 'Push notifications disabled',
        description: 'You will no longer receive push notifications.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disable push notifications.',
        variant: 'destructive',
      });
      setPushStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleTestPush = async () => {
    try {
      await apiClient.post('/push/test');
      toast({
        title: 'Test notification sent',
        description: 'You should receive a push notification shortly.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send test notification. Make sure push is enabled.',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        apiClient.put('/users/email-preferences', emailPreferences),
        apiClient.put('/users/budget-settings', budgetSettings),
      ]);

      toast({
        title: 'Preferences saved',
        description: 'Your notification settings have been updated.',
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const PreferenceItem = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5 pr-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        onClick={onChange}
        className={`text-sm font-medium transition-colors ${checked
            ? 'text-destructive hover:text-destructive/80'
            : 'text-primary hover:text-primary/80'
          }`}
      >
        {checked ? 'Unsubscribe' : 'Subscribe'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8 max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-6 transition-colors min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Profile</span>
        </button>

        {/* Page Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Notification Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your email notifications and budget alerts
          </p>
        </div>

        {/* Push Notifications */}
        <Card className="mb-6 animate-fade-in border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded bg-primary/10 border border-primary/20">
                <Smartphone className="text-primary" size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">Push Notifications</CardTitle>
                <CardDescription>
                  Receive instant alerts on your device
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!pushStatus.supported ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <XCircle size={16} className="text-destructive" />
                <span>Push notifications are not supported in this browser</span>
              </div>
            ) : pushStatus.permission === 'denied' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <XCircle size={16} className="text-destructive" />
                  <span>Push notifications are blocked</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  To enable, click the lock icon in your browser's address bar and allow notifications.
                </p>
              </div>
            ) : pushStatus.subscribed ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-success" />
                  <span className="text-foreground">Push notifications are enabled</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestPush}
                    className="text-xs"
                  >
                    Send Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisablePush}
                    disabled={pushStatus.loading}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    {pushStatus.loading ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Disable
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Get instant notifications for new expenses, payments, and chat messages even when the app is closed.
                </p>
                <Button
                  onClick={handleEnablePush}
                  disabled={pushStatus.loading}
                  size="sm"
                >
                  {pushStatus.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Bell size={16} className="mr-2" />
                  )}
                  Enable Push Notifications
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Digest Emails */}
        <Card className="mb-6 animate-fade-in border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded bg-primary/10 border border-primary/20">
                <Calendar className="text-primary" size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">Digest Emails</CardTitle>
                <CardDescription>
                  Periodic summaries of your expenses
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            <PreferenceItem
              label="Weekly Digest"
              description="Summary of expenses every Monday morning"
              checked={emailPreferences.weeklyDigest}
              onChange={() => handleToggle('weeklyDigest')}
            />
            <PreferenceItem
              label="Monthly Digest"
              description="Monthly expense summary on the 1st"
              checked={emailPreferences.monthlyDigest}
              onChange={() => handleToggle('monthlyDigest')}
            />
          </CardContent>
        </Card>

        {/* Transaction Emails */}
        <Card className="mb-6 animate-fade-in border-border/50 shadow-sm" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded bg-success/10 border border-success/20">
                <Mail className="text-success" size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">Transaction Emails</CardTitle>
                <CardDescription>
                  Notifications for expenses and settlements
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            <PreferenceItem
              label="Expense Added"
              description="When someone adds an expense you're part of"
              checked={emailPreferences.expenseAdded}
              onChange={() => handleToggle('expenseAdded')}
            />
            <PreferenceItem
              label="Settlement Confirmation"
              description="When a payment is made or received"
              checked={emailPreferences.settlementConfirmation}
              onChange={() => handleToggle('settlementConfirmation')}
            />
            <PreferenceItem
              label="Payment Reminders"
              description="Reminders about pending settlements"
              checked={emailPreferences.paymentReminders}
              onChange={() => handleToggle('paymentReminders')}
            />
          </CardContent>
        </Card>

        {/* Recurring Expenses */}
        <Card className="mb-6 animate-fade-in border-border/50 shadow-sm" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded bg-warning/10 border border-warning/20">
                <Bell className="text-warning" size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">Recurring Expenses</CardTitle>
                <CardDescription>
                  Notifications for scheduled expenses
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            <PreferenceItem
              label="Upcoming Reminders"
              description="Email before a recurring expense is due"
              checked={emailPreferences.recurringExpenseReminder}
              onChange={() => handleToggle('recurringExpenseReminder')}
            />
            <PreferenceItem
              label="Generated Notifications"
              description="When a recurring expense is auto-generated"
              checked={emailPreferences.recurringExpenseGenerated}
              onChange={() => handleToggle('recurringExpenseGenerated')}
            />
          </CardContent>
        </Card>

        {/* Group Notifications */}
        <Card className="mb-6 animate-fade-in border-border/50 shadow-sm" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded bg-info/10 border border-info/20">
                <Bell className="text-info" size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">Group Notifications</CardTitle>
                <CardDescription>
                  Updates about your groups
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            <PreferenceItem
              label="Member Joined"
              description="When someone joins your group"
              checked={emailPreferences.memberJoined}
              onChange={() => handleToggle('memberJoined')}
            />
            <PreferenceItem
              label="Group Invites"
              description="When you're invited to a group"
              checked={emailPreferences.groupInvite}
              onChange={() => handleToggle('groupInvite')}
            />
          </CardContent>
        </Card>

        {/* Budget & Reports */}
        <Card className="mb-6 animate-fade-in border-border/50 shadow-sm" style={{ animationDelay: '0.4s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20">
                <PiggyBank className="text-destructive" size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">Budget & Reports</CardTitle>
                <CardDescription>
                  Budget alerts and export notifications
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            <PreferenceItem
              label="Budget Alerts"
              description="When you approach or exceed budget limits"
              checked={emailPreferences.budgetAlerts}
              onChange={() => handleToggle('budgetAlerts')}
            />
            <PreferenceItem
              label="Export Reports"
              description="Receive exported reports via email"
              checked={emailPreferences.exportReports}
              onChange={() => handleToggle('exportReports')}
            />
          </CardContent>
        </Card>

        {/* Budget Settings */}
        <Card className="mb-6 animate-fade-in border-border/50 shadow-sm" style={{ animationDelay: '0.5s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded bg-primary/10 border border-primary/20">
                <FileText className="text-primary" size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">Personal Budget</CardTitle>
                <CardDescription>
                  Track your spending across all groups
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Spending Status - Show if budget is set */}
            {budgetSettings.monthlyLimit > 0 && spendingData && !spendingLoading && (
              <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">This Month's Spending</span>
                  <span className={`text-lg font-bold ${spendingData.isOverBudget ? 'text-destructive' : spendingData.isNearLimit ? 'text-warning' : 'text-foreground'}`}>
                    ₹{spendingData.totalSpending.toLocaleString()}
                  </span>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Budget: ₹{spendingData.monthlyLimit.toLocaleString()}</span>
                    <span className={`font-medium ${spendingData.isOverBudget ? 'text-destructive' : 'text-foreground'}`}>
                      {spendingData.percentUsed.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all ${spendingData.isOverBudget ? 'bg-destructive' : spendingData.isNearLimit ? 'bg-warning' : 'bg-success'}`}
                      style={{ width: `${Math.min(spendingData.percentUsed, 100)}%` }}
                    />
                  </div>
                </div>

                {spendingData.isOverBudget && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <XCircle size={12} />
                    Over budget by ₹{(spendingData.totalSpending - spendingData.monthlyLimit).toLocaleString()}
                  </p>
                )}
                
                {spendingData.isNearLimit && !spendingData.isOverBudget && (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <Bell size={12} />
                    Approaching budget limit (₹{spendingData.remaining.toLocaleString()} remaining)
                  </p>
                )}

                {!spendingData.isOverBudget && !spendingData.isNearLimit && spendingData.monthlyLimit > 0 && (
                  <p className="text-xs text-success flex items-center gap-1">
                    <CheckCircle size={12} />
                    ₹{spendingData.remaining.toLocaleString()} remaining this month
                  </p>
                )}

                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{spendingData.groupCount} groups • {spendingData.expenseCount} expenses</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="monthlyLimit">Monthly Spending Limit (₹)</Label>
              <Input
                id="monthlyLimit"
                type="number"
                min="0"
                step="100"
                value={budgetSettings.monthlyLimit || ''}
                onChange={(e) => handleBudgetChange('monthlyLimit', parseInt(e.target.value) || 0)}
                placeholder="e.g., 10000"
                className="min-h-[48px]"
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 to disable monthly budget alerts
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alertThreshold">Alert Threshold (%)</Label>
              <Input
                id="alertThreshold"
                type="number"
                min="1"
                max="100"
                value={budgetSettings.alertThreshold || 80}
                onChange={(e) => handleBudgetChange('alertThreshold', Math.min(100, Math.max(1, parseInt(e.target.value) || 80)))}
                className="min-h-[48px]"
              />
              <p className="text-xs text-muted-foreground">
                Get alerted when spending reaches this percentage of your limit
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          className="w-full min-h-[52px] h-auto text-base shadow-lg shadow-primary/25 hover:shadow-xl transition-all"
          size="lg"
          disabled={saving}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : (
            <>
              <Save size={18} />
              Save Preferences
            </>
          )}
        </Button>

        {/* Info Note */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          Account emails (password reset, security alerts) cannot be disabled for your security.
        </p>
      </main>
    </div>
  );
};

export default NotificationSettings;
