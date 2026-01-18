import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import Logo from '../components/common/Logo';
import SEO from '../components/common/SEO';
import { useToast } from '../hooks/use-toast';
import { isValidEmail } from '../lib/utils';
import apiClient from '../lib/apiClient';

const ForgotPassword = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset errors
    setErrors({});
    
    // Validate email
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail) {
      setErrors({ email: 'Email is required' });
      return;
    }
    
    if (!isValidEmail(trimmedEmail)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }
    
    setIsLoading(true);

    try {
      await apiClient.post('/auth/forgot-password', { email: trimmedEmail });
      
      setEmailSent(true);
      toast({
        title: "Email sent!",
        description: "Check your inbox for password reset instructions.",
      });
    } catch (error) {
      toast({
        title: "Request failed",
        description: error.message || "Failed to send reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
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
              Check Your Email
            </h1>
            
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              We've sent password reset instructions to <strong className="text-foreground">{email}</strong>
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Didn't receive the email?</strong>
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>Check your spam folder</li>
                <li>Make sure the email address is correct</li>
                <li>Wait a few minutes and try again</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => setEmailSent(false)}
                variant="outline"
                className="w-full"
              >
                Try Another Email
              </Button>
              
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
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <SEO title="Forgot Password" description="Reset your Split-It password. Enter your email to receive password reset instructions." />
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

        {/* Forgot Password Card */}
        <div className="bg-card rounded-2xl p-6 sm:p-8 animate-fade-in border border-border/50 shadow-xl">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Forgot Password?
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Enter your email address and we'll send you instructions to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base font-medium">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({});
                  }}
                  className={`pl-10 min-h-[48px] text-sm sm:text-base ${errors.email ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
              {errors.email && (
                <div className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle size={14} />
                  <span>{errors.email}</span>
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
                  Sending...
                </span>
              ) : (
                <>
                  <Send size={18} />
                  <span>Send Reset Link</span>
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

export default ForgotPassword;
