import React from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Users, CheckCircle } from 'lucide-react';

const Home = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
            Welcome to <span className="text-primary">Split-It</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Split expenses effortlessly with friends, roommates, and groups.
            Track who owes what and settle up with ease.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="px-8 py-3 bg-primary text-primary-foreground rounded font-semibold hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="px-8 py-3 bg-card text-primary rounded font-semibold border-2 border-primary hover:bg-primary/5 transition-colors"
            >
              Login
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-card p-5 rounded border border-border">
            <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center mb-4">
              <Receipt className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-base font-semibold mb-2 text-foreground">Track Expenses</h3>
            <p className="text-sm text-muted-foreground">
              Keep track of all your shared expenses in one place. Never forget who paid for what.
            </p>
          </div>

          <div className="bg-card p-5 rounded border border-border">
            <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center mb-4">
              <Users className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-base font-semibold mb-2 text-foreground">Create Groups</h3>
            <p className="text-sm text-muted-foreground">
              Organize expenses by trips, roommates, or any group. Keep everything organized.
            </p>
          </div>

          <div className="bg-card p-5 rounded border border-border">
            <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center mb-4">
              <CheckCircle className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-base font-semibold mb-2 text-foreground">Settle Up</h3>
            <p className="text-sm text-muted-foreground">
              See exactly who owes what and settle debts with minimal transactions.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© 2026 Split-It. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link to="/terms-of-service" className="hover:text-primary transition-colors">
                Terms of Service
              </Link>
              <Link to="/privacy-policy" className="hover:text-primary transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
          <div className="text-center mt-4 text-sm text-muted-foreground">
            Need help? Contact us at{' '}
            <a href="mailto:notifications.splitit@gmail.com" className="text-primary hover:underline">
              notifications.splitit@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
