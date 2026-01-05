import React, { useState } from 'react';
import { Calendar, Repeat, Clock, AlertCircle, Play, Pause, Trash2, Edit } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { categories, getCategoryById } from '../../data/categories';
import { useCurrency } from '../../context/CurrencyContext';
import { useToast } from '../../hooks/use-toast';
import apiClient from '../../lib/apiClient';

const frequencyOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const RecurringExpenseManager = ({ groupId, members, onExpenseGenerated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { formatAmount } = useCurrency();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'other',
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    reminderDaysBefore: 1,
    autoCreate: false,
  });

  // Load recurring expenses
  const loadRecurringExpenses = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/recurring-expenses/group/${groupId}`);
      setRecurringExpenses(data);
    } catch (error) {
      console.error('Error loading recurring expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create recurring expense
  const handleCreate = async () => {
    try {
      const newRecurring = await apiClient.post('/recurring-expenses', {
        groupId,
        ...formData,
        amount: parseFloat(formData.amount),
        paidBy: members[0]?._id, // Default to first member
        splitAmong: members.map(m => m._id),
      });
      
      setRecurringExpenses([...recurringExpenses, newRecurring]);
      setShowCreateDialog(false);
      setFormData({
        description: '',
        amount: '',
        category: 'other',
        frequency: 'monthly',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        reminderDaysBefore: 1,
        autoCreate: false,
      });
      
      toast({
        title: 'Recurring expense created',
        description: 'The expense will be generated according to your schedule.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create recurring expense',
        variant: 'destructive',
      });
    }
  };

  // Generate expense now
  const handleGenerateNow = async (recurringId) => {
    try {
      const expense = await apiClient.post(`/recurring-expenses/${recurringId}/generate`);
      toast({
        title: 'Expense generated',
        description: `Created expense: ${expense.description}`,
      });
      onExpenseGenerated?.(expense);
      loadRecurringExpenses();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate expense',
        variant: 'destructive',
      });
    }
  };

  // Delete recurring expense
  const handleDelete = async (recurringId) => {
    try {
      await apiClient.delete(`/recurring-expenses/${recurringId}`);
      setRecurringExpenses(recurringExpenses.filter(r => r._id !== recurringId));
      toast({
        title: 'Recurring expense deleted',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete recurring expense',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => {
          setIsOpen(true);
          loadRecurringExpenses();
        }}
        className="gap-2"
      >
        <Repeat size={16} />
        Recurring
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat size={20} />
              Recurring Expenses
            </DialogTitle>
            <DialogDescription>
              Set up automatic expense reminders and generation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button onClick={() => setShowCreateDialog(true)} className="w-full">
              Create Recurring Expense
            </Button>

            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : recurringExpenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Repeat className="mx-auto h-10 w-10 opacity-50 mb-2" />
                <p>No recurring expenses set up</p>
                <p className="text-sm">Create one to automate regular expenses</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recurringExpenses.map((recurring) => {
                  const category = getCategoryById(recurring.category);
                  const CategoryIcon = category.icon;
                  
                  return (
                    <div key={recurring._id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg bg-accent ${category.color}`}>
                            <CategoryIcon size={16} />
                          </div>
                          <div>
                            <p className="font-medium">{recurring.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatAmount(recurring.amount)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleGenerateNow(recurring._id)}
                            title="Generate now"
                          >
                            <Play size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(recurring._id)}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Repeat size={12} />
                          {frequencyOptions.find(f => f.value === recurring.frequency)?.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          Next: {new Date(recurring.nextDueDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Recurring Expense</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Monthly rent"
              />
            </div>

            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Frequency</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) => setFormData({ ...formData, frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frequencyOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div>
              <Label>End Date (optional)</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleCreate} 
                className="flex-1"
                disabled={!formData.description || !formData.amount}
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RecurringExpenseManager;
