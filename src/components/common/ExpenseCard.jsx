import React, { useState, useMemo, useCallback } from 'react';
import { Trash2, Pencil, IndianRupee, Calendar, Shield } from 'lucide-react';
import { categories, getCategoryById } from '../../data/categories';
import { useGroups } from '../../context/GroupContext';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const ExpenseCard = React.memo(({ expense, canEdit = true, canDelete = true, isAdmin = false }) => {
  const { deleteExpense, updateExpense, getGroupById, getUserProfile } = useGroups();
  const { addNotification } = useNotifications();
  const { toast } = useToast();
  
  // Memoize expensive calculations
  const splitAmount = useMemo(() => expense.amount / expense.splitAmong.length, [expense.amount, expense.splitAmong.length]);
  const category = useMemo(() => getCategoryById(expense.category), [expense.category]);
  const CategoryIcon = category.icon;
  const group = useMemo(() => getGroupById(expense.groupId), [expense.groupId, getGroupById]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDescription, setEditDescription] = useState(expense.description);
  const [editAmount, setEditAmount] = useState(expense.amount.toString());
  const [editCategory, setEditCategory] = useState(expense.category);
  const [editPaidBy, setEditPaidBy] = useState(expense.paidBy);
  const [editDate, setEditDate] = useState(expense.date);

  const handleDelete = () => {
    deleteExpense(expense.id);
    addNotification({ type: 'balance_update', title: 'Expense Deleted', message: `"${expense.description}" was removed from ${group?.name || 'group'}`, groupId: expense.groupId });
    toast({ title: "Expense deleted", description: `"${expense.description}" has been removed.` });
  };

  const handleEdit = () => {
    if (!editDescription.trim()) { toast({ title: "Description required", variant: "destructive" }); return; }
    if (!editAmount || parseFloat(editAmount) <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    updateExpense(expense.id, { description: editDescription.trim(), amount: parseFloat(editAmount), category: editCategory, paidBy: editPaidBy, date: editDate });
    addNotification({ type: 'balance_update', title: 'Expense Updated', message: `"${editDescription}" was updated in ${group?.name || 'group'}`, groupId: expense.groupId });
    toast({ title: "Expense updated" });
    setIsEditOpen(false);
  };

  const openEditDialog = () => {
    if (!canEdit) { toast({ title: "Permission denied", variant: "destructive" }); return; }
    setEditDescription(expense.description); setEditAmount(expense.amount.toString()); setEditCategory(expense.category); setEditPaidBy(expense.paidBy); setEditDate(expense.date);
    setIsEditOpen(true);
  };

  return (
    <>
      <div className="glass-card rounded-lg sm:rounded-xl p-3 sm:p-4 animate-slide-in group w-full">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-lg bg-accent flex-shrink-0">
            <CategoryIcon className={category.color} size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm sm:text-base text-foreground truncate">{expense.description}</h4>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Paid by {getUserProfile(expense.paidBy)?.name || 'User'}</p>
                <span className={`inline-flex items-center gap-1 text-[10px] sm:text-xs mt-1 ${category.color}`}>
                  <CategoryIcon size={12} className="flex-shrink-0" />
                  {category.name}
                </span>
              </div>
              <div className="flex items-start gap-1 sm:gap-2 flex-shrink-0">
                <div className="text-right">
                  <p className="font-display font-bold text-base sm:text-lg md:text-xl text-foreground whitespace-nowrap">₹{expense.amount.toLocaleString()}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">₹{splitAmount.toFixed(0)}/person</p>
                </div>
                {canEdit && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity min-h-[44px] min-w-[44px] h-10 w-10 text-muted-foreground hover:text-primary" 
                    onClick={openEditDialog}
                  >
                    <Pencil size={18} />
                  </Button>
                )}
                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity min-h-[44px] min-w-[44px] h-10 w-10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to delete "{expense.description}"?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground min-h-[44px]">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {isAdmin && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Shield size={16} className="text-primary ml-1 flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Admin privileges</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">{new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Edit Expense</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Update the expense details below</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Description</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="min-h-[44px] text-sm sm:text-base" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => { const I = cat.icon; return (<SelectItem key={cat.id} value={cat.id}><div className="flex items-center gap-2"><I size={16} className={cat.color} />{cat.name}</div></SelectItem>); })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Amount</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="pl-10 min-h-[44px] text-sm sm:text-base" />
              </div>
            </div>
            {group && (
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Paid By</Label>
                <Select value={editPaidBy} onValueChange={setEditPaidBy}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {group.members.map(m => (<SelectItem key={m} value={m}>{getUserProfile(m)?.name || 'User'}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="pl-10 min-h-[44px] text-sm sm:text-base" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)} className="flex-1 min-h-[44px]">Cancel</Button>
              <Button onClick={handleEdit} className="flex-1 min-h-[44px]">Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

ExpenseCard.displayName = 'ExpenseCard';

export default ExpenseCard;
