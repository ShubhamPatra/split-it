import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Receipt, IndianRupee, Calendar, Users, Settings2, Scan, AlertCircle, TrendingUp, CheckCircle2, Repeat, ChevronDown, Upload, X, ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import { useNotifications } from '../context/NotificationContext';
import { categories } from '../data/categories';
import { sanitizeInput } from '../lib/utils';
import Navbar from '../components/layout/Navbar';
import AdvancedSplitDialog from '../components/expense/AdvancedSplitDialog';
import BillScanner from '../components/expense/BillScanner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';
import { Switch } from '../components/ui/switch';
import { useToast } from '../hooks/use-toast';

const AddExpense = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { groups, addExpense, getUserProfile } = useGroups();
  const { addNotification } = useNotifications();
  const { toast } = useToast();

  const [selectedGroup, setSelectedGroup] = useState(searchParams.get('groupId') || '');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(user?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('other');
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitConfig, setSplitConfig] = useState({ type: 'equal', shares: {} });
  const [showBillScanner, setShowBillScanner] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Recurring expense state (Comment 3)
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('monthly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [showRecurringOptions, setShowRecurringOptions] = useState(false);
  
  // Multiple receipts state (Comment 6)
  const [receipts, setReceipts] = useState([]);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (user?.id) {
      setPaidBy(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (selectedGroup) {
      const group = groups.find(g => g.id === selectedGroup);
      if (group) {
        const equalShare = parseFloat(amount) / group.members.length || 0;
        const shares = {};
        group.members.forEach(m => { shares[m] = equalShare; });
        setSplitConfig({ type: 'equal', shares });
      }
    }
  }, [selectedGroup, amount, groups]);

  const userGroups = groups.filter(g => g.members.includes(user?.id || ''));
  const currentGroup = groups.find(g => g.id === selectedGroup);

  // Memoize split amount calculation
  const splitAmountPerPerson = useMemo(() => {
    if (!amount || !currentGroup) return 0;
    const total = parseFloat(amount);
    if (isNaN(total) || total <= 0) return 0;
    
    if (splitConfig.type === 'equal') {
      return total / currentGroup.members.length;
    }
    return 0;
  }, [amount, currentGroup, splitConfig.type]);

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!selectedGroup) {
      newErrors.group = 'Please select a group';
    }
    
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      newErrors.description = 'Description is required';
    } else if (trimmedDesc.length < 3) {
      newErrors.description = 'Description must be at least 3 characters';
    } else if (trimmedDesc.length > 200) {
      newErrors.description = 'Description is too long (max 200 characters)';
    }
    
    const numAmount = parseFloat(amount);
    if (!amount) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(numAmount) || numAmount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    } else if (numAmount > 10000000) {
      newErrors.amount = 'Amount is too large';
    }
    
    if (!paidBy) {
      newErrors.paidBy = 'Please select who paid';
    }
    
    const expenseDate = new Date(date);
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    if (!date) {
      newErrors.date = 'Date is required';
    } else if (expenseDate > today) {
      newErrors.date = 'Date cannot be in the future';
    } else if (expenseDate < oneYearAgo) {
      newErrors.date = 'Date cannot be more than 1 year ago';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset errors
    setErrors({});
    
    // Validate form
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast({ 
        title: "Validation Error", 
        description: Object.values(validationErrors)[0],
        variant: "destructive" 
      });
      return;
    }
    
    setIsSubmitting(true);

    try {
      const sanitizedDescription = sanitizeInput(description.trim());
      
      // Build expense data with optional recurrence (Comment 3)
      const expenseData = {
        groupId: selectedGroup,
        description: sanitizedDescription,
        amount: parseFloat(amount),
        currency: 'INR',
        paidBy,
        date,
        splitAmong: Object.keys(splitConfig.shares).filter(m => splitConfig.shares[m] > 0),
        category,
        splitConfig,
      };
      
      // Add recurrence if enabled
      if (isRecurring) {
        expenseData.recurrence = {
          enabled: true,
          frequency: recurrenceFrequency,
          interval: recurrenceInterval,
          endDate: recurrenceEndDate || undefined,
        };
      }

      // Create the expense first
      const expenseId = await addExpense(expenseData);

      if (expenseId) {
        // Upload receipts if any were selected
        if (receipts.length > 0) {
          try {
            await uploadReceiptsToExpense(expenseId, receipts);
          } catch (uploadError) {
            console.error('Receipt upload failed:', uploadError);
            toast({
              title: "Expense created",
              description: "Expense was saved but some receipts failed to upload.",
              variant: "warning"
            });
          }
        }

        addNotification({
          type: 'expense_added',
          title: 'Expense Added',
          message: `₹${parseFloat(amount).toLocaleString()} for ${sanitizedDescription}${isRecurring ? ' (Recurring)' : ''}`,
          groupId: selectedGroup,
        });

        toast({ 
          title: "Expense added!", 
          description: `₹${parseFloat(amount).toLocaleString()} expense has been added.${isRecurring ? ' It will recur ' + recurrenceFrequency + '.' : ''}` 
        });
        
        navigate(`/group/${selectedGroup}`);
      } else {
        throw new Error('Failed to create expense');
      }
    } catch (error) {
      toast({
        title: "Failed to add expense",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Upload receipt files to an expense via API
   */
  const uploadReceiptsToExpense = async (expenseId, receiptFiles) => {
    const formData = new FormData();
    
    for (const receipt of receiptFiles) {
      formData.append('receipts', receipt.file);
    }
    
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const response = await fetch(`${API_URL}/expenses/${expenseId}/receipts`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to upload receipts');
    }
    
    return response.json();
  };

  /**
   * Handle bill scan completion
   */
  const handleScanComplete = (scannedData) => {
    if (scannedData.amount) {
      setAmount(scannedData.amount.toString());
    }
    if (scannedData.date) {
      setDate(scannedData.date);
    }
    if (scannedData.description) {
      setDescription(scannedData.description);
    }
    
    toast({
      title: "Data extracted!",
      description: "Bill details have been filled. You can edit them if needed.",
    });
  };

  /**
   * Handle receipt file upload (Comment 6)
   */
  const handleReceiptUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Limit to 5 receipts total
    if (receipts.length + files.length > 5) {
      toast({
        title: "Too many receipts",
        description: "Maximum 5 receipts allowed per expense",
        variant: "destructive"
      });
      return;
    }
    
    setUploadingReceipt(true);
    
    try {
      for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
          toast({
            title: "Invalid file type",
            description: `${file.name} must be an image or PDF`,
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
        
        // Create local preview (actual upload will happen on submit)
        const reader = new FileReader();
        reader.onload = (event) => {
          setReceipts(prev => [...prev, {
            file,
            preview: event.target.result,
            filename: file.name,
            mimeType: file.type,
          }]);
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to process receipt",
        variant: "destructive"
      });
    } finally {
      setUploadingReceipt(false);
      // Reset input
      e.target.value = '';
    }
  };
  
  /**
   * Remove a receipt from the list
   */
  const removeReceipt = (index) => {
    setReceipts(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8 max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors min-h-[44px] min-w-[44px] group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /><span className="text-sm sm:text-base">Back</span>
        </button>

        <Card className="border-border/50 shadow-sm animate-fade-in">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Receipt className="text-primary" size={22} />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Add Expense</h1>
                <p className="text-muted-foreground text-sm">Split an expense with your group</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Group</Label>
                <Select value={selectedGroup} onValueChange={(value) => {
                  setSelectedGroup(value);
                  if (errors.group) setErrors({ ...errors, group: undefined });
                }}>
                  <SelectTrigger className={`min-h-[48px] ${errors.group ? 'border-destructive' : 'border-border/50'}`}>
                    <SelectValue placeholder="Choose a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {userGroups.map(group => (<SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                {errors.group && (
                  <div className="flex items-center gap-1.5 text-sm text-destructive bg-destructive/10 px-2 py-1 rounded-lg">
                    <AlertCircle size={14} />
                    <span>{errors.group}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="min-h-[48px] border-border/50"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => {
                      const IconComponent = cat.icon;
                      return (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2"><IconComponent size={16} className={cat.color} /><span>{cat.name}</span></div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Input 
                  id="description" 
                  placeholder="e.g., Dinner, Groceries, Tickets" 
                  value={description} 
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errors.description) setErrors({ ...errors, description: undefined });
                  }}
                  className={`min-h-[48px] ${errors.description ? 'border-destructive' : 'border-border/50'}`}
                  maxLength={200}
                />
                {errors.description && (
                  <div className="flex items-center gap-1.5 text-sm text-destructive bg-destructive/10 px-2 py-1 rounded-lg">
                    <AlertCircle size={14} />
                    <span>{errors.description}</span>
                  </div>
                )}
                {description.length > 150 && (
                  <p className="text-xs text-muted-foreground">
                    {200 - description.length} characters remaining
                  </p>
                )}
              </div>

              {/* Bill Scanner Button */}
              <div className="p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-success/10 rounded-xl border border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm mb-1">Quick Scan</p>
                    <p className="text-xs text-muted-foreground">Upload a bill photo to auto-fill details</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBillScanner(true)}
                    className="ml-3 bg-background hover:bg-primary/10 border-primary/30 min-h-[44px] h-auto shadow-sm"
                  >
                    <Scan size={16} className="mr-2" />
                    Scan Bill
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">Amount</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input 
                    id="amount" 
                    type="number" 
                    placeholder="0.00" 
                    value={amount} 
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (errors.amount) setErrors({ ...errors, amount: undefined });
                    }}
                    className={`pl-10 min-h-[48px] text-lg font-semibold ${errors.amount ? 'border-destructive' : 'border-border/50'}`}
                    min="0" 
                    step="0.01"
                    max="10000000"
                  />
                </div>
                {errors.amount && (
                  <div className="flex items-center gap-1.5 text-sm text-destructive bg-destructive/10 px-2 py-1 rounded-lg">
                    <AlertCircle size={14} />
                    <span>{errors.amount}</span>
                  </div>
                )}
                {amount && parseFloat(amount) > 0 && !errors.amount && (
                  <div className="flex items-center gap-1.5 text-sm text-success bg-success/10 px-2 py-1 rounded-lg w-fit">
                    <TrendingUp size={14} />
                    <span>Amount looks good</span>
                  </div>
                )}
              </div>

              {currentGroup && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Paid By</Label>
                  <Select value={paidBy} onValueChange={setPaidBy}>
                    <SelectTrigger className="min-h-[48px] border-border/50"><SelectValue placeholder="Who paid?" /></SelectTrigger>
                    <SelectContent>
                      {currentGroup.members.map(memberId => (<SelectItem key={memberId} value={memberId}>{getUserProfile(memberId)?.name || 'User'}{memberId === user?.id && ' (You)'}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-medium">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-10 min-h-[48px] border-border/50" />
                </div>
              </div>

              {/* Recurring Expense Options (Comment 3) */}
              <Collapsible open={showRecurringOptions} onOpenChange={setShowRecurringOptions}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-between p-3 h-auto bg-muted/50 hover:bg-muted rounded-xl border border-border/50"
                  >
                    <div className="flex items-center gap-2">
                      <Repeat size={16} className="text-primary" />
                      <span className="text-sm font-medium">Recurring Expense</span>
                      {isRecurring && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          {recurrenceFrequency}
                        </span>
                      )}
                    </div>
                    <ChevronDown size={16} className={`transition-transform ${showRecurringOptions ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                    <div>
                      <p className="text-sm font-medium">Enable Recurring</p>
                      <p className="text-xs text-muted-foreground">Automatically create this expense on schedule</p>
                    </div>
                    <Switch
                      checked={isRecurring}
                      onCheckedChange={setIsRecurring}
                    />
                  </div>
                  
                  {isRecurring && (
                    <div className="space-y-4 p-3 border border-border/50 rounded-xl bg-card-elevated/30">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Frequency</Label>
                          <Select value={recurrenceFrequency} onValueChange={setRecurrenceFrequency}>
                            <SelectTrigger className="min-h-[44px] border-border/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="biweekly">Bi-weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-xs">Every</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              max="12"
                              value={recurrenceInterval}
                              onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                              className="min-h-[44px] border-border/50"
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {recurrenceFrequency === 'daily' ? 'day(s)' : 
                               recurrenceFrequency === 'weekly' ? 'week(s)' :
                               recurrenceFrequency === 'biweekly' ? 'period(s)' :
                               recurrenceFrequency === 'monthly' ? 'month(s)' : 'year(s)'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">End Date (Optional)</Label>
                        <Input
                          type="date"
                          value={recurrenceEndDate}
                          onChange={(e) => setRecurrenceEndDate(e.target.value)}
                          min={date}
                          className="min-h-[44px] border-border/50"
                          placeholder="No end date"
                        />
                        <p className="text-xs text-muted-foreground">Leave empty to repeat indefinitely</p>
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Multiple Receipts Upload (Comment 6) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Receipts</Label>
                  <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted/50 rounded-full">{receipts.length}/5</span>
                </div>
                
                {receipts.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {receipts.map((receipt, index) => (
                      <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted/30">
                        {receipt.mimeType.startsWith('image/') ? (
                          <img
                            src={receipt.preview}
                            alt={receipt.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={24} className="text-muted-foreground" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeReceipt(index)}
                          className="absolute top-1.5 right-1.5 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X size={12} />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                          <p className="text-[10px] text-white truncate">{receipt.filename}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {receipts.length < 5 && (
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={handleReceiptUpload}
                      className="hidden"
                      disabled={uploadingReceipt}
                    />
                    {uploadingReceipt ? (
                      <span className="text-sm text-muted-foreground">Processing...</span>
                    ) : (
                      <>
                        <Upload size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                          {receipts.length === 0 ? 'Add receipts (optional)' : 'Add more receipts'}
                        </span>
                      </>
                    )}
                  </label>
                )}
              </div>

              {currentGroup && (
                <div className="p-4 bg-gradient-to-br from-accent/50 to-accent/30 rounded-xl border border-border/50">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Users size={16} className="text-accent-foreground flex-shrink-0" />
                      <span className="text-sm font-medium text-accent-foreground truncate">
                        {splitConfig.type === 'equal' ? 'Split equally' : splitConfig.type === 'percentage' ? 'Percentage split' : 'Custom amounts'}
                      </span>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowSplitDialog(true)} className="min-h-[44px] h-auto flex-shrink-0 border-border/50 hover:border-primary/30 bg-background/50">
                      <Settings2 size={14} className="mr-1" /><span className="hidden sm:inline">Customize</span>
                    </Button>
                  </div>
                  {splitAmountPerPerson > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {splitConfig.type === 'equal' 
                          ? `Each person pays: ₹${splitAmountPerPerson.toFixed(2)}`
                          : `${Object.keys(splitConfig.shares).filter(m => splitConfig.shares[m] > 0).length} members included`
                        }
                      </p>
                      <div className="flex items-center gap-2 text-xs text-success bg-success/10 px-2 py-1 rounded-lg w-fit">
                        <CheckCircle2 size={12} />
                        <span>{currentGroup.members.length} member{currentGroup.members.length !== 1 ? 's' : ''} in group</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {currentGroup && (
                <AdvancedSplitDialog
                  open={showSplitDialog}
                  onOpenChange={setShowSplitDialog}
                  members={currentGroup.members}
                  totalAmount={parseFloat(amount) || 0}
                  currentSplit={splitConfig}
                  onSave={setSplitConfig}
                />
              )}

              <Button 
                type="submit" 
                className="w-full min-h-[52px] h-auto text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-xl transition-all" 
                size="lg" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Adding Expense...
                  </span>
                ) : 'Add Expense'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      {/* Bill Scanner Component */}
      <BillScanner
        isOpen={showBillScanner}
        onClose={() => setShowBillScanner(false)}
        onScanComplete={handleScanComplete}
      />
    </div>
  );
};

export default AddExpense;
