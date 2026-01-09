import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, TrendingUp, TrendingDown, Wallet, CheckCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import Navbar from '../components/layout/Navbar';
import { Card, CardContent } from '../components/ui/card';

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
    const totalSettled = groupSettlements.reduce((sum, set) => sum + set.amount, 0);
    const balances = getGroupBalances(group.id);
    return {
      group, totalExpenses: total, totalSettled,
      userBalance: balances[user?.id || ''] || 0,
      expenseCount: groupExpenses.length, settlementCount: groupSettlements.length
    };
  });

  const totalSettlements = settlements.reduce((sum, set) => sum + set.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">Expense Summary</h1>
          <p className="text-muted-foreground">Overview of all your shared expenses</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-success/30 transition-all duration-300" style={{ animationDelay: '0.1s' }}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20 group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="text-success" size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5">You are owed</p>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-success truncate tracking-tight">₹{totalOwed.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-destructive/30 transition-all duration-300" style={{ animationDelay: '0.2s' }}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/5 border border-destructive/20 group-hover:scale-110 transition-transform duration-300">
                  <TrendingDown className="text-destructive" size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5">You owe</p>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-destructive truncate tracking-tight">₹{totalOwes.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300" style={{ animationDelay: '0.3s' }}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                  <Wallet className="text-primary" size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5">Net Balance</p>
                  <p className={`font-display text-2xl sm:text-3xl font-bold truncate tracking-tight ${totalOwed - totalOwes >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {totalOwed - totalOwes >= 0 ? '+' : '-'}₹{Math.abs(totalOwed - totalOwes).toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-success/30 transition-all duration-300" style={{ animationDelay: '0.4s' }}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20 group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle className="text-success" size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5">Total Settled</p>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-foreground truncate tracking-tight">₹{totalSettlements.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <h2 className="font-display text-lg md:text-xl font-semibold text-foreground mb-4">Group-wise Summary</h2>
        
        <div className="space-y-3">
          {groupExpenseSummary.map((summary, index) => (
            <Card 
              key={summary.group.id}
              onClick={() => navigate(`/group/${summary.group.id}`)}
              className="cursor-pointer border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in group"
              style={{ animationDelay: `${0.1 * index}s` }}
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
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mx-auto mb-4">
                <PieChart className="text-muted-foreground" size={32} />
              </div>
              <h3 className="font-display font-semibold text-lg text-foreground mb-2">No data yet</h3>
              <p className="text-muted-foreground">Start adding expenses to see your summary here</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Summary;
