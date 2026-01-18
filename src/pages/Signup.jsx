import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, UserPlus, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import Logo from '../components/common/Logo';
import { useToast } from '../hooks/use-toast';
import { isValidEmail } from '../lib/utils';

const Signup = () => {
  const navigate = useNavigate();
  const { signup, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Form state using useState hook
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      newErrors.name = 'Name is required';
    } else if (trimmedName.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    } else if (trimmedName.length > 50) {
      newErrors.name = 'Name must be less than 50 characters';
    }

    if (!trimmedEmail) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (password.length > 100) {
      newErrors.password = 'Password is too long';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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

    setIsLoading(true);

    try {
      const result = await signup(trimmedName, trimmedEmail, password);

      if (result.success) {
        if (result.needsConfirmation) {
          toast({
            title: "Check your email",
            description: "We sent you a confirmation link. Please check your inbox to verify your account.",
          });
        } else {
          toast({
            title: "Account created!",
            description: "Welcome to Split-It. Let's start splitting expenses!",
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
      }
    } catch (error) {
      toast({
        title: "Signup failed",
        description: error.message || "Unable to create account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <Logo size="lg" />
        </div>

        {/* Signup Card */}
        <div className="bg-card rounded p-6 sm:p-8 animate-fade-in border border-border shadow-sm">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Create Account
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Start splitting expenses with friends
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm sm:text-base font-medium">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors({ ...errors, name: undefined });
                  }}
                  className={`pl-10 min-h-[48px] text-sm sm:text-base ${errors.name ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                  autoComplete="name"
                  required
                />
              </div>
              {errors.name && (
                <div className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle size={14} />
                  <span>{errors.name}</span>
                </div>
              )}
            </div>

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
              {errors.email && (
                <div className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle size={14} />
                  <span>{errors.email}</span>
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm sm:text-base font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password (min 6 characters)"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  className={`pl-10 min-h-[48px] text-sm sm:text-base ${errors.password ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                  autoComplete="new-password"
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
                  placeholder="Confirm your password"
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
            <Button type="submit" className="w-full min-h-[48px] text-sm sm:text-base" size="lg" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Creating account...
                </span>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Create Account</span>
                </>
              )}
            </Button>
          </form>

          {/* Sign in link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:text-primary-dark transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
