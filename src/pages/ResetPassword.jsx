import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import Logo from '../components/common/Logo';
import { useToast } from '../hooks/use-toast';
import apiClient from '../lib/apiClient';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [token, setToken] = useState('');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      toast({
        title: "Invalid Link",
        description: "This password reset link is invalid or expired.",
        variant: "destructive",
      });
      navigate('/login');
    } else {
      setToken(tokenParam);
    }
  }, [searchParams, navigate, toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset errors
    setErrors({});
    
    // Validate inputs
    const newErrors = {};
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    // If there are errors, show them and return
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setIsLoading(true);

    try {
      await apiClient.post('/auth/reset-password', {
        token,
        password,
        confirmPassword,
      });
      
      setResetSuccess(true);
      toast({
        title: "Password reset successful!",
        description: "You can now login with your new password.",
      });
    } catch (error) {
      toast({
        title: "Reset failed",
        description: error.message || "Failed to reset password. The link may have expired.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  if (resetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        {/* Background gradient effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-md relative">
          <div className="flex justify-center mb-6 sm:mb-8">
            <Logo size="lg" />
          </div>

          <div className="bg-card rounded-2xl p-6 sm:p-8 animate-fade-in border border-border/50 shadow-xl text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-primary" />
            </div>
            
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Password Reset Successful!
            </h1>
            
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              Your password has been successfully reset. You can now login with your new password.
            </p>

            <Button
              onClick={() => navigate('/login')}
              className="w-full shadow-lg shadow-primary/25"
              size="lg"
            >
              Continue to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <Logo size="lg" />
        </div>

        {/* Reset Password Card */}
        <div className="bg-card rounded-2xl p-6 sm:p-8 animate-fade-in border border-border/50 shadow-xl">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Reset Password
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Enter your new password below
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm sm:text-base font-medium">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  className={`pl-10 min-h-[48px] text-sm sm:text-base ${errors.password ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                  autoComplete="new-password"
                  autoFocus
                  required
                />
              </div>
              {errors.password && (
                <div className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle size={14} />
                  <span>{errors.password}</span>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm sm:text-base font-medium">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
                  }}
                  className={`pl-10 min-h-[48px] text-sm sm:text-base ${errors.confirmPassword ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                  autoComplete="new-password"
                  required
                />
              </div>
              {errors.confirmPassword && (
                <div className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle size={14} />
                  <span>{errors.confirmPassword}</span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full min-h-[48px] h-auto text-sm sm:text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all" 
              size="lg" 
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Resetting Password...
                </span>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Reset Password</span>
                </>
              )}
            </Button>
          </form>

          {/* Back to login link */}
          <div className="mt-6">
            <Link to="/login" className="block">
              <Button variant="ghost" className="w-full">
                <ArrowLeft size={18} />
                Back to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
