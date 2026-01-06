import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Receipt, IndianRupee, Calendar, Users, Settings2, Scan, AlertCircle, TrendingUp, CheckCircle2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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

  if (!isAuthenticated) return null;
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
      
      const expenseId = await addExpense({
        groupId: selectedGroup,
        description: sanitizedDescription,
        amount: parseFloat(amount),
        currency: 'INR',
        paidBy,
        date,
        splitAmong: Object.keys(splitConfig.shares).filter(m => splitConfig.shares[m] > 0),
        category,
        splitConfig,
      });

      if (expenseId) {
        addNotification({
          type: 'expense_added',
          title: 'Expense Added',
          message: `₹${parseFloat(amount).toLocaleString()} for ${sanitizedDescription}`,
          groupId: selectedGroup,
        });

        toast({ 
          title: "Expense added!", 
          description: `₹${parseFloat(amount).toLocaleString()} expense has been added.` 
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8 max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors min-h-[44px] min-w-[44px]">
          <ArrowLeft size={18} /><span className="text-sm sm:text-base">Back</span>
        </button>

        <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="p-2 sm:p-3 rounded-xl bg-primary/10 flex-shrink-0"><Receipt className="text-primary" size={20} /></div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl md:text-2xl font-bold text-foreground">Add Expense</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Split an expense with your group</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Select Group</Label>
              <Select value={selectedGroup} onValueChange={(value) => {
                setSelectedGroup(value);
                if (errors.group) setErrors({ ...errors, group: undefined });
              }}>
                <SelectTrigger className={`min-h-[44px] ${errors.group ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Choose a group" />
                </SelectTrigger>
                <SelectContent>
                  {userGroups.map(group => (<SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>))}
                </SelectContent>
              </Select>
              {errors.group && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle size={14} />
                  <span>{errors.group}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select category" /></SelectTrigger>
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
              <Label htmlFor="description" className="text-sm sm:text-base">Description</Label>
              <Input 
                id="description" 
                placeholder="e.g., Dinner, Groceries, Tickets" 
                value={description} 
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) setErrors({ ...errors, description: undefined });
                }}
                className={`min-h-[44px] text-sm sm:text-base ${errors.description ? 'border-destructive' : ''}`}
                maxLength={200}
              />
              {errors.description && (
                <div className="flex items-center gap-1 text-sm text-destructive">
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
            <div className="p-4 bg-gradient-to-r from-primary/10 to-success/10 rounded-lg border border-primary/20">
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
                  className="ml-3 bg-background hover:bg-primary/10 border-primary/30 min-h-[44px] h-auto"
                >
                  <Scan size={16} className="mr-2" />
                  Scan Bill
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm sm:text-base">Amount</Label>
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
                  className={`pl-10 min-h-[44px] text-sm sm:text-base ${errors.amount ? 'border-destructive' : ''}`}
                  min="0" 
                  step="0.01"
                  max="10000000"
                />
              </div>
              {errors.amount && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle size={14} />
                  <span>{errors.amount}</span>
                </div>
              )}
              {amount && parseFloat(amount) > 0 && !errors.amount && (
                <div className="flex items-center gap-1 text-sm text-success">
                  <TrendingUp size={14} />
                  <span>Amount looks good</span>
                </div>
              )}
            </div>

            {currentGroup && (
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Paid By</Label>
                <Select value={paidBy} onValueChange={setPaidBy}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Who paid?" /></SelectTrigger>
                  <SelectContent>
                    {currentGroup.members.map(memberId => (<SelectItem key={memberId} value={memberId}>{getUserProfile(memberId)?.name || 'User'}{memberId === user?.id && ' (You)'}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm sm:text-base">Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-10 min-h-[44px] text-sm sm:text-base" />
              </div>
            </div>

            {currentGroup && (
              <div className="p-3 sm:p-4 bg-accent/50 rounded-lg">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Users size={16} className="text-accent-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-accent-foreground truncate">
                      {splitConfig.type === 'equal' ? 'Split equally' : splitConfig.type === 'percentage' ? 'Percentage split' : 'Custom amounts'}
                    </span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowSplitDialog(true)} className="min-h-[44px] h-auto flex-shrink-0">
                    <Settings2 size={14} className="mr-1" /><span className="hidden sm:inline">Customize</span>
                  </Button>
                </div>
                {splitAmountPerPerson > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {splitConfig.type === 'equal' 
                        ? `Each person pays: ₹${splitAmountPerPerson.toFixed(2)}`
                        : `${Object.keys(splitConfig.shares).filter(m => splitConfig.shares[m] > 0).length} members included`
                      }
                    </p>
                    <div className="flex items-center gap-2 text-xs text-success">
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

            <Button type="submit" className="w-full min-h-[44px] h-auto text-sm sm:text-base" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Adding Expense...' : 'Add Expense'}
            </Button>
          </form>
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
