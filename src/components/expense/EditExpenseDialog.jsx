import React, { useState, useEffect } from 'react';
import { Edit, IndianRupee, Calendar, Users, Tag, Settings2 } from 'lucide-react';
import { useGroups } from '../../context/GroupContext';
import { categories } from '../../data/categories';
import AdvancedSplitDialog from './AdvancedSplitDialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useToast } from '../../hooks/use-toast';

/**
 * EditExpenseDialog Component
 * 
 * Dialog for editing an existing expense with full split configuration support
 * 
 * @param {boolean} open - Whether dialog is open
 * @param {function} onOpenChange - Callback when dialog open state changes
 * @param {object} expense - The expense object to edit
 * @param {object} group - The group this expense belongs to
 */
const EditExpenseDialog = ({ open, onOpenChange, expense, group }) => {
  const { updateExpense, getUserProfile } = useGroups();
  const { toast } = useToast();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [date, setDate] = useState('');
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitConfig, setSplitConfig] = useState({ type: 'equal', shares: {} });
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form with expense data
  useEffect(() => {
    if (expense && open) {
      setDescription(expense.description);
      setAmount(expense.amount.toString());
      setCategory(expense.category);
      setDate(expense.date);
      setSplitConfig(expense.splitConfig || { type: 'equal', shares: {} });
    }
  }, [expense, open]);

  if (!expense || !group) return null;

  const handleSave = async () => {
    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please enter a description for the expense.",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const success = await updateExpense(expense.id, {
      description: description.trim(),
      amount: parseFloat(amount),
      category,
      date,
      splitConfig,
    });

    setIsLoading(false);

    if (success) {
      toast({
        title: "Expense updated!",
        description: "The expense has been updated successfully.",
      });
      onOpenChange(false);
    } else {
      toast({
        title: "Update failed",
        description: "Failed to update expense. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setDescription(expense.description);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDate(expense.date);
    setSplitConfig(expense.splitConfig || { type: 'equal', shares: {} });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Edit size={18} />
              Edit Expense
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Update the expense details and split configuration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-3 sm:py-4 overflow-y-auto flex-1">
            {/* Category */}
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => {
                    const IconComponent = cat.icon;
                    return (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <IconComponent size={16} className={cat.color} />
                          <span>{cat.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description" className="text-sm sm:text-base">Description</Label>
              <Input
                id="edit-description"
                placeholder="e.g., Dinner, Groceries, Tickets"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[44px] text-sm sm:text-base"
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="edit-amount" className="text-sm sm:text-base">Amount</Label>
              <div className="relative">
                <IndianRupee
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={18}
                />
                <Input
                  id="edit-amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-10 min-h-[44px] text-sm sm:text-base"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="edit-date" className="text-sm sm:text-base">Date</Label>
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={18}
                />
                <Input
                  id="edit-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="pl-10 min-h-[44px] text-sm sm:text-base"
                />
              </div>
            </div>

            {/* Split Configuration */}
            <div className="p-3 sm:p-4 bg-accent/50 rounded-lg">
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Users size={16} className="text-accent-foreground flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-accent-foreground truncate">
                    {splitConfig.type === 'equal'
                      ? 'Split equally'
                      : splitConfig.type === 'percentage'
                      ? 'Percentage split'
                      : 'Custom amounts'}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSplitDialog(true)}
                  className="min-h-[44px] text-xs sm:text-sm flex-shrink-0"
                >
                  <Settings2 size={14} className="mr-1" />
                  Customize
                </Button>
              </div>
              {amount && parseFloat(amount) > 0 && (
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {splitConfig.type === 'equal'
                    ? `Each person pays ₹${(
                        parseFloat(amount) / Object.keys(splitConfig.shares).length
                      ).toFixed(2)}`
                    : `${Object.keys(splitConfig.shares).length} members involved`}
                </div>
              )}
            </div>

            {/* Paid by info (read-only) */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Paid by: <span className="font-medium text-foreground">
                  {getUserProfile(expense.paidBy)?.name || 'Unknown'}
                </span>
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                Note: The payer cannot be changed when editing
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isLoading} className="min-h-[44px] text-sm sm:text-base">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading} className="min-h-[44px] text-sm sm:text-base">
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advanced Split Dialog */}
      <AdvancedSplitDialog
        open={showSplitDialog}
        onOpenChange={setShowSplitDialog}
        members={group.members}
        totalAmount={parseFloat(amount) || 0}
        currentSplit={splitConfig}
        onSave={(newSplit) => {
          setSplitConfig(newSplit);
          setShowSplitDialog(false);
        }}
      />
    </>
  );
};

export default EditExpenseDialog;
