import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, TrendingUp, TrendingDown, Wallet, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import Navbar from '../components/layout/Navbar';

const Summary = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { groups, expenses, settlements, getGroupBalances, getGroupSettlements } = useGroups();

  // useEffect to redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  // Filter groups for current user
  const userGroups = groups.filter(g => g.members.includes(user?.id || ''));

  // Calculate overall balance for current user
  let totalOwed = 0; // Money others owe to user
  let totalOwes = 0; // Money user owes to others

  userGroups.forEach(group => {
    const balances = getGroupBalances(group.id);
    const userBalance = balances[user?.id || ''] || 0;
    
    if (userBalance > 0) {
      totalOwed += userBalance;
    } else {
      totalOwes += Math.abs(userBalance);
    }
  });

  // Calculate expenses and settlements by group
  const groupExpenseSummary = userGroups.map(group => {
    const groupExpenses = expenses.filter(exp => exp.groupId === group.id);
    const groupSettlements = getGroupSettlements(group.id);
    const total = groupExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalSettled = groupSettlements.reduce((sum, set) => sum + set.amount, 0);
    const balances = getGroupBalances(group.id);
    
    return {
      group,
      totalExpenses: total,
      totalSettled,
      userBalance: balances[user?.id || ''] || 0,
      expenseCount: groupExpenses.length,
      settlementCount: groupSettlements.length
    };
  });

  // Total settlements
  const totalSettlements = settlements.reduce((sum, set) => sum + set.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Expense Summary
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Overview of all your shared expenses
          </p>
        </div>

        {/* Overall Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="glass-card rounded-xl p-4 sm:p-5 md:p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-xl bg-success/10 flex-shrink-0">
                <TrendingUp className="text-success" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">You are owed</p>
                <p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-success truncate">
                  ₹{totalOwed.toFixed(0)}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4 sm:p-5 md:p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-xl bg-destructive/10 flex-shrink-0">
                <TrendingDown className="text-destructive" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">You owe</p>
                <p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-destructive truncate">
                  ₹{totalOwes.toFixed(0)}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4 sm:p-5 md:p-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-xl bg-primary/10 flex-shrink-0">
                <Wallet className="text-primary" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Net Balance</p>
                <p className={`font-display text-lg sm:text-xl md:text-2xl font-bold truncate ${
                  totalOwed - totalOwes >= 0 ? 'text-success' : 'text-destructive'
                }`}>
                  {totalOwed - totalOwes >= 0 ? '+' : '-'}₹{Math.abs(totalOwed - totalOwes).toFixed(0)}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4 sm:p-5 md:p-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-xl bg-success/10 flex-shrink-0">
                <CheckCircle className="text-success" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Settled</p>
                <p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">
                  ₹{totalSettlements.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Group-wise Summary */}
        <h2 className="font-display text-base sm:text-lg md:text-xl font-semibold text-foreground mb-4">
          Group-wise Summary
        </h2>
        
        <div className="space-y-3 sm:space-y-4">
          {groupExpenseSummary.map((summary, index) => (
            <div 
              key={summary.group.id}
              onClick={() => navigate(`/group/${summary.group.id}`)}
              className="glass-card rounded-xl p-4 sm:p-5 cursor-pointer hover:shadow-md transition-all animate-fade-in min-h-[44px]"
              style={{ animationDelay: `${0.1 * index}s` }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-base sm:text-lg text-foreground truncate">
                    {summary.group.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {summary.expenseCount} expense{summary.expenseCount !== 1 ? 's' : ''} • {summary.settlementCount} settlement{summary.settlementCount !== 1 ? 's' : ''} • {summary.group.members.length} members
                  </p>
                </div>
                
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="text-left sm:text-right">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
                    <p className="font-display font-bold text-sm sm:text-base text-foreground truncate">
                      ₹{summary.totalExpenses.toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="text-left sm:text-right">
                    <p className="text-xs sm:text-sm text-muted-foreground">Your Balance</p>
                    <p className={`font-display font-bold text-sm sm:text-base truncate ${
                      summary.userBalance > 0 
                        ? 'text-success' 
                        : summary.userBalance < 0 
                        ? 'text-destructive' 
                        : 'text-muted-foreground'
                    }`}>
                      {summary.userBalance > 0 && '+'}
                      ₹{summary.userBalance.toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {groupExpenseSummary.length === 0 && (
          <div className="glass-card rounded-xl p-6 sm:p-8 md:p-12 text-center">
            <PieChart className="mx-auto text-muted-foreground mb-4" size={40} />
            <h3 className="font-display font-semibold text-base sm:text-lg text-foreground mb-2">
              No data yet
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Start adding expenses to see your summary here
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Summary;
