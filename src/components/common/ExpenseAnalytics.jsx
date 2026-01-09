import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { TrendingUp, Calendar, Users, PieChart, Receipt, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { getCategoryById } from '../../data/categories';
import { subscribeToAnalytics, subscribeToExpenseEvents } from '../../lib/socketClient';

const ExpenseAnalytics = ({ expenses, group, onExpenseChange }) => {
  // Track real-time updates indicator
  const [lastUpdate, setLastUpdate] = useState(null);

  // Subscribe to real-time analytics and expense events
  useEffect(() => {
    if (!group?.id) return;

    // Subscribe to analytics events
    const unsubscribeAnalytics = subscribeToAnalytics(group.id, (data) => {
      setLastUpdate({ type: data.type, timestamp: Date.now() });
      // Trigger parent refresh if callback provided
      if (onExpenseChange) {
        onExpenseChange(data);
      }
    });

    // Subscribe to expense events for real-time chart updates
    const unsubscribeExpenses = subscribeToExpenseEvents(group.id, (event) => {
      setLastUpdate({ type: event.type, timestamp: Date.now() });
      // Trigger parent refresh if callback provided
      if (onExpenseChange) {
        onExpenseChange(event);
      }
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeAnalytics();
      unsubscribeExpenses();
    };
  }, [group?.id, onExpenseChange]);

  const analytics = useMemo(() => {
    if (expenses.length === 0) return null;

    // Total expense
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Average expense
    const average = total / expenses.length;

    // Category breakdown
    const categoryTotals = {};
    expenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });

    const topCategory = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])[0];

    // Per person spending
    const perPersonSpending = {};
    expenses.forEach(exp => {
      perPersonSpending[exp.paidBy] = (perPersonSpending[exp.paidBy] || 0) + exp.amount;
    });

    const topSpender = Object.entries(perPersonSpending)
      .sort((a, b) => b[1] - a[1])[0];

    // Time-based analytics
    const now = new Date();
    const thisMonth = expenses.filter(exp => {
      const expDate = new Date(exp.date);
      return expDate.getMonth() === now.getMonth() && 
             expDate.getFullYear() === now.getFullYear();
    });
    const thisMonthTotal = thisMonth.reduce((sum, exp) => sum + exp.amount, 0);

    const lastMonth = expenses.filter(exp => {
      const expDate = new Date(exp.date);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
      return expDate.getMonth() === lastMonthDate.getMonth() && 
             expDate.getFullYear() === lastMonthDate.getFullYear();
    });
    const lastMonthTotal = lastMonth.reduce((sum, exp) => sum + exp.amount, 0);

    const monthlyTrend = lastMonthTotal > 0 
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 
      : 0;

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentExpenses = expenses.filter(exp => 
      new Date(exp.date) >= sevenDaysAgo
    );

    return {
      total,
      average,
      topCategory: topCategory ? {
        id: topCategory[0],
        amount: topCategory[1],
        category: getCategoryById(topCategory[0])
      } : null,
      topSpender: topSpender ? {
        userId: topSpender[0],
        amount: topSpender[1]
      } : null,
      perPersonAverage: total / (group?.members?.length || 1),
      thisMonthTotal,
      lastMonthTotal,
      monthlyTrend,
      recentExpenses: recentExpenses.length,
      categoryBreakdown: Object.entries(categoryTotals).map(([id, amount]) => ({
        category: getCategoryById(id),
        amount,
        percentage: (amount / total) * 100
      })).sort((a, b) => b.amount - a.amount),
    };
  }, [expenses, group]);

  if (!analytics || expenses.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Receipt size={48} className="mx-auto mb-4 opacity-50" />
          <p>No expenses yet. Add your first expense to see analytics!</p>
        </CardContent>
      </Card>
    );
  }

  const CategoryIcon = analytics.topCategory?.category?.icon;

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign size={14} />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-2xl font-bold text-foreground">
              ₹{analytics.total.toLocaleString()}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              Across {expenses.length} transaction{expenses.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt size={14} />
              Average Expense
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-2xl font-bold text-foreground">
              ₹{analytics.average.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              Per transaction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users size={14} />
              Per Person
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-2xl font-bold text-foreground">
              ₹{analytics.perPersonAverage.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              Average per member
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar size={14} />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-2xl font-bold text-foreground">
              ₹{analytics.thisMonthTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            {analytics.monthlyTrend !== 0 && (
              <p className={`text-[10px] sm:text-xs mt-1 flex items-center gap-1 ${
                analytics.monthlyTrend > 0 ? 'text-destructive' : 'text-success'
              }`}>
                <TrendingUp size={12} className={analytics.monthlyTrend < 0 ? 'rotate-180' : ''} />
                {Math.abs(analytics.monthlyTrend).toFixed(0)}% vs last month
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart size={20} />
            Category Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.categoryBreakdown.slice(0, 5).map(({ category, amount, percentage }) => {
              const Icon = category.icon;
              return (
                <div key={category.id} className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent">
                    <Icon className={category.color} size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {category.name}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        ₹{amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>

          {analytics.topCategory && CategoryIcon && (
            <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2">
                <CategoryIcon className="text-primary" size={20} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Top Spending Category
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {analytics.topCategory.category.name}: ₹{analytics.topCategory.amount.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpenseAnalytics;
