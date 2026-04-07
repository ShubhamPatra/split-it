import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, LogIn } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/common/SEO';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { FormFieldError } from '../components/ui/form-field-error';
import Logo from '../components/common/Logo';
import { useToast } from '../hooks/use-toast';
import { isValidEmail } from '../lib/utils';

const Login = () => {
  const navigate = useNavigate();
  const { login, googleLogin, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Form state using useState hook
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // useEffect to redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Check for pending invite code or token
      const pendingInviteCode = sessionStorage.getItem('pendingInviteCode');
      const pendingInviteToken = sessionStorage.getItem('pendingInviteToken');
      if (pendingInviteCode) {
        sessionStorage.removeItem('pendingInviteCode');
        navigate(`/join/${pendingInviteCode}`);
      } else if (pendingInviteToken) {
        sessionStorage.removeItem('pendingInviteToken');
        navigate(`/join/${pendingInviteToken}`);
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, navigate]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Reset errors
    setErrors({});

    // Validate inputs
    const newErrors = {};
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // If there are errors, show them and return
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      const success = await login(trimmedEmail, password);

      if (success) {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });

        // Check for pending invite code or token
        const pendingInviteCode = sessionStorage.getItem('pendingInviteCode');
        const pendingInviteToken = sessionStorage.getItem('pendingInviteToken');
        if (pendingInviteCode) {
          sessionStorage.removeItem('pendingInviteCode');
          navigate(`/join/${pendingInviteCode}`);
        } else if (pendingInviteToken) {
          sessionStorage.removeItem('pendingInviteToken');
          navigate(`/join/${pendingInviteToken}`);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password. Please check your credentials.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Handle Google login success
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      const success = await googleLogin(credentialResponse.credential);

      if (success) {
        toast({
          title: "Welcome!",
          description: "You have successfully signed in with Google.",
        });

        // Check for pending invite code or token
        const pendingInviteCode = sessionStorage.getItem('pendingInviteCode');
        const pendingInviteToken = sessionStorage.getItem('pendingInviteToken');
        if (pendingInviteCode) {
          sessionStorage.removeItem('pendingInviteCode');
          navigate(`/join/${pendingInviteCode}`);
        } else if (pendingInviteToken) {
          sessionStorage.removeItem('pendingInviteToken');
          navigate(`/join/${pendingInviteToken}`);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: error.message || "Failed to sign in with Google. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Handle Google login error
  const handleGoogleError = () => {
    toast({
      title: "Login failed",
      description: "Failed to sign in with Google. Please try again.",
      variant: "destructive",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SEO title="Login" description="Sign in to Split-It to manage your shared expenses with friends and groups." />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <Logo size="lg" />
        </div>

        {/* Login Card */}
        <div className="bg-card rounded p-6 sm:p-8 animate-fade-in border border-border shadow-sm">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Sign In
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Sign in to manage your shared expenses
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  className={`pl-10 min-h-[48px] text-sm sm:text-base ${errors.email ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                  autoComplete="email"
                  required
                />
              </div>
              <FormFieldError error={errors.email} />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm sm:text-base font-medium">Password</Label>
                <Link to="/forgot-password" className="text-xs sm:text-sm text-primary hover:text-primary-dark transition-colors font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  className={`pl-10 min-h-[48px] text-sm sm:text-base ${errors.password ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                  autoComplete="current-password"
                  required
                />
              </div>
              <FormFieldError error={errors.password} />
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full min-h-[48px] h-auto text-sm sm:text-base" size="lg" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Sign In</span>
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Google Sign In */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              size="large"
              text="signin_with"
              shape="rectangular"
              use_fedcm_for_button={true}
            />
          </div>

          {/* Sign up link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-semibold hover:text-primary-dark transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
