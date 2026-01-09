import React, { useState, useEffect } from 'react';
import { Edit, IndianRupee, Calendar, Users, Tag, Settings2, Upload, X, ImageIcon, Loader2, ExternalLink } from 'lucide-react';
import { useGroups } from '../../context/GroupContext';
import { categories } from '../../data/categories';
import apiClient from '../../lib/apiClient';
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

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
  
  // Receipt state
  const [existingReceipts, setExistingReceipts] = useState([]);
  const [newReceipts, setNewReceipts] = useState([]);
  const [uploadingReceipts, setUploadingReceipts] = useState(false);
  const [deletingReceiptId, setDeletingReceiptId] = useState(null);

  // Initialize form with expense data
  useEffect(() => {
    if (expense && open) {
      setDescription(expense.description);
      setAmount(expense.amount.toString());
      setCategory(expense.category);
      setDate(expense.date);
      setSplitConfig(expense.splitConfig || { type: 'equal', shares: {} });
      setExistingReceipts(expense.receipts || []);
      setNewReceipts([]);
    }
  }, [expense, open]);

  if (!expense || !group) return null;

  /**
   * Handle new receipt file selection
   */
  const handleReceiptUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Limit to 5 receipts total
    const totalCount = existingReceipts.length + newReceipts.length + files.length;
    if (totalCount > 5) {
      toast({
        title: "Too many receipts",
        description: "Maximum 5 receipts allowed per expense",
        variant: "destructive"
      });
      return;
    }
    
    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: `${file.name} must be an image`,
          variant: "destructive"
        });
        continue;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} must be less than 5MB`,
          variant: "destructive"
        });
        continue;
      }
      
      // Create local preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewReceipts(prev => [...prev, {
          file,
          preview: event.target.result,
          filename: file.name,
        }]);
      };
      reader.readAsDataURL(file);
    }
    
    e.target.value = '';
  };

  /**
   * Remove a new (not yet uploaded) receipt
   */
  const removeNewReceipt = (index) => {
    setNewReceipts(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Delete an existing receipt from server
   */
  const deleteExistingReceipt = async (receiptId) => {
    setDeletingReceiptId(receiptId);
    try {
      await apiClient.delete(`/expenses/${expense.id}/receipts/${receiptId}`);
      setExistingReceipts(prev => prev.filter(r => r._id !== receiptId));
      toast({
        title: "Receipt deleted",
        description: "Receipt has been removed",
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete receipt",
        variant: "destructive"
      });
    } finally {
      setDeletingReceiptId(null);
    }
  };

  /**
   * Upload new receipts to server
   */
  const uploadNewReceipts = async () => {
    if (newReceipts.length === 0) return true;
    
    const formData = new FormData();
    for (const receipt of newReceipts) {
      formData.append('receipts', receipt.file);
    }
    
    const response = await fetch(`${API_URL}/expenses/${expense.id}/receipts`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to upload receipts');
    }
    
    const result = await response.json();
    setExistingReceipts(prev => [...prev, ...result.receipts]);
    setNewReceipts([]);
    return true;
  };

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

    try {
      // Upload new receipts first if any
      if (newReceipts.length > 0) {
        setUploadingReceipts(true);
        await uploadNewReceipts();
        setUploadingReceipts(false);
      }

      // Update expense details
      const success = await updateExpense(expense.id, {
        description: description.trim(),
        amount: parseFloat(amount),
        category,
        date,
        splitConfig,
      });

      if (success) {
        toast({
          title: "Expense updated!",
          description: "The expense has been updated successfully.",
        });
        onOpenChange(false);
      } else {
        throw new Error('Failed to update expense');
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update expense. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setUploadingReceipts(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setDescription(expense.description);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDate(expense.date);
    setSplitConfig(expense.splitConfig || { type: 'equal', shares: {} });
    setExistingReceipts(expense.receipts || []);
    setNewReceipts([]);
    onOpenChange(false);
  };

  const totalReceiptCount = existingReceipts.length + newReceipts.length;

  // Build full URL for receipt images
  const getReceiptUrl = (receipt) => {
    if (receipt.url.startsWith('http')) {
      return receipt.url;
    }
    // For relative URLs, prepend the API base URL (without /api)
    const baseUrl = API_URL.replace('/api', '');
    return `${baseUrl}${receipt.url}`;
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

            {/* Receipts Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm sm:text-base">Receipts</Label>
                <span className="text-xs text-muted-foreground">{totalReceiptCount}/5</span>
              </div>
              
              {/* Existing receipts from server */}
              {existingReceipts.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {existingReceipts.map((receipt) => (
                    <div key={receipt._id} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                      <a 
                        href={getReceiptUrl(receipt)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block w-full h-full"
                      >
                        <img
                          src={getReceiptUrl(receipt)}
                          alt={receipt.filename}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ExternalLink size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </a>
                      <button
                        type="button"
                        onClick={() => deleteExistingReceipt(receipt._id)}
                        disabled={deletingReceiptId === receipt._id}
                        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      >
                        {deletingReceiptId === receipt._id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <X size={12} />
                        )}
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                        <p className="text-[10px] text-white truncate">{receipt.filename}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* New receipts (not yet uploaded) */}
              {newReceipts.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {newReceipts.map((receipt, index) => (
                    <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border-2 border-dashed border-primary/50 bg-primary/5">
                      <img
                        src={receipt.preview}
                        alt={receipt.filename}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-0 left-0 right-0 bg-primary/80 px-1 py-0.5">
                        <p className="text-[10px] text-white text-center">New</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNewReceipt(index)}
                        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                        <p className="text-[10px] text-white truncate">{receipt.filename}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Upload button */}
              {totalReceiptCount < 5 && (
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleReceiptUpload}
                    className="hidden"
                  />
                  <Upload size={16} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {totalReceiptCount === 0 ? 'Add receipts' : 'Add more'}
                  </span>
                </label>
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
              {isLoading ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />
                  {uploadingReceipts ? 'Uploading receipts...' : 'Saving...'}
                </>
              ) : 'Save Changes'}
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
