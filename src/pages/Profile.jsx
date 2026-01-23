import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Smartphone, Save, Check, AlertCircle, Shield, Bell, ChevronRight, Settings, CreditCard, LogOut, BarChart3, Users, Calendar, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import Navbar from '../components/layout/Navbar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useToast } from '../hooks/use-toast';
import { isValidUpiId } from '../lib/utils';

const Profile = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUserProfile, logout } = useAuth();
  const { groups, expenses } = useGroups();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [upiId, setUpiId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setUpiId(user.upiId || '');
    }
  }, [user]);

  if (!isAuthenticated || !user) return null;

  const userGroups = groups.filter(g => g.members.includes(user?.id || ''));
  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently';
  const totalExpensesCount = expenses.filter(exp => userGroups.some(g => g.id === exp.groupId)).length;

  const handleSave = async () => {
    // Reset errors
    setErrors({});

    // Validate inputs
    const newErrors = {};

    const trimmedName = name.trim();
    const trimmedUpiId = upiId.trim();

    if (!trimmedName) {
      newErrors.name = 'Name is required';
    } else if (trimmedName.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    } else if (trimmedName.length > 50) {
      newErrors.name = 'Name must be less than 50 characters';
    }

    if (trimmedUpiId && !isValidUpiId(trimmedUpiId)) {
      newErrors.upiId = 'Invalid UPI ID format. Should be: username@bankname';
    }

    // If there are errors, show them and return
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: "Validation Error",
        description: "Please fix the errors and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const success = await updateUserProfile({
        name: trimmedName,
        upiId: trimmedUpiId || undefined,
      });

      if (success) {
        toast({
          title: "Profile updated!",
          description: "Your profile settings have been saved.",
        });
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        {/* Desktop Layout */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-8 xl:col-span-9">
            {/* Back Button - Mobile */}
            <button
              onClick={() => navigate('/dashboard')}
              className="lg:hidden flex items-center gap-2 text-muted-foreground hover:text-primary mb-6 transition-colors min-h-[44px] min-w-[44px]"
            >
              <ArrowLeft size={18} />
              <span className="text-sm">Back to Dashboard</span>
            </button>

            {/* Page Header */}
            <div className="mb-6 lg:mb-8 animate-fade-in">
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
                Profile Settings
              </h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Settings size={14} />
                <span>Manage your account details and payment preferences</span>
              </p>
            </div>

            {/* Profile Card */}
            <Card className="mb-5 animate-fade-in border-border/50 shadow-sm hover:shadow-md transition-shadow" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded bg-primary/10 border border-primary/20">
                    <User className="text-primary" size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Personal Information</CardTitle>
                    <CardDescription>
                      Update your name and email address
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-medium">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors({ ...errors, name: undefined });
                    }}
                    placeholder="Enter your full name"
                    className={`min-h-[48px] ${errors.name ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                  />
                  {errors.name && (
                    <div className="flex items-center gap-1.5 text-sm text-destructive">
                      <AlertCircle size={14} />
                      <span>{errors.name}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-medium">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted/50 min-h-[48px] text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield size={12} />
                    Email cannot be changed for security reasons
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* UPI Settings Card */}
            <Card className="mb-5 animate-fade-in border-border/50 shadow-sm hover:shadow-md transition-shadow" style={{ animationDelay: '0.15s' }}>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded bg-success/10 border border-success/20">
                    <Smartphone className="text-success" size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">UPI Payment Settings</CardTitle>
                    <CardDescription>
                      Add your UPI ID to receive payments directly
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Warning about UPI verification */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertCircle className="text-warning mt-0.5 flex-shrink-0" size={18} />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Important</p>
                    <p className="text-muted-foreground">
                      We only verify the format of UPI IDs, not their validity. Please double-check your UPI ID before saving.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="upiId" className="font-medium">UPI ID</Label>
                  <Input
                    id="upiId"
                    value={upiId}
                    onChange={(e) => {
                      setUpiId(e.target.value);
                      if (errors.upiId) setErrors({ ...errors, upiId: undefined });
                    }}
                    placeholder="yourname@okicici"
                    className={`min-h-[48px] ${errors.upiId ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                  />
                  {errors.upiId ? (
                    <div className="flex items-center gap-1.5 text-sm text-destructive">
                      <AlertCircle size={14} />
                      <span>{errors.upiId}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      This will be used when others want to pay you via UPI apps
                    </p>
                  )}
                </div>

                {/* UPI ID Preview */}
                {upiId && upiId.includes('@') && (
                  <div className="p-4 bg-success/10 rounded border border-success/20">
                    <div className="flex items-center gap-2 text-success mb-1">
                      <Check size={16} />
                      <span className="text-sm font-medium">Valid UPI ID format</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Others can pay you at: <span className="font-mono font-semibold text-foreground">{upiId}</span>
                    </p>
                  </div>
                )}

                {/* Common UPI Handles */}
                <div className="pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground mb-3">Common UPI handles:</p>
                  <div className="flex flex-wrap gap-2">
                    {['@okicici', '@ybl', '@paytm', '@oksbi', '@okhdfcbank', '@axl'].map((handle) => (
                      <button
                        key={handle}
                        type="button"
                        onClick={() => {
                          const username = upiId.split('@')[0] || user.name.toLowerCase().replace(/\s/g, '');
                          setUpiId(username + handle);
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-card border border-border/50 hover:bg-primary/10 hover:border-primary/30 hover:text-primary rounded-lg transition-all min-h-[32px]"
                      >
                        {handle}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings Link */}
            <Card
              className="mb-5 animate-fade-in border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
              style={{ animationDelay: '0.2s' }}
              onClick={() => navigate('/settings/notifications')}
            >
              <CardContent className="py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded bg-warning/10 border border-warning/20">
                      <Bell className="text-warning" size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Notification Settings</p>
                      <p className="text-sm text-muted-foreground">
                        Manage email preferences & budget alerts
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground" size={20} />
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              className="w-full min-h-[52px] h-auto text-base shadow-lg shadow-primary/25 hover:shadow-xl transition-all animate-fade-in"
              size="lg"
              disabled={isSaving}
              style={{ animationDelay: '0.25s' }}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Saving...
                </span>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          {/* Sidebar - Desktop Only */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 space-y-6">
              {/* User Profile Card */}
              <Card className="border-border/50 shadow-sm animate-fade-in overflow-hidden" style={{ animationDelay: '0.1s' }}>
                <div className="h-16 bg-primary/20" />
                <CardContent className="p-5 -mt-8">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground mx-auto mb-3 shadow-lg border-4 border-background">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="font-display font-semibold text-lg text-foreground">{user.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                      <Mail size={12} />
                      {user.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                      <Calendar size={12} />
                      Member since {memberSince}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Account Stats */}
              <Card className="border-border/50 shadow-sm animate-fade-in" style={{ animationDelay: '0.15s' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BarChart3 size={16} className="text-primary" />
                    Your Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Groups</span>
                    <span className="font-semibold text-foreground">{userGroups.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expenses</span>
                    <span className="font-semibold text-foreground">{totalExpensesCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">UPI Configured</span>
                    <span className="font-semibold text-foreground">{user.upiId ? 'Yes' : 'No'}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card className="border-border/50 shadow-sm animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CreditCard size={16} className="text-primary" />
                    Quick Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button onClick={() => navigate('/dashboard')} variant="ghost" className="w-full justify-start gap-3 h-10">
                    <BarChart3 size={16} className="text-muted-foreground" />
                    Dashboard
                  </Button>
                  <Button onClick={() => navigate('/groups')} variant="ghost" className="w-full justify-start gap-3 h-10">
                    <Users size={16} className="text-muted-foreground" />
                    My Groups
                  </Button>
                  <Button onClick={() => navigate('/analytics')} variant="ghost" className="w-full justify-start gap-3 h-10">
                    <BarChart3 size={16} className="text-muted-foreground" />
                    Analytics
                  </Button>
                </CardContent>
              </Card>

              {/* Logout Button */}
              <Button
                onClick={logout}
                variant="outline"
                className="w-full justify-center gap-2 h-11 border-destructive/30 text-destructive hover:bg-destructive/10 animate-fade-in"
                style={{ animationDelay: '0.25s' }}
              >
                <LogOut size={16} />
                Sign Out
              </Button>

              {/* Support Link */}
              <div className="text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <p className="text-xs text-muted-foreground">
                  Need help?{' '}
                  <a href="mailto:notifications.splitit@gmail.com" className="text-primary hover:underline">
                    Contact Support
                  </a>
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile Sign Out */}
        <div className="lg:hidden mt-6 space-y-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <Button
            onClick={logout}
            variant="outline"
            className="w-full justify-center gap-2 h-12 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <LogOut size={18} />
            Sign Out
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Need help?{' '}
            <a href="mailto:notifications.splitit@gmail.com" className="text-primary hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Profile;
