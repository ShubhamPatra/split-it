import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Receipt, PieChart, ArrowRight, Sparkles, Shield, Zap, CheckCircle, Smartphone, Globe, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import Logo from '../components/common/Logo';

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const features = [
    {
      icon: Users,
      title: 'Create Groups',
      description: 'Organize expenses with friends, family, or roommates',
      gradient: 'from-blue-500/20 to-blue-600/10'
    },
    {
      icon: Receipt,
      title: 'Track Expenses',
      description: 'Add and manage shared expenses easily',
      gradient: 'from-primary/20 to-primary/10'
    },
    {
      icon: PieChart,
      title: 'Split Equally',
      description: 'Automatically calculate who owes what',
      gradient: 'from-purple-500/20 to-purple-600/10'
    }
  ];

  const benefits = [
    'No sign-up fees',
    'Works offline',
    'Bank-level security',
    'UPI integration',
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-4 sm:py-8 relative">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 sm:mb-16">
          <Logo size="sm" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" onClick={() => navigate('/login')} size="sm" className="min-h-[44px] h-auto text-sm hover:bg-primary/10">
              Sign In
            </Button>
            <Button onClick={() => navigate('/signup')} size="sm" className="min-h-[44px] h-auto text-sm shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
              Get Started
            </Button>
          </div>
        </header>

        {/* Hero Content - Desktop: Two Column, Mobile: Stacked */}
        <div className="py-8 sm:py-12 lg:py-20 animate-fade-in">
          <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
            {/* Left Column - Text Content */}
            <div className="text-center lg:text-left mb-10 lg:mb-0">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-full mb-6 shadow-sm">
                <Sparkles size={14} className="text-primary" />
                <span className="text-xs sm:text-sm font-medium text-primary">
                  Simple Expense Splitting
                </span>
              </div>
              
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground mb-6 leading-[1.1] tracking-tight">
                Split expenses with friends,{' '}
                <span className="text-gradient-primary">effortlessly</span>
              </h1>
              
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Keep track of shared expenses, split bills fairly, and settle up with ease. 
                No more awkward money conversations.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 mb-8">
                <Button size="lg" onClick={() => navigate('/signup')} className="gap-2 min-h-[52px] w-full sm:w-auto text-base shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all">
                  Get Started Free
                  <ArrowRight size={18} />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="min-h-[52px] w-full sm:w-auto text-base">
                  Sign In
                </Button>
              </div>

              {/* Benefits list */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {benefits.map((benefit, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-success" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column - Visual Preview (Desktop only) */}
            <div className="hidden lg:block relative">
              <div className="relative">
                {/* Main preview card */}
                <Card className="border-border/50 shadow-2xl bg-card/95 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold">S</div>
                      <div>
                        <p className="font-semibold text-foreground">Weekend Trip</p>
                        <p className="text-xs text-muted-foreground">4 members</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-warning/10 rounded-lg"><Receipt size={16} className="text-warning" /></div>
                          <div>
                            <p className="text-sm font-medium">Dinner at Restaurant</p>
                            <p className="text-xs text-muted-foreground">You paid</p>
                          </div>
                        </div>
                        <p className="font-semibold text-foreground">₹2,400</p>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-info/10 rounded-lg"><CreditCard size={16} className="text-info" /></div>
                          <div>
                            <p className="text-sm font-medium">Hotel Booking</p>
                            <p className="text-xs text-muted-foreground">Alex paid</p>
                          </div>
                        </div>
                        <p className="font-semibold text-foreground">₹8,500</p>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Your share</span>
                        <span className="text-lg font-bold text-success">+₹1,225 owed to you</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Floating elements */}
                <div className="absolute -top-4 -right-4 p-3 bg-success/10 border border-success/20 rounded-xl shadow-lg animate-fade-in" style={{ animationDelay: '0.3s' }}>
                  <CheckCircle className="text-success" size={24} />
                </div>
                <div className="absolute -bottom-6 -left-6 p-4 bg-card border border-border/50 rounded-xl shadow-xl animate-fade-in" style={{ animationDelay: '0.5s' }}>
                  <div className="flex items-center gap-2">
                    <Smartphone size={18} className="text-primary" />
                    <span className="text-sm font-medium">UPI Ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="py-12 sm:py-16 lg:py-20">
          <div className="text-center mb-10 lg:mb-12">
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-4">Everything you need to split expenses</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Powerful features that make expense splitting simple and stress-free</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card 
                  key={index}
                  className="group relative border-border/50 shadow-sm hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                  style={{ animationDelay: `${0.1 * (index + 1)}s` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <CardContent className="relative p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                      <Icon className="text-primary" size={24} />
                    </div>
                    <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Additional features row */}
        <div className="max-w-4xl mx-auto py-8 lg:py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-success/30 transition-all">
              <div className="p-2 rounded-lg bg-success/10">
                <Shield size={18} className="text-success" />
              </div>
              <span className="text-sm font-medium text-foreground">Secure & Private</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-info/30 transition-all">
              <div className="p-2 rounded-lg bg-info/10">
                <Zap size={18} className="text-info" />
              </div>
              <span className="text-sm font-medium text-foreground">Real-time Sync</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-warning/30 transition-all">
              <div className="p-2 rounded-lg bg-warning/10">
                <Receipt size={18} className="text-warning" />
              </div>
              <span className="text-sm font-medium text-foreground">Receipt Scanning</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe size={18} className="text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Works Offline</span>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="text-center py-12 lg:py-16">
          <Card className="max-w-2xl mx-auto border-border/50 shadow-lg bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-8 sm:p-10">
              <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-3">Ready to simplify expense sharing?</h3>
              <p className="text-muted-foreground mb-6">Join thousands of users who trust Split-It for their group expenses</p>
              <Button size="lg" onClick={() => navigate('/signup')} className="gap-2 min-h-[52px] text-base shadow-xl shadow-primary/25">
                Get Started Free
                <ArrowRight size={18} />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="py-8 border-t border-border/50">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© 2026 Split-It. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <button onClick={() => navigate('/terms-of-service')} className="hover:text-primary transition-colors">
                Terms of Service
              </button>
              <button onClick={() => navigate('/privacy-policy')} className="hover:text-primary transition-colors">
                Privacy Policy
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
