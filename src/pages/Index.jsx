import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Receipt, PieChart, ArrowRight, Sparkles, Shield, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
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

  const stats = [
    { value: '10K+', label: 'Active Users' },
    { value: '₹50L+', label: 'Expenses Tracked' },
    { value: '99.9%', label: 'Uptime' },
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

        {/* Hero Content */}
        <div className="max-w-3xl mx-auto text-center py-8 sm:py-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-full mb-6 shadow-sm">
            <Sparkles size={14} className="text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary">
              Simple Expense Splitting
            </span>
          </div>
          
          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold text-foreground mb-6 leading-[1.1] tracking-tight px-2">
            Split expenses with friends,{' '}
            <span className="text-gradient-primary">effortlessly</span>
          </h1>
          
          <p className="text-base sm:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-xl mx-auto px-4 leading-relaxed">
            Keep track of shared expenses, split bills fairly, and settle up with ease. 
            No more awkward money conversations.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
            <Button size="lg" onClick={() => navigate('/signup')} className="gap-2 min-h-[52px] w-full sm:w-auto text-base shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all">
              Get Started Free
              <ArrowRight size={18} />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="min-h-[52px] w-full sm:w-auto text-base">
              Sign In
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-6 sm:gap-8 mt-10 sm:mt-12 text-muted-foreground">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="font-display text-xl sm:text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto py-8 sm:py-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="group relative bg-card rounded-2xl p-6 text-center border border-border/50 shadow-sm hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
              >
                {/* Gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                    <Icon className="text-primary" size={24} />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional features row */}
        <div className="max-w-3xl mx-auto py-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card/50 border border-border/30">
              <div className="p-2 rounded-lg bg-success/10">
                <Shield size={18} className="text-success" />
              </div>
              <span className="text-sm font-medium text-foreground">Secure & Private</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card/50 border border-border/30">
              <div className="p-2 rounded-lg bg-info/10">
                <Zap size={18} className="text-info" />
              </div>
              <span className="text-sm font-medium text-foreground">Real-time Sync</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card/50 border border-border/30 col-span-2 sm:col-span-1">
              <div className="p-2 rounded-lg bg-warning/10">
                <Receipt size={18} className="text-warning" />
              </div>
              <span className="text-sm font-medium text-foreground">Receipt Scanning</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
