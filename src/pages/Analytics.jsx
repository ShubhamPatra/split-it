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
  'hsl(158, 64%, 52%)', 'hsl(38, 92%, 58%)', 'hsl(0, 72%, 51%)', 'hsl(210, 100%, 56%)',
  'hsl(280, 60%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(30, 80%, 55%)', 'hsl(320, 70%, 50%)',
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">Analytics & Insights</h1>
            <p className="text-muted-foreground">Track your spending patterns and trends</p>
          </div>
          <CurrencySelector />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300" style={{ animationDelay: '0.1s' }}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 group-hover:scale-110 transition-transform duration-300"><BarChart3 className="text-primary" size={22} /></div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5">Total Expenses</p>
                  <p className="font-display text-2xl font-bold text-foreground truncate tracking-tight">{formatAmount(totalExpenses)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-success/30 transition-all duration-300" style={{ animationDelay: '0.2s' }}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20 group-hover:scale-110 transition-transform duration-300"><ArrowUpRight className="text-success" size={22} /></div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5">You're Owed</p>
                  <p className="font-display text-2xl font-bold text-success truncate tracking-tight">{formatAmount(totalOwed)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-destructive/30 transition-all duration-300" style={{ animationDelay: '0.3s' }}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/5 border border-destructive/20 group-hover:scale-110 transition-transform duration-300"><ArrowDownRight className="text-destructive" size={22} /></div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5">You Owe</p>
                  <p className="font-display text-2xl font-bold text-destructive truncate tracking-tight">{formatAmount(totalOwes)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-warning/30 transition-all duration-300" style={{ animationDelay: '0.4s' }}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 border border-warning/20 group-hover:scale-110 transition-transform duration-300"><TrendingUp className="text-warning" size={22} /></div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5">Avg. Expense</p>
                  <p className="font-display text-2xl font-bold text-foreground truncate tracking-tight">{formatAmount(avgExpense)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="animate-fade-in border-border/50 shadow-sm" style={{ animationDelay: '0.5s' }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-primary/10"><PieChartIcon size={16} className="text-primary" /></div>
                Spending by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {categoryData.map((_, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                  <PieChartIcon size={40} className="mb-3 opacity-30" />
                  <p>No expense data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="animate-fade-in border-border/50 shadow-sm" style={{ animationDelay: '0.6s' }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-info/10"><Calendar size={16} className="text-info" /></div>
                Monthly Spending Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                      <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                  <Calendar size={40} className="mb-3 opacity-30" />
                  <p>No monthly data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="animate-fade-in lg:col-span-2 border-border/50 shadow-sm" style={{ animationDelay: '0.7s' }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-warning/10"><BarChart3 size={16} className="text-warning" /></div>
                Spending by Group
              </CardTitle>
            </CardHeader>
            <CardContent>
              {groupData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                  <BarChart3 size={40} className="mb-3 opacity-30" />
                  <p>No group data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {categoryData.length > 0 && (
          <Card className="animate-fade-in border-border/50 shadow-sm" style={{ animationDelay: '0.8s' }}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryData.map((cat, index) => {
                  const categoryInfo = getCategoryById(cat.category);
                  const IconComponent = categoryInfo.icon;
                  const percentage = totalExpenses > 0 ? (cat.value / totalExpenses) * 100 : 0;
                  return (
                    <div key={cat.category} className="flex items-center gap-4 p-3 rounded-xl bg-card-elevated/50 border border-border/30 hover:border-border/50 transition-colors">
                      <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${CHART_COLORS[index % CHART_COLORS.length]}15`, border: `1px solid ${CHART_COLORS[index % CHART_COLORS.length]}30` }}>
                        <IconComponent size={18} style={{ color: CHART_COLORS[index % CHART_COLORS.length] }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1.5">
                          <span className="font-medium text-foreground">{cat.name}</span>
                          <span className="text-muted-foreground font-medium">{formatAmount(cat.value)}</span>
                        </div>
                        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground w-12 text-right">{percentage.toFixed(0)}%</span>
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
