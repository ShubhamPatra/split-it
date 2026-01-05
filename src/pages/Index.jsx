import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Users, Receipt, PieChart, ArrowRight } from 'lucide-react';
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
      description: 'Organize expenses with friends, family, or roommates'
    },
    {
      icon: Receipt,
      title: 'Track Expenses',
      description: 'Add and manage shared expenses easily'
    },
    {
      icon: PieChart,
      title: 'Split Equally',
      description: 'Automatically calculate who owes what'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 sm:mb-16">
          <Logo size="sm" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" onClick={() => navigate('/login')} size="sm" className="min-h-[44px] h-auto text-sm">
              Sign In
            </Button>
            <Button onClick={() => navigate('/signup')} size="sm" className="min-h-[44px] h-auto text-sm">
              Get Started
            </Button>
          </div>
        </header>

        {/* Hero Content */}
        <div className="max-w-3xl mx-auto text-center py-8 sm:py-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-accent rounded-full mb-4 sm:mb-6">
            <Wallet size={14} className="text-accent-foreground" />
            <span className="text-xs sm:text-sm font-medium text-accent-foreground">
              Simple Expense Splitting
            </span>
          </div>
          
          <h1 className="font-display text-3xl sm:text-4xl md:text-6xl font-bold text-foreground mb-4 sm:mb-6 leading-tight px-2">
            Split expenses with friends,{' '}
            <span className="text-primary">effortlessly</span>
          </h1>
          
          <p className="text-sm sm:text-lg text-muted-foreground mb-6 sm:mb-10 max-w-xl mx-auto px-4">
            Keep track of shared expenses, split bills fairly, and settle up with ease. 
            No more awkward money conversations.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
            <Button size="lg" onClick={() => navigate('/signup')} className="gap-2 min-h-[48px] w-full sm:w-auto">
              Get Started Free
              <ArrowRight size={18} />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="min-h-[48px] w-full sm:w-auto">
              Sign In
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto py-8 sm:py-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center animate-fade-in"
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Icon className="text-primary" size={24} />
                </div>
                <h3 className="font-display font-semibold text-base sm:text-lg text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Demo Hint */}
        <div className="max-w-md mx-auto text-center py-6 sm:py-8 px-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            <strong>Demo credentials:</strong> rahul@example.com / password123
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 sm:py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Built with React • Academic Project
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
