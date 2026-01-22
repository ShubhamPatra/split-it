import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, TrendingUp, TrendingDown, CheckCircle, ChevronRight, Users, Receipt, ArrowRight, Calendar, Scale } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import Navbar from '../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';

const Summary = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { groups, expenses, settlements, getGroupBalances, getGroupSettlements } = useGroups();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  const userGroups = groups.filter(g => g.members.includes(user?.id || ''));
  let totalOwed = 0, totalOwes = 0;

  userGroups.forEach(group => {
    const balances = getGroupBalances(group.id);
    const userBalance = balances[user?.id || ''] || 0;
    if (userBalance > 0) totalOwed += userBalance;
    else totalOwes += Math.abs(userBalance);
  });

  const groupExpenseSummary = userGroups.map(group => {
    const groupExpenses = expenses.filter(exp => exp.groupId === group.id);
    const groupSettlements = getGroupSettlements(group.id);
    const total = groupExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    // Only count confirmed settlements as "settled"
    const totalSettled = groupSettlements
      .filter(set => set.paymentStatus === 'confirmed')
      .reduce((sum, set) => sum + set.amount, 0);
    const balances = getGroupBalances(group.id);
    return {
      group, totalExpenses: total, totalSettled,
      userBalance: balances[user?.id || ''] || 0,
      expenseCount: groupExpenses.length, settlementCount: groupSettlements.length
    };
  }).sort((a, b) => b.totalExpenses - a.totalExpenses);

  // Only count confirmed settlements for the total
  const totalSettlements = settlements
    .filter(set => set.paymentStatus === 'confirmed')
    .reduce((sum, set) => sum + set.amount, 0);
  const totalExpensesAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netBalance = totalOwed - totalOwes;
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-responsive py-6 sm:py-8 pb-safe md:pb-8">
        {/* Desktop Layout */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-8 xl:col-span-9">
            {/* Header */}
            <div className="mb-6 lg:mb-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">Expense Summary</h1>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Calendar size={14} />
                    <span>{currentMonth}</span>
                    <span className="text-border">•</span>
                    <span>Overview of all your shared expenses</span>
                  </p>
                </div>
                <Button onClick={() => navigate('/analytics')} variant="outline" className="hidden sm:flex gap-2">
                  <TrendingUp size={16} />
                  View Analytics
                </Button>
              </div>
            </div>

            {/* Stats Cards - Primary Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 lg:mb-8">
              <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-success/30 transition-all duration-300" style={{ animationDelay: '0.1s' }}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded bg-success/10 border border-success/20 group-hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="text-success" size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground mb-0.5">You are owed</p>
                      <p className="font-display text-2xl sm:text-3xl font-bold text-success truncate tracking-tight">₹{totalOwed.toFixed(0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-destructive/30 transition-all duration-300" style={{ animationDelay: '0.15s' }}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded bg-destructive/10 border border-destructive/20 group-hover:scale-110 transition-transform duration-300">
                      <TrendingDown className="text-destructive" size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground mb-0.5">You owe</p>
                      <p className="font-display text-2xl sm:text-3xl font-bold text-destructive truncate tracking-tight">₹{totalOwes.toFixed(0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300" style={{ animationDelay: '0.2s' }}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                      <Scale className="text-primary" size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground mb-0.5">Net Balance</p>
                      <p className={`font-display text-2xl sm:text-3xl font-bold truncate tracking-tight ${netBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {netBalance >= 0 ? '+' : ''}₹{netBalance.toFixed(0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-info/30 transition-all duration-300" style={{ animationDelay: '0.25s' }}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded bg-info/10 border border-info/20 group-hover:scale-110 transition-transform duration-300">
                      <CheckCircle className="text-info" size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground mb-0.5">Total Settled</p>
                      <p className="font-display text-2xl sm:text-3xl font-bold text-foreground truncate tracking-tight">₹{totalSettlements.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Group-wise Summary */}
            <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg md:text-xl font-semibold text-foreground flex items-center gap-2">
                  <Users size={20} className="text-primary" />
                  Group-wise Summary
                </h2>
                <Button onClick={() => navigate('/groups')} variant="ghost" size="sm" className="text-primary hover:bg-primary/10 gap-1">
                  View all
                  <ArrowRight size={16} />
                </Button>
              </div>

              <div className="space-y-3">
                {groupExpenseSummary.map((summary, index) => (
                  <Card
                    key={summary.group.id}
                    onClick={() => navigate(`/group/${summary.group.id}`)}
                    className="cursor-pointer border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in group"
                    style={{ animationDelay: `${0.05 * index}s` }}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display font-semibold text-base sm:text-lg text-foreground truncate mb-1">{summary.group.name}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {summary.expenseCount} expense{summary.expenseCount !== 1 ? 's' : ''} • {summary.settlementCount} settlement{summary.settlementCount !== 1 ? 's' : ''} • {summary.group.members.length} members
                          </p>
                        </div>
                        <div className="flex items-center gap-4 sm:gap-6">
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-muted-foreground">Total</p>
                            <p className="font-display font-bold text-base sm:text-lg text-foreground truncate">₹{summary.totalExpenses.toLocaleString()}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-muted-foreground">Your Balance</p>
                            <p className={`font-display font-bold text-base sm:text-lg truncate ${summary.userBalance > 0 ? 'text-success' : summary.userBalance < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {summary.userBalance > 0 && '+'}₹{summary.userBalance.toFixed(0)}
                            </p>
                          </div>
                          <ChevronRight size={20} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all hidden sm:block" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {groupExpenseSummary.length === 0 && (
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 rounded bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <PieChart className="text-muted-foreground" size={32} />
                    </div>
                    <h3 className="font-display font-semibold text-lg text-foreground mb-2">No data yet</h3>
                    <p className="text-muted-foreground mb-6">Start adding expenses to see your summary here</p>
                    <Button onClick={() => navigate('/groups')} className="shadow-lg shadow-primary/25">
                      <Users size={18} />
                      Go to Groups
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar - Desktop Only */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 space-y-6">
              {/* Net Balance Card */}
              <Card className={`border-2 shadow-md animate-fade-in overflow-hidden ${netBalance >= 0 ? 'border-success/30 bg-muted/30' : 'border-destructive/30 bg-muted/30'}`} style={{ animationDelay: '0.35s' }}>
                <CardContent className="p-5">
                  <div className="text-center">
                    <div className={`inline-flex p-4 rounded-2xl ${netBalance >= 0 ? 'bg-success/20 border border-success/30' : 'bg-destructive/20 border border-destructive/30'} mb-4`}>
                      <Scale size={28} className={netBalance >= 0 ? 'text-success' : 'text-destructive'} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">Your Net Balance</p>
                    <p className={`font-display text-3xl font-bold tracking-tight ${netBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {netBalance >= 0 ? '+' : ''}₹{netBalance.toFixed(0)}
                    </p>
                    <p className={`text-xs mt-2 px-3 py-1 rounded-full inline-block ${netBalance >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {netBalance >= 0 ? "You're ahead!" : 'Time to settle up'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="border-border/50 shadow-sm animate-fade-in" style={{ animationDelay: '0.4s' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Receipt size={16} className="text-primary" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Total Expenses</span>
                      <span className="font-semibold text-foreground">₹{totalExpensesAmount.toLocaleString()}</span>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Settlements</span>
                      <span className="font-semibold text-foreground">₹{totalSettlements.toLocaleString()}</span>
                    </div>
                    <Progress value={totalExpensesAmount > 0 ? (totalSettlements / totalExpensesAmount) * 100 : 0} className="h-2" />
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Active Groups</span>
                      <span className="font-semibold text-foreground">{userGroups.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="border-border/50 shadow-sm animate-fade-in" style={{ animationDelay: '0.45s' }}>
                <CardContent className="p-5">
                  <Button onClick={() => navigate('/analytics')} variant="outline" className="w-full justify-start gap-3 h-11 mb-2">
                    <TrendingUp size={16} className="text-primary" />
                    View Analytics
                  </Button>
                  <Button onClick={() => navigate('/add-expense')} className="w-full justify-start gap-3 h-11 shadow-md">
                    <Receipt size={16} />
                    Add Expense
                  </Button>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>

        {/* Mobile Quick Actions */}
        <div className="lg:hidden mt-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/analytics')} variant="outline" className="flex-1 h-12">
              <TrendingUp size={18} />
              Analytics
            </Button>
            <Button onClick={() => navigate('/add-expense')} className="flex-1 h-12 shadow-lg shadow-primary/25">
              <Receipt size={18} />
              Add Expense
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Summary;
