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
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-16">
          <Logo />
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Sign In
            </Button>
            <Button onClick={() => navigate('/signup')}>
              Get Started
            </Button>
          </div>
        </header>

        {/* Hero Content */}
        <div className="max-w-3xl mx-auto text-center py-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full mb-6">
            <Wallet size={16} className="text-accent-foreground" />
            <span className="text-sm font-medium text-accent-foreground">
              Simple Expense Splitting
            </span>
          </div>
          
          <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Split expenses with friends,{' '}
            <span className="text-primary">effortlessly</span>
          </h1>
          
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Keep track of shared expenses, split bills fairly, and settle up with ease. 
            No more awkward money conversations.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/signup')} className="gap-2">
              Get Started Free
              <ArrowRight size={18} />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto py-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="glass-card rounded-2xl p-6 text-center animate-fade-in"
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="text-primary" size={28} />
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Demo Hint */}
        <div className="max-w-md mx-auto text-center py-8">
          <p className="text-sm text-muted-foreground">
            <strong>Demo credentials:</strong> rahul@example.com / password123
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Built with React • Academic Project
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
