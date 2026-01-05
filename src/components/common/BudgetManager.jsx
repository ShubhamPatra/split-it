import React, { useState, useEffect } from 'react';
import { Target, AlertTriangle, TrendingUp, Settings, Edit2, Check, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Progress } from '../ui/progress';
import { Switch } from '../ui/switch';
import { useCurrency } from '../../context/CurrencyContext';
import { useToast } from '../../hooks/use-toast';
import apiClient from '../../lib/apiClient';

const BudgetManager = ({ group, expenses = [], onBudgetUpdated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { formatAmount } = useCurrency();
  const { toast } = useToast();

  const [budgetSettings, setBudgetSettings] = useState({
    enabled: group?.budget?.enabled || false,
    limit: group?.budget?.limit || 0,
    period: group?.budget?.period || 'monthly',
    alertThreshold: group?.budget?.alertThreshold || 80,
  });

  useEffect(() => {
    if (group?.budget) {
      setBudgetSettings({
        enabled: group.budget.enabled || false,
        limit: group.budget.limit || 0,
        period: group.budget.period || 'monthly',
        alertThreshold: group.budget.alertThreshold || 80,
      });
    }
  }, [group]);

  // Calculate spent amount based on period
  const calculateSpent = () => {
    if (!expenses || expenses.length === 0) return 0;

    const now = new Date();
    let startDate;

    switch (budgetSettings.period) {
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return expenses
      .filter(exp => new Date(exp.date) >= startDate)
      .reduce((sum, exp) => sum + (exp.amount || 0), 0);
  };

  const spent = calculateSpent();
  const remaining = Math.max(0, budgetSettings.limit - spent);
  const percentage = budgetSettings.limit > 0 ? Math.min(100, (spent / budgetSettings.limit) * 100) : 0;
  const isOverBudget = spent > budgetSettings.limit && budgetSettings.limit > 0;
  const isNearLimit = percentage >= budgetSettings.alertThreshold && !isOverBudget;

  // Save budget settings
  const handleSave = async () => {
    try {
      setLoading(true);
      await apiClient.put(`/groups/${group._id}`, {
        budget: budgetSettings,
      });
      
      toast({
        title: 'Budget updated',
        description: budgetSettings.enabled 
          ? `Budget limit set to ${formatAmount(budgetSettings.limit)}`
          : 'Budget tracking disabled',
      });
      
      onBudgetUpdated?.({ ...group, budget: budgetSettings });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update budget',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Get progress bar color
  const getProgressColor = () => {
    if (isOverBudget) return 'bg-destructive';
    if (isNearLimit) return 'bg-yellow-500';
    return 'bg-primary';
  };

  // Period label
  const periodLabel = {
    weekly: 'This Week',
    monthly: 'This Month',
    yearly: 'This Year',
    custom: 'Custom Period',
  };

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Target size={16} />
        Budget
        {budgetSettings.enabled && isNearLimit && (
          <AlertTriangle size={14} className="text-yellow-500" />
        )}
        {budgetSettings.enabled && isOverBudget && (
          <AlertTriangle size={14} className="text-destructive" />
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target size={20} />
              Budget Settings
            </DialogTitle>
            <DialogDescription>
              Set spending limits and get alerts when approaching the limit
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Budget Overview */}
            {budgetSettings.enabled && budgetSettings.limit > 0 && (
              <div className="space-y-3 p-4 bg-accent/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{periodLabel[budgetSettings.period]}</span>
                  {isOverBudget && (
                    <span className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle size={12} />
                      Over budget!
                    </span>
                  )}
                  {isNearLimit && (
                    <span className="text-xs text-yellow-600 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      Near limit
                    </span>
                  )}
                </div>
                
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div 
                    className={`h-full transition-all duration-500 ${getProgressColor()}`}
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>
                    Spent: <span className={isOverBudget ? 'text-destructive font-medium' : ''}>
                      {formatAmount(spent)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Limit: {formatAmount(budgetSettings.limit)}
                  </span>
                </div>
                
                <div className="text-center">
                  <span className={`text-lg font-semibold ${isOverBudget ? 'text-destructive' : 'text-primary'}`}>
                    {formatAmount(remaining)}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">remaining</span>
                </div>
              </div>
            )}

            {/* Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Budget Tracking</Label>
                  <p className="text-xs text-muted-foreground">
                    Get alerts when spending approaches the limit
                  </p>
                </div>
                <Switch
                  checked={budgetSettings.enabled}
                  onCheckedChange={(checked) => setBudgetSettings({ ...budgetSettings, enabled: checked })}
                />
              </div>

              {budgetSettings.enabled && (
                <>
                  <div>
                    <Label>Budget Limit</Label>
                    <Input
                      type="number"
                      value={budgetSettings.limit}
                      onChange={(e) => setBudgetSettings({ ...budgetSettings, limit: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label>Budget Period</Label>
                    <Select
                      value={budgetSettings.period}
                      onValueChange={(value) => setBudgetSettings({ ...budgetSettings, period: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Alert Threshold ({budgetSettings.alertThreshold}%)</Label>
                    <Input
                      type="range"
                      min="50"
                      max="100"
                      value={budgetSettings.alertThreshold}
                      onChange={(e) => setBudgetSettings({ ...budgetSettings, alertThreshold: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Get alerted when spending reaches {budgetSettings.alertThreshold}% of the budget
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BudgetManager;
