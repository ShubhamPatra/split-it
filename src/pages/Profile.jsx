import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Smartphone, Save, Check, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useToast } from '../hooks/use-toast';
import { isValidUpiId } from '../lib/utils';

const Profile = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUserProfile } = useAuth();
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
          className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-6 transition-colors min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Dashboard</span>
        </button>

        {/* Page Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Profile Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account details and payment preferences
          </p>
        </div>

        {/* Profile Card */}
        <Card className="mb-6 animate-fade-in border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
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
        <Card className="mb-6 animate-fade-in border-border/50 shadow-sm hover:shadow-md transition-shadow" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20">
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
                  This will be used when others want to pay you via UPI apps like GPay, PhonePe, or Paytm
                </p>
              )}
            </div>

            {/* UPI ID Preview */}
            {upiId && upiId.includes('@') && (
              <div className="p-4 bg-gradient-to-br from-success/10 to-success/5 rounded-xl border border-success/20">
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

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          className="w-full min-h-[52px] h-auto text-base shadow-lg shadow-primary/25 hover:shadow-xl transition-all" 
          size="lg"
          disabled={isSaving}
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
      </main>
    </div>
  );
};

export default Profile;
