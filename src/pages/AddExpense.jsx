import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Receipt, IndianRupee, Calendar, Users, Settings2, Scan, TrendingUp, CheckCircle2, Repeat, ChevronDown, Upload, X, ImageIcon, PieChart, History, CloudOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import { useNotifications } from '../context/NotificationContext';
import { useOffline } from '../hooks/useOffline';
import { categories, getCategoryById } from '../data/categories';
import { sanitizeInput } from '../lib/utils';
import Navbar from '../components/layout/Navbar';
import AdvancedSplitDialog from '../components/expense/AdvancedSplitDialog';
import BillScanner from '../components/expense/BillScanner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { FormFieldError } from '../components/ui/form-field-error';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
import CurrencySelector from '../components/common/CurrencySelector';
import { getApiBaseUrl } from '../utils/apiPaths';

const AddExpense = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { groups, addExpense, getUserProfile } = useGroups();
  const { addNotification } = useNotifications();
  const { toast } = useToast();
  const { isOffline } = useOffline();

  const [selectedGroup, setSelectedGroup] = useState(searchParams.get('groupId') || '');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [paidBy, setPaidBy] = useState(user?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('other');
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitConfig, setSplitConfig] = useState(() => {
    // Initialize with all members selected if a group is pre-selected
    const groupId = searchParams.get('groupId');
    if (groupId) {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        // Calculate equal shares based on current amount (0 if not set)
        const numAmount = parseFloat(amount) || 0;
        const equalShare = numAmount / group.members.length;
        const shares = {};
        group.members.forEach(m => { shares[m] = equalShare; });
        return { type: 'equal', shares };
      }
    }
    return { type: 'equal', shares: {} };
  });
  const [splitCustomized, setSplitCustomized] = useState(false);
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

  // Initialize split config when group changes
  useEffect(() => {
    if (selectedGroup) {
      const group = groups.find(g => g.id === selectedGroup);
      if (group) {
        const numAmount = parseFloat(amount) || 0;
        const equalShare = numAmount / group.members.length;
        const shares = {};
        group.members.forEach(m => { shares[m] = equalShare; });
        setSplitConfig({ type: 'equal', shares });
        setSplitCustomized(false); // Reset customization flag when group changes
      }
    }
  }, [selectedGroup, groups, amount]);

  // Recalculate shares when amount changes (only for non-customized equal splits)
  useEffect(() => {
    // Only auto-update if split hasn't been customized and we have a group
    if (!splitCustomized && selectedGroup && splitConfig.type === 'equal') {
      const group = groups.find(g => g.id === selectedGroup);
      if (group) {
        const numAmount = parseFloat(amount) || 0;
        const equalShare = numAmount / group.members.length;
        const shares = {};
        group.members.forEach(m => { shares[m] = equalShare; });
        setSplitConfig(prev => ({ ...prev, shares }));
      }
    }
  }, [amount, splitCustomized, selectedGroup, groups, splitConfig.type]);

  const userGroups = groups.filter(g => g.members.includes(user?.id || ''));
  const currentGroup = groups.find(g => g.id === selectedGroup);

  // Get recent expenses for suggestions
  const recentExpenses = useMemo(() => {
    const userExpenses = groups
      .filter(g => g.members.includes(user?.id || ''))
      .flatMap(g => (g.expenses || []).map(e => ({ ...e, groupName: g.name })))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
    return userExpenses;
  }, [groups, user?.id]);

  // Most used categories
  const topCategories = useMemo(() => {
    const categoryCount = {};
    groups.forEach(g => {
      (g.expenses || []).forEach(exp => {
        const cat = exp.category || 'other';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
    });
    return Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([cat]) => getCategoryById(cat));
  }, [groups]);

  // Check if sidebar has content to show
  const hasSidebarContent = topCategories.length > 0 || recentExpenses.length > 0;

  /**
   * Calculate the per-person split amount
   * 
   * This calculation determines how much each person pays when the expense is split.
   * 
   * Requirements addressed:
   * - 4.1: Display per-person amount in split summary
   * - 4.2: Count only members with non-zero shares
   * - 4.3: Handle zero/invalid amounts
   * - 4.4: Display accurate per-person calculation
   * 
   * Logic:
   * 1. Return 0 if no amount entered or no group selected (edge case)
   * 2. Return 0 if amount is invalid (NaN, negative, or zero) (edge case)
   * 3. For equal splits:
   *    - Count only members with share > 0 (excludes members not participating)
   *    - Divide total amount by count of participating members
   *    - Return 0 if no members selected (edge case)
   * 4. For non-equal splits, return 0 (per-person doesn't apply to custom splits)
   */
  const splitAmountPerPerson = useMemo(() => {
    // Edge case: No amount or group selected
    if (!amount || !currentGroup) return 0;
    
    const total = parseFloat(amount);
    
    // Edge case: Invalid amount (NaN, negative, or zero)
    if (isNaN(total) || total <= 0) return 0;

    if (splitConfig.type === 'equal') {
      // Count only members who have a non-zero share (participating members)
      // This ensures we don't divide by zero and accurately reflect who's splitting
      const selectedMemberCount = Object.keys(splitConfig.shares).filter(m => splitConfig.shares[m] > 0).length;
      
      // Edge case: No members selected, return 0 to avoid division by zero
      return selectedMemberCount > 0 ? total / selectedMemberCount : 0;
    }
    
    // For non-equal split types, per-person amount doesn't apply
    return 0;
  }, [amount, currentGroup, splitConfig.type, splitConfig.shares]);

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
        currency: currency,
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
        // Check if expense was created offline
        const isOfflineExpense = expenseId.startsWith('temp_');
        
        // Upload receipts if any were selected (only for online expenses)
        if (receipts.length > 0 && !isOfflineExpense) {
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

        // Show appropriate notification based on online/offline status
        if (isOfflineExpense) {
          toast({
            title: "Expense saved offline",
            description: `₹${parseFloat(amount).toLocaleString()} expense will sync when you're back online.${receipts.length > 0 ? ' Receipts will be uploaded after sync.' : ''}`,
            variant: "default",
            duration: 5000,
          });
        } else {
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
        }

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

    const API_URL = getApiBaseUrl();
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

    // Handle line items from OCR (OCR-003)
    if (scannedData.lineItems && scannedData.lineItems.length > 0 && currentGroup) {
      // Convert OCR line items to split config format
      const ocrLineItems = scannedData.lineItems.map((item, index) => ({
        id: Date.now() + index,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        assignedTo: [], // User will assign members
      }));

      // Set split type to itemized and pre-populate line items
      setSplitConfig({
        type: 'itemized',
        shares: {},
        lineItems: ocrLineItems,
      });
      setSplitCustomized(true); // Mark as customized so it doesn't get overwritten

      toast({
        title: "Line items detected!",
        description: `${scannedData.lineItems.length} items extracted. Click "Customize" to assign members.`,
      });
    } else {
      toast({
        title: "Data extracted!",
        description: "Bill details have been filled. You can edit them if needed.",
      });
    }
  };

  /**
   * Handle split dialog save
   */
  const handleSplitDialogSave = (newSplitConfig) => {
    setSplitConfig(newSplitConfig);
    setSplitCustomized(true); // Mark as customized
    setShowSplitDialog(false);
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

      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        {/* Desktop Layout */}
        <div className={`${hasSidebarContent ? 'lg:grid lg:grid-cols-12 lg:gap-8' : 'max-w-2xl mx-auto'}`}>
          {/* Main Content */}
          <div className={hasSidebarContent ? 'lg:col-span-8 xl:col-span-8' : ''}>
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors min-h-[44px] min-w-[44px] group">
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /><span className="text-sm sm:text-base">Back</span>
            </button>

            <Card className="border-border/50 shadow-sm animate-fade-in">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded bg-primary/10 border border-primary/20">
                    <Receipt className="text-primary" size={22} />
                  </div>
                  <div className="min-w-0">
                    <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Add Expense</h1>
                    <p className="text-muted-foreground text-sm">Split an expense with your group</p>
                  </div>
                </div>

                {/* Offline Mode Indicator */}
                {isOffline && (
                  <div className="mb-5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                    <CloudOff size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        You're offline
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-200 mt-0.5">
                        Expense will be saved locally and synced when you're back online.
                      </p>
                    </div>
                  </div>
                )}

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
                    <FormFieldError error={errors.group} />
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
                    <FormFieldError error={errors.description} />
                    {description.length > 150 && (
                      <p className="text-xs text-muted-foreground">
                        {200 - description.length} characters remaining
                      </p>
                    )}
                  </div>

                  {/* Bill Scanner Button */}
                  <div className="p-4 bg-muted/30 rounded border border-primary/20">
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
                    <FormFieldError error={errors.amount} />
                    {amount && parseFloat(amount) > 0 && !errors.amount && (
                      <div className="flex items-center gap-1.5 text-sm text-success bg-success/10 px-2 py-1 rounded-lg w-fit">
                        <TrendingUp size={14} />
                        <span>Amount looks good</span>
                      </div>
                    )}
                  </div>

                  {/* Currency Selector */}
                  <CurrencySelector
                    value={currency}
                    onChange={setCurrency}
                    showLabel={true}
                    className="space-y-2"
                  />

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
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="pr-10 min-h-[48px] border-border/50 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
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
                            <div className="relative">
                              <Input
                                type="date"
                                value={recurrenceEndDate}
                                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                min={date}
                                className="pr-10 min-h-[44px] border-border/50 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                placeholder="No end date"
                              />
                              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
                            </div>
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
                          <div key={index} className="relative group aspect-square rounded overflow-hidden border border-border/50 bg-muted/30">
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
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1.5">
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
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Users size={16} className="text-primary flex-shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">
                            {splitConfig.type === 'equal' ? 'Split equally' : 
                             splitConfig.type === 'percentage' ? 'Percentage split' : 
                             splitConfig.type === 'itemized' ? 'Itemized split' : 
                             'Custom amounts'}
                          </span>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowSplitDialog(true)} className="min-h-[44px] h-auto flex-shrink-0 border-primary/30 hover:border-primary/50 hover:bg-primary/10">
                          <Settings2 size={14} className="mr-1" /><span className="hidden sm:inline">Customize</span>
                        </Button>
                      </div>
                      {splitConfig.type === 'itemized' && splitConfig.lineItems && splitConfig.lineItems.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {splitConfig.lineItems.length} line item{splitConfig.lineItems.length > 1 ? 's' : ''} • Click Customize to assign members
                          </p>
                          <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 px-2 py-1 rounded-lg w-fit">
                            <CheckCircle2 size={12} />
                            <span>Itemized split from scanned receipt</span>
                          </div>
                        </div>
                      ) : splitAmountPerPerson > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {splitConfig.type === 'equal'
                              ? `Each person pays: ₹${splitAmountPerPerson.toFixed(2)}`
                              : `${Object.keys(splitConfig.shares).filter(m => splitConfig.shares[m] > 0).length} members included`
                            }
                          </p>
                          <div className="flex items-center gap-2 text-xs text-success bg-success/10 px-2 py-1 rounded-lg w-fit">
                            <CheckCircle2 size={12} />
                            <span>Split among {Object.keys(splitConfig.shares).filter(m => splitConfig.shares[m] > 0).length} of {currentGroup.members.length} members</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {currentGroup && (
                    <AdvancedSplitDialog
                      open={showSplitDialog}
                      onOpenChange={setShowSplitDialog}
                      members={currentGroup.members}
                      totalAmount={parseFloat(amount) || 0}
                      currentSplit={splitConfig}
                      onSave={handleSplitDialogSave}
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
          </div>

          {/* Sidebar - Desktop Only */}
          {hasSidebarContent && (
            <aside className="hidden lg:block lg:col-span-4 xl:col-span-4">
              <div className="sticky top-24 space-y-6">
                {/* Popular Categories */}
                {topCategories.length > 0 && (
                  <Card className="border-border/50 shadow-sm animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <PieChart size={16} className="text-primary" />
                        Your Top Categories
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {topCategories.map(cat => {
                          const IconComponent = cat.icon;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setCategory(cat.id)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${category === cat.id
                                  ? 'bg-primary/10 border-primary/30 text-primary'
                                  : 'bg-muted/30 border-border/50 hover:border-primary/30 hover:bg-primary/5'
                                }`}
                            >
                              <IconComponent size={14} className={cat.color} />
                              <span className="text-sm font-medium">{cat.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Activity */}
                {recentExpenses.length > 0 && (
                  <Card className="border-border/50 shadow-sm animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <History size={16} className="text-primary" />
                        Recent Expenses
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {recentExpenses.map((exp, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/30">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{exp.description}</p>
                            <p className="text-xs text-muted-foreground">{exp.groupName}</p>
                          </div>
                          <span className="text-sm font-semibold text-foreground">₹{exp.amount?.toLocaleString()}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </aside>
          )}
        </div>
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
