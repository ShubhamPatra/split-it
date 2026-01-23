import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Wallet, Users, TrendingUp, ArrowRight, Receipt, PieChart, ArrowUpRight, ArrowDownRight, Scale, HandCoins, Calendar, Clock, Sparkles, ChevronRight, Zap, Target, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import Navbar from '../components/layout/Navbar';
import GroupCard from '../components/common/GroupCard';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { groups, expenses, settlements, loadGroupExpenses, loading } = useGroups();

  // useEffect to redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Load expenses for all user groups when Dashboard mounts
  useEffect(() => {
    if (!user || loading || groups.length === 0) return;

    // Load expenses for all groups the user is a member of
    const userGroupIds = groups
      .filter(g => g.members.includes(user.id))
      .map(g => g.id);

    // Load expenses for each group (they will be cached after first load)
    userGroupIds.forEach(groupId => {
      loadGroupExpenses(groupId);
    });
  }, [user, loading, groups, loadGroupExpenses]);

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

  // Calculate last month's expenses for comparison
  const lastMonthExpenses = useMemo(() => {
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return expenses
      .filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= startOfLastMonth && expDate <= endOfLastMonth;
      })
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  // Get recent activities (last 5 expenses)
  const recentActivities = useMemo(() => {
    return [...expenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [expenses]);

  // Calculate spending trend percentage
  const spendingTrend = useMemo(() => {
    if (lastMonthExpenses === 0) return thisMonthExpenses > 0 ? 100 : 0;
    return ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
  }, [thisMonthExpenses, lastMonthExpenses]);

  // Calculate balance summary (You are owed, You owe, Net Balance, Total Settled)
  const balanceSummary = useMemo(() => {
    const userId = user?.id;
    if (!userId) return { youAreOwed: 0, youOwe: 0, netBalance: 0, totalSettled: 0 };

    let netBalance = 0;

    // Calculate from expenses (same logic as backend)
    expenses.forEach(expense => {
      const shares = expense.splitConfig?.shares || {};
      const splitType = expense.splitConfig?.type || 'equal';
      const amount = expense.amount;

      if (expense.paidBy === userId) {
        // User paid - add the full amount they paid
        netBalance += amount;
      }

      // Subtract what user owes (their share)
      if (splitType === 'equal') {
        const splitAmong = expense.splitAmong || [];
        if (splitAmong.includes(userId)) {
          const shareAmount = amount / splitAmong.length;
          netBalance -= shareAmount;
        }
      } else if (splitType === 'exact' || splitType === 'itemized') {
        if (shares[userId]) {
          netBalance -= shares[userId];
        }
      } else if (splitType === 'percentage') {
        if (shares[userId]) {
          netBalance -= (shares[userId] / 100) * amount;
        }
      }
    });

    // Adjust for confirmed settlements (same logic as backend)
    settlements
      .filter(settlement => settlement.paymentStatus === 'confirmed')
      .forEach(settlement => {
        if (settlement.fromUserId === userId) {
          // User paid someone - increases their balance
          netBalance += settlement.amount;
        } else if (settlement.toUserId === userId) {
          // Someone paid user - decreases their balance
          netBalance -= settlement.amount;
        }
      });

    // Round to 2 decimal places
    netBalance = Math.round(netBalance * 100) / 100;

    // Calculate youAreOwed and youOwe from net balance
    const youAreOwed = netBalance > 0 ? netBalance : 0;
    const youOwe = netBalance < 0 ? Math.abs(netBalance) : 0;

    // Calculate total settled by user (only confirmed settlements)
    const totalSettled = settlements
      .filter(s => s.paymentStatus === 'confirmed' && (s.fromUserId === userId || s.toUserId === userId))
      .reduce((sum, s) => sum + s.amount, 0);

    return {
      youAreOwed,
      youOwe,
      netBalance,
      totalSettled,
    };
  }, [expenses, settlements, user?.id]);

  if (!isAuthenticated) return null;

  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Mobile Floating Action Button */}
      <div className="sm:hidden fixed bottom-20 right-4 z-40 animate-fade-in" style={{ animationDelay: '0.7s' }}>
        <Button
          onClick={() => navigate('/add-expense')}
          size="lg"
          className="h-14 w-14 rounded-full shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all active:scale-95"
        >
          <Plus size={24} />
        </Button>
      </div>

      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        {/* Desktop Layout: Two Column */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-8 xl:col-span-9">
            {/* Welcome Section with Enhanced Header */}
            <div className="mb-6 lg:mb-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
                    Hello, {user?.name?.split(' ')[0]}!
                  </h1>
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Calendar size={14} />
                    <span>{currentMonth}</span>
                    <span className="hidden sm:inline text-border">•</span>
                    <span className="hidden sm:inline">Here's your expense overview</span>
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/add-expense')}
                  className="hidden sm:flex gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                >
                  <Plus size={18} />
                  Add Expense
                </Button>
              </div>
            </div>

            {/* Primary Stats Row - Large Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
              {/* Total Expenses Card */}
              <Card className="group border-border/50 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 animate-fade-in overflow-hidden" style={{ animationDelay: '0.1s' }}>
                <CardContent className="p-5 lg:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                      <Wallet className="text-primary" size={24} />
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      <Sparkles size={12} />
                      Primary
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Total Expenses</p>
                  <p className="font-display text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-3">
                    ₹{totalExpenses.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${spendingTrend >= 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                      {spendingTrend >= 0 ? <TrendingUp size={12} /> : <ArrowDownRight size={12} />}
                      {Math.abs(spendingTrend).toFixed(0)}%
                    </div>
                    <span>vs last month</span>
                  </div>
                </CardContent>
              </Card>

              {/* This Month Card */}
              <Card className="group border-border/50 shadow-sm hover:shadow-xl hover:border-success/30 transition-all duration-300 animate-fade-in overflow-hidden" style={{ animationDelay: '0.15s' }}>
                <CardContent className="p-5 lg:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded bg-success/10 border border-success/20 group-hover:scale-110 transition-transform duration-300">
                      <Target className="text-success" size={24} />
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock size={12} />
                      This month
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Monthly Spending</p>
                  <p className="font-display text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-3">
                    ₹{thisMonthExpenses.toLocaleString()}
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-foreground">{totalExpenses > 0 ? ((thisMonthExpenses / totalExpenses) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <Progress value={totalExpenses > 0 ? (thisMonthExpenses / totalExpenses) * 100 : 0} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Groups & Transactions Card */}
              <Card className="group border-border/50 shadow-sm hover:shadow-xl hover:border-warning/30 transition-all duration-300 animate-fade-in sm:col-span-2 xl:col-span-1 overflow-hidden" style={{ animationDelay: '0.2s' }}>
                <CardContent className="p-5 lg:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded bg-warning/10 border border-warning/20 group-hover:scale-110 transition-transform duration-300">
                      <Zap className="text-warning" size={24} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Groups</p>
                      <p className="font-display text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
                        {userGroups.length}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {userGroups.reduce((sum, g) => sum + g.members.length, 0)} members
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Transactions</p>
                      <p className="font-display text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
                        {expenses.length}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        All time
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Balance Summary Row */}
            <div className="mb-6 lg:mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                  <Scale size={18} className="text-primary" />
                  Balance Summary
                </h2>
              </div>
              {/* Desktop: 4 columns, Mobile: Horizontal scroll */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <Card className="group border-border/50 shadow-sm hover:shadow-lg hover:border-success/30 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.25s' }}>
                  <CardContent className="p-4 lg:p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded bg-success/10 border border-success/20 group-hover:scale-110 transition-transform duration-300">
                        <ArrowDownRight className="text-success" size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">You are owed</p>
                        <p className="font-display text-lg lg:text-xl font-bold text-success truncate tracking-tight">
                          ₹{balanceSummary.youAreOwed.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="group border-border/50 shadow-sm hover:shadow-lg hover:border-destructive/30 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                  <CardContent className="p-4 lg:p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 group-hover:scale-110 transition-transform duration-300">
                        <ArrowUpRight className="text-destructive" size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">You owe</p>
                        <p className="font-display text-lg lg:text-xl font-bold text-destructive truncate tracking-tight">
                          ₹{balanceSummary.youOwe.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="group border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.35s' }}>
                  <CardContent className="p-4 lg:p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                        <Scale className="text-primary" size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Net Balance</p>
                        <p className={`font-display text-lg lg:text-xl font-bold truncate tracking-tight ${balanceSummary.netBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {balanceSummary.netBalance >= 0 ? '+' : ''}₹{balanceSummary.netBalance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="group border-border/50 shadow-sm hover:shadow-lg hover:border-info/30 transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                  <CardContent className="p-4 lg:p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded bg-info/10 border border-info/20 group-hover:scale-110 transition-transform duration-300">
                        <HandCoins className="text-info" size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Total Settled</p>
                        <p className="font-display text-lg lg:text-xl font-bold text-info truncate tracking-tight">
                          ₹{balanceSummary.totalSettled.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Mobile: Horizontal scrolling cards */}
              <div className="sm:hidden -mx-4 px-4">
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                  <Card className="flex-shrink-0 w-[140px] snap-start border-border/50 shadow-sm bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-success/20">
                          <ArrowDownRight className="text-success" size={14} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">You're owed</p>
                      </div>
                      <p className="font-display text-lg font-bold text-success tracking-tight">
                        ₹{balanceSummary.youAreOwed.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="flex-shrink-0 w-[140px] snap-start border-border/50 shadow-sm bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-destructive/20">
                          <ArrowUpRight className="text-destructive" size={14} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">You owe</p>
                      </div>
                      <p className="font-display text-lg font-bold text-destructive tracking-tight">
                        ₹{balanceSummary.youOwe.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className={`flex-shrink-0 w-[140px] snap-start border-border/50 shadow-sm bg-muted/30`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg ${balanceSummary.netBalance >= 0 ? 'bg-success/20' : 'bg-destructive/20'}`}>
                          <Scale className={balanceSummary.netBalance >= 0 ? 'text-success' : 'text-destructive'} size={14} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">Net Balance</p>
                      </div>
                      <p className={`font-display text-lg font-bold tracking-tight ${balanceSummary.netBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {balanceSummary.netBalance >= 0 ? '+' : ''}₹{balanceSummary.netBalance.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="flex-shrink-0 w-[140px] snap-start border-border/50 shadow-sm bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-info/20">
                          <HandCoins className="text-info" size={14} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">Settled</p>
                      </div>
                      <p className="font-display text-lg font-bold text-info tracking-tight">
                        ₹{balanceSummary.totalSettled.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Groups Section */}
            <div className="animate-fade-in" style={{ animationDelay: '0.45s' }}>
              <div className="flex items-center justify-between mb-4 lg:mb-6">
                <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
                  <Users size={20} className="text-primary" />
                  Your Groups
                </h2>
                <Button onClick={() => navigate('/groups')} variant="ghost" size="sm" className="min-h-[44px] h-auto text-primary hover:text-primary-dark hover:bg-primary/10 gap-1">
                  View all
                  <ArrowRight size={16} />
                </Button>
              </div>

              {userGroups.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
                  {userGroups.slice(0, 6).map((group, index) => (
                    <div key={group.id} className="animate-fade-in" style={{ animationDelay: `${0.05 * (index + 1)}s` }}>
                      <GroupCard group={group} />
                    </div>
                  ))}
                </div>
              ) : (
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 rounded bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
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
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar - Desktop Only */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 space-y-6">
              {/* Quick Actions Card */}
              <Card className="border-border/50 shadow-sm animate-fade-in" style={{ animationDelay: '0.5s' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Sparkles size={16} className="text-primary" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/add-expense')}
                    className="w-full justify-start gap-3 h-12 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all"
                  >
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Plus size={16} className="text-primary" />
                    </div>
                    Add Expense
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/groups')}
                    className="w-full justify-start gap-3 h-12 hover:bg-success/10 hover:border-success/40 hover:text-success transition-all"
                  >
                    <div className="p-1.5 rounded-lg bg-success/10">
                      <Users size={16} className="text-success" />
                    </div>
                    Create Group
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/analytics')}
                    className="w-full justify-start gap-3 h-12 hover:bg-info/10 hover:border-info/40 hover:text-info transition-all"
                  >
                    <div className="p-1.5 rounded-lg bg-info/10">
                      <BarChart3 size={16} className="text-info" />
                    </div>
                    View Analytics
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/summary')}
                    className="w-full justify-start gap-3 h-12 hover:bg-warning/10 hover:border-warning/40 hover:text-warning transition-all"
                  >
                    <div className="p-1.5 rounded-lg bg-warning/10">
                      <PieChart size={16} className="text-warning" />
                    </div>
                    Expense Summary
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Activity Card */}
              <Card className="border-border/50 shadow-sm animate-fade-in" style={{ animationDelay: '0.55s' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Zap size={16} className="text-primary" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentActivities.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivities.map((expense, index) => {
                        const group = groups.find(g => g.id === expense.groupId);
                        return (
                          <div
                            key={expense.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group/item"
                            onClick={() => navigate(`/group/${expense.groupId}`)}
                          >
                            <div className="p-2 rounded-lg bg-primary/10 group-hover/item:bg-primary/20 transition-colors">
                              <Receipt size={14} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {expense.description || 'Expense'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {group?.name || 'Unknown group'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-foreground">
                                ₹{expense.amount.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity" />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                        <Receipt size={20} className="text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No recent activity</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Monthly Overview Mini Card */}
              <Card className="border-border/50 shadow-sm animate-fade-in bg-muted/30" style={{ animationDelay: '0.6s' }}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-foreground">Monthly Overview</span>
                    <span className="text-xs text-muted-foreground">{currentMonth}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">This month</span>
                      <span className="text-sm font-semibold text-foreground">₹{thisMonthExpenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Last month</span>
                      <span className="text-sm font-medium text-muted-foreground">₹{lastMonthExpenses.toLocaleString()}</span>
                    </div>
                    <div className="h-px bg-border/50 my-2" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Difference</span>
                      <span className={`text-sm font-semibold ${thisMonthExpenses - lastMonthExpenses >= 0 ? 'text-destructive' : 'text-success'}`}>
                        {thisMonthExpenses - lastMonthExpenses >= 0 ? '+' : ''}₹{(thisMonthExpenses - lastMonthExpenses).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>

        {/* Mobile Sections - Only shown on mobile/tablet */}
        <div className="lg:hidden space-y-6 mt-6">
          {/* Mobile Quick Actions */}
          <div className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-4 gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/add-expense')}
                className="h-auto py-3 flex-col gap-1.5 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <Plus size={18} className="text-primary" />
                </div>
                <span className="text-[10px] font-medium">Expense</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/groups')}
                className="h-auto py-3 flex-col gap-1.5 hover:bg-success/10 hover:border-success/40 hover:text-success transition-all"
              >
                <div className="p-2 rounded-lg bg-success/10">
                  <Users size={18} className="text-success" />
                </div>
                <span className="text-[10px] font-medium">Group</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/analytics')}
                className="h-auto py-3 flex-col gap-1.5 hover:bg-info/10 hover:border-info/40 hover:text-info transition-all"
              >
                <div className="p-2 rounded-lg bg-info/10">
                  <BarChart3 size={18} className="text-info" />
                </div>
                <span className="text-[10px] font-medium">Analytics</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/summary')}
                className="h-auto py-3 flex-col gap-1.5 hover:bg-warning/10 hover:border-warning/40 hover:text-warning transition-all"
              >
                <div className="p-2 rounded-lg bg-warning/10">
                  <PieChart size={18} className="text-warning" />
                </div>
                <span className="text-[10px] font-medium">Summary</span>
              </Button>
            </div>
          </div>

          {/* Mobile Monthly Overview */}
          <Card className="border-border/50 shadow-sm animate-fade-in bg-muted/30" style={{ animationDelay: '0.55s' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calendar size={14} className="text-primary" />
                  Monthly Overview
                </span>
                <span className="text-xs text-muted-foreground">{currentMonth}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-card/50">
                  <p className="text-xs text-muted-foreground mb-1">This month</p>
                  <p className="text-sm font-bold text-foreground">₹{thisMonthExpenses.toLocaleString()}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-card/50">
                  <p className="text-xs text-muted-foreground mb-1">Last month</p>
                  <p className="text-sm font-medium text-muted-foreground">₹{lastMonthExpenses.toLocaleString()}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-card/50">
                  <p className="text-xs text-muted-foreground mb-1">Change</p>
                  <p className={`text-sm font-bold ${thisMonthExpenses - lastMonthExpenses >= 0 ? 'text-destructive' : 'text-success'}`}>
                    {thisMonthExpenses - lastMonthExpenses >= 0 ? '+' : ''}₹{Math.abs(thisMonthExpenses - lastMonthExpenses).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Recent Activity */}
          <Card className="border-border/50 shadow-sm animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap size={14} className="text-primary" />
                  Recent Activity
                </CardTitle>
                {recentActivities.length > 0 && (
                  <span className="text-xs text-muted-foreground">{recentActivities.length} items</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {recentActivities.length > 0 ? (
                <div className="space-y-2">
                  {recentActivities.slice(0, 4).map((expense) => {
                    const group = groups.find(g => g.id === expense.groupId);
                    return (
                      <div
                        key={expense.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 active:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/group/${expense.groupId}`)}
                      >
                        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                          <Receipt size={14} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {expense.description || 'Expense'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {group?.name || 'Unknown group'} • {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-foreground">
                            ₹{expense.amount.toLocaleString()}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Receipt size={20} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                  <p className="text-xs text-muted-foreground mt-1">Add an expense to get started</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mobile Net Balance Highlight */}
          <Card className={`border-2 shadow-md animate-fade-in overflow-hidden ${balanceSummary.netBalance >= 0 ? 'border-success/30 bg-muted/30' : 'border-destructive/30 bg-muted/30'}`} style={{ animationDelay: '0.65s' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${balanceSummary.netBalance >= 0 ? 'bg-success/20 border border-success/30' : 'bg-destructive/20 border border-destructive/30'}`}>
                    <Scale size={20} className={balanceSummary.netBalance >= 0 ? 'text-success' : 'text-destructive'} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Your Net Balance</p>
                    <p className={`font-display text-2xl font-bold tracking-tight ${balanceSummary.netBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {balanceSummary.netBalance >= 0 ? '+' : ''}₹{balanceSummary.netBalance.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-medium px-2 py-1 rounded-full ${balanceSummary.netBalance >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {balanceSummary.netBalance >= 0 ? 'You\'re ahead!' : 'Settle up'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
