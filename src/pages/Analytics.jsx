import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import { useCurrency } from '../context/CurrencyContext';
import { getCategoryById } from '../data/categories';
import Navbar from '../components/layout/Navbar';
import CurrencySelector from '../components/common/CurrencySelector';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

const CHART_COLORS = [
  'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(200, 84%, 45%)',
  'hsl(280, 60%, 50%)', 'hsl(120, 60%, 40%)', 'hsl(30, 80%, 55%)', 'hsl(320, 70%, 50%)',
];

const Analytics = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { groups, expenses, getGroupBalances } = useGroups();
  const { formatAmount } = useCurrency();

  // Calculate data before any early returns
  const userGroups = groups.filter(g => g.members.includes(user?.id || ''));
  const userExpenses = expenses.filter(exp => userGroups.some(g => g.id === exp.groupId));

  const categoryData = useMemo(() => {
    const categoryTotals = {};
    userExpenses.forEach(exp => {
      const category = exp.category || 'other';
      categoryTotals[category] = (categoryTotals[category] || 0) + exp.amount;
    });
    return Object.entries(categoryTotals).map(([category, amount]) => ({
      name: getCategoryById(category).name, value: amount, category,
    })).sort((a, b) => b.value - a.value);
  }, [userExpenses]);

  const monthlyData = useMemo(() => {
    const monthlyTotals = {};
    userExpenses.forEach(exp => {
      const date = new Date(exp.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + exp.amount;
    });
    return Object.entries(monthlyTotals).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, amount]) => {
      const [year, monthNum] = month.split('-');
      const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleString('default', { month: 'short' });
      return { month: monthName, amount };
    });
  }, [userExpenses]);

  const groupData = useMemo(() => {
    return userGroups.map(group => {
      const groupExpenses = userExpenses.filter(exp => exp.groupId === group.id);
      const total = groupExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      return { name: group.name.length > 12 ? group.name.slice(0, 12) + '...' : group.name, fullName: group.name, amount: total };
    }).sort((a, b) => b.amount - a.amount);
  }, [userGroups, userExpenses]);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  const totalExpenses = userExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const avgExpense = userExpenses.length > 0 ? totalExpenses / userExpenses.length : 0;
  
  let totalOwed = 0, totalOwes = 0;
  userGroups.forEach(group => {
    const balances = getGroupBalances(group.id);
    const userBalance = balances[user?.id || ''] || 0;
    if (userBalance > 0) totalOwed += userBalance;
    else totalOwes += Math.abs(userBalance);
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 sm:mb-8 animate-fade-in">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">Analytics & Insights</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Track your spending patterns and trends</p>
          </div>
          <CurrencySelector />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-xl bg-primary/10 flex-shrink-0"><BarChart3 className="text-primary" size={20} /></div>
                <div className="min-w-0"><p className="text-xs sm:text-sm text-muted-foreground">Total Expenses</p><p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">{formatAmount(totalExpenses)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-xl bg-success/10 flex-shrink-0"><ArrowUpRight className="text-success" size={20} /></div>
                <div className="min-w-0"><p className="text-xs sm:text-sm text-muted-foreground">You're Owed</p><p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-success truncate">{formatAmount(totalOwed)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-xl bg-destructive/10 flex-shrink-0"><ArrowDownRight className="text-destructive" size={20} /></div>
                <div className="min-w-0"><p className="text-xs sm:text-sm text-muted-foreground">You Owe</p><p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-destructive truncate">{formatAmount(totalOwes)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-xl bg-warning/10 flex-shrink-0"><TrendingUp className="text-warning" size={20} /></div>
                <div className="min-w-0"><p className="text-xs sm:text-sm text-muted-foreground">Avg. Expense</p><p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">{formatAmount(avgExpense)}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><PieChartIcon size={18} />Spending by Category</CardTitle></CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {categoryData.map((_, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (<div className="h-[300px] flex items-center justify-center text-muted-foreground">No expense data available</div>)}
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Calendar size={18} />Monthly Spending Trend</CardTitle></CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                      <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (<div className="h-[300px] flex items-center justify-center text-muted-foreground">No monthly data available</div>)}
            </CardContent>
          </Card>

          <Card className="animate-fade-in lg:col-span-2" style={{ animationDelay: '0.7s' }}>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 size={20} />Spending by Group</CardTitle></CardHeader>
            <CardContent>
              {groupData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (<div className="h-[300px] flex items-center justify-center text-muted-foreground">No group data available</div>)}
            </CardContent>
          </Card>
        </div>

        {categoryData.length > 0 && (
          <Card className="animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <CardHeader><CardTitle>Category Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryData.map((cat, index) => {
                  const categoryInfo = getCategoryById(cat.category);
                  const IconComponent = categoryInfo.icon;
                  const percentage = totalExpenses > 0 ? (cat.value / totalExpenses) * 100 : 0;
                  return (
                    <div key={cat.category} className="flex items-center gap-4">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${CHART_COLORS[index % CHART_COLORS.length]}20` }}>
                        <IconComponent size={18} style={{ color: CHART_COLORS[index % CHART_COLORS.length] }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1"><span className="font-medium">{cat.name}</span><span className="text-muted-foreground">{formatAmount(cat.value)}</span></div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">{percentage.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Analytics;
