import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Wallet, Users, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import { useSocket } from '../context/SocketContext';
import Navbar from '../components/layout/Navbar';
import GroupCard from '../components/common/GroupCard';
import { Button } from '../components/ui/button';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { groups, expenses, refreshData } = useGroups();
  const { subscribe } = useSocket();
  // Subscribe to global events for dashboard aggregates
  useEffect(() => {
    const unsubscribes = [
      subscribe('expense_added', refreshData),
      subscribe('expense_updated', refreshData),
      subscribe('expense_deleted', refreshData),
      subscribe('settlement_created', refreshData),
      subscribe('member_joined', refreshData),
    ];
    return () => {
      unsubscribes.forEach(unsub => unsub && unsub());
    };
  }, [subscribe, refreshData]);

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="glass-card rounded-xl p-4 sm:p-5 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-xl bg-primary/10 flex-shrink-0">
                <Wallet className="text-primary" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Expenses</p>
                <p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">
                  ₹{totalExpenses.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4 sm:p-5 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-xl bg-success/10 flex-shrink-0">
                <Users className="text-success" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Active Groups</p>
                <p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-foreground">
                  {userGroups.length}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4 sm:p-5 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-xl bg-warning/10 flex-shrink-0">
                <TrendingUp className="text-warning" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Transactions</p>
                <p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-foreground">
                  {expenses.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Groups Section */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="font-display text-base sm:text-lg md:text-xl font-semibold text-foreground">
            Your Groups
          </h2>
          <Button onClick={() => navigate('/groups')} variant="outline" size="sm" className="min-h-[44px] h-auto">
            <Plus size={16} className="sm:mr-1" />
            <span className="hidden sm:inline">New Group</span>
          </Button>
        </div>

        {userGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userGroups.map((group, index) => (
              <div key={group.id} style={{ animationDelay: `${0.1 * index}s` }}>
                <GroupCard group={group} />
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl p-6 sm:p-8 md:p-12 text-center">
            <Users className="mx-auto text-muted-foreground mb-4" size={40} />
            <h3 className="font-display font-semibold text-base sm:text-lg text-foreground mb-2">
              No groups yet
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              Create your first group to start splitting expenses
            </p>
            <Button onClick={() => navigate('/groups')} className="min-h-[44px] h-auto">
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
