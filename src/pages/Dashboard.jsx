import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Wallet, Users, TrendingUp, ArrowRight, Receipt, PieChart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import Navbar from '../components/layout/Navbar';
import GroupCard from '../components/common/GroupCard';
import { Button } from '../components/ui/button';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { groups, expenses } = useGroups();

  // useEffect to redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Memoize expensive calculations to prevent recalculation on every render
  const userGroups = useMemo(
    () => groups.filter(g => g.members.includes(user?.id || '')),
    [groups, user?.id]
  );
  
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, exp) => sum + exp.amount, 0),
    [expenses]
  );

  // Calculate this month's expenses
  const thisMonthExpenses = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return expenses
      .filter(exp => new Date(exp.date) >= startOfMonth)
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Hello, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your shared expenses
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="group bg-card rounded-xl p-5 border border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                <Wallet className="text-primary" size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground mb-0.5">Total Expenses</p>
                <p className="font-display text-2xl sm:text-3xl font-bold text-foreground truncate tracking-tight">
                  ₹{totalExpenses.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp size={12} className="text-success" />
                <span className="text-success font-medium">₹{thisMonthExpenses.toLocaleString()}</span> this month
              </p>
            </div>
          </div>

          <div className="group bg-card rounded-xl p-5 border border-border/50 shadow-sm hover:shadow-lg hover:border-success/30 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20 group-hover:scale-110 transition-transform duration-300">
                <Users className="text-success" size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground mb-0.5">Active Groups</p>
                <p className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {userGroups.length}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                {userGroups.reduce((sum, g) => sum + g.members.length, 0)} total members
              </p>
            </div>
          </div>

          <div className="group bg-card rounded-xl p-5 border border-border/50 shadow-sm hover:shadow-lg hover:border-warning/30 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 border border-warning/20 group-hover:scale-110 transition-transform duration-300">
                <Receipt className="text-warning" size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground mb-0.5">Total Transactions</p>
                <p className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {expenses.length}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                Across all your groups
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <h2 className="font-display text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate('/add-expense')}
              className="h-auto py-4 flex-col gap-2 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all"
            >
              <Plus size={20} />
              <span className="text-xs">Add Expense</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/groups')}
              className="h-auto py-4 flex-col gap-2 hover:bg-success/10 hover:border-success/40 hover:text-success transition-all"
            >
              <Users size={20} />
              <span className="text-xs">New Group</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/analytics')}
              className="h-auto py-4 flex-col gap-2 hover:bg-info/10 hover:border-info/40 hover:text-info transition-all"
            >
              <TrendingUp size={20} />
              <span className="text-xs">Analytics</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/summary')}
              className="h-auto py-4 flex-col gap-2 hover:bg-warning/10 hover:border-warning/40 hover:text-warning transition-all"
            >
              <PieChart size={20} />
              <span className="text-xs">Summary</span>
            </Button>
          </div>
        </div>

        {/* Groups Section */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">
            Your Groups
          </h2>
          <Button onClick={() => navigate('/groups')} variant="ghost" size="sm" className="min-h-[44px] h-auto text-primary hover:text-primary-dark hover:bg-primary/10 gap-1">
            View all
            <ArrowRight size={16} />
          </Button>
        </div>

        {userGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userGroups.slice(0, 6).map((group, index) => (
              <div key={group.id} className="animate-fade-in" style={{ animationDelay: `${0.1 * (index + 6)}s` }}>
                <GroupCard group={group} />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-8 sm:p-12 text-center border border-border/50 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Users className="text-primary" size={28} />
            </div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-2">
              No groups yet
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Create your first group to start splitting expenses with friends and family
            </p>
            <Button onClick={() => navigate('/groups')} className="min-h-[48px] h-auto shadow-lg shadow-primary/25">
              <Plus size={18} />
              Create Group
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
