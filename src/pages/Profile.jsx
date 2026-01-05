import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Smartphone, Save, Check, AlertCircle, Moon, Sun, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Navbar from '../components/layout/Navbar';
import PushNotificationToggle from '../components/common/PushNotificationToggle';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useToast } from '../hooks/use-toast';
import { isValidUpiId } from '../lib/utils';

const Profile = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUserProfile } = useAuth();
  const { theme, setLightTheme, setDarkTheme } = useTheme();
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
      
      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8 max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft size={18} />
          <span className="text-sm sm:text-base">Back to Dashboard</span>
        </button>

        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Profile Settings
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your account details and payment preferences
          </p>
        </div>

        {/* Profile Card */}
        <Card className="mb-4 sm:mb-6 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <User size={18} />
              Personal Information
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Update your name and email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm sm:text-base">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                placeholder="Enter your full name"
                className={`min-h-[44px] text-sm sm:text-base ${errors.name ? 'border-destructive' : ''}`}
              />
              {errors.name && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle size={14} />
                  <span>{errors.name}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-muted min-h-[44px] text-sm sm:text-base"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
          </CardContent>
        </Card>

        {/* UPI Settings Card */}
        <Card className="mb-4 sm:mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Smartphone size={18} />
              UPI Payment Settings
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Add your UPI ID to receive payments directly from group members
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upiId" className="text-sm sm:text-base">UPI ID</Label>
              <Input
                id="upiId"
                value={upiId}
                onChange={(e) => {
                  setUpiId(e.target.value);
                  if (errors.upiId) setErrors({ ...errors, upiId: undefined });
                }}
                placeholder="yourname@okicici"
                className={`min-h-[44px] text-sm sm:text-base ${errors.upiId ? 'border-destructive' : ''}`}
              />
              {errors.upiId ? (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle size={14} />
                  <span>{errors.upiId}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This will be used when others want to pay you via UPI apps like GPay, PhonePe, or Paytm
                </p>
              )}
            </div>

            {/* UPI ID Preview */}
            {upiId && upiId.includes('@') && (
              <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                <div className="flex items-center gap-2 text-success mb-1">
                  <Check size={16} />
                  <span className="text-sm font-medium">Valid UPI ID format</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Others can pay you at: <span className="font-mono font-medium text-foreground">{upiId}</span>
                </p>
              </div>
            )}

            {/* Common UPI Handles */}
            <div className="pt-4 border-t border-border">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">Common UPI handles:</p>
              <div className="flex flex-wrap gap-2">
                {['@okicici', '@ybl', '@paytm', '@oksbi', '@okhdfcbank', '@axl'].map((handle) => (
                  <button
                    key={handle}
                    type="button"
                    onClick={() => {
                      const username = upiId.split('@')[0] || user.name.toLowerCase().replace(/\s/g, '');
                      setUpiId(username + handle);
                    }}
                    className="px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded-md transition-colors min-h-[32px]"
                  >
                    {handle}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card className="mb-4 sm:mb-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              Appearance
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Choose your preferred theme
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={setLightTheme}
                className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  theme === 'light' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Sun size={20} className="text-yellow-500" />
                <span className="font-medium">Light</span>
                {theme === 'light' && <Check size={16} className="text-primary ml-2" />}
              </button>
              <button
                onClick={setDarkTheme}
                className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  theme === 'dark' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Moon size={20} className="text-slate-400" />
                <span className="font-medium">Dark</span>
                {theme === 'dark' && <Check size={16} className="text-primary ml-2" />}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="mb-4 sm:mb-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Bell size={18} />
              Notifications
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Manage how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PushNotificationToggle />
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          className="w-full min-h-[44px] h-auto text-sm sm:text-base" 
          size="lg"
          disabled={isSaving}
        >
          {isSaving ? (
            <>Saving...</>
          ) : (
            <>
              <Save size={18} />
              Save Changes
            </>
          )}
        </Button>
      </main>
    </div>
  );
};

export default Profile;
