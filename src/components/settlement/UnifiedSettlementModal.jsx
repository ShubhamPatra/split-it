import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Calendar, Smartphone, Wallet, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

/**
 * UnifiedSettlementModal
 * 
 * A single modal component that handles both in-group and cross-group settlements.
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {Function} props.onOpenChange - Callback when modal open state changes
 * @param {string} props.mode - 'in-group' or 'cross-group'
 * @param {Object} props.group - Group object (for in-group mode)
 * @param {Object} props.person - Person object (for cross-group mode)
 * @param {Object} props.balances - Balance data
 * @param {Array} props.debts - Array of debt objects (for in-group mode)
 * @param {Function} props.getUserProfile - Function to get user profile
 * @param {Function} props.onSubmit - Callback when settlement is submitted
 * @param {boolean} props.isAdmin - Whether current user is admin (for in-group mode)
 * @param {boolean} props.isCreator - Whether current user is creator (for in-group mode)
 */
const UnifiedSettlementModal = ({
  open,
  onOpenChange,
  mode = 'in-group', // 'in-group' or 'cross-group'
  group = null,
  person = null,
  balances = {},
  debts = [],
  getUserProfile,
  onSubmit,
  isAdmin = false,
  isCreator = false,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Form state
  const [paidBy, setPaidBy] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [settleDate, setSettleDate] = useState(() => {
    // Use local date to avoid timezone issues
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine if user can record for others (admin/creator in in-group mode)
  const canRecordForOthers = mode === 'in-group' && (isAdmin || isCreator);

  // Get user's debts (what they owe)
  const userDebts = useMemo(() => {
    if (mode === 'cross-group') return [];
    return debts.filter(d => d.from === user?.id);
  }, [debts, user?.id, mode]);

  // Get debts for a specific payer
  const getDebtsForPayer = (payerId) => {
    if (mode === 'cross-group') return [];
    return debts.filter(d => d.from === payerId);
  };

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (open) {
      // Set defaults based on mode
      if (mode === 'cross-group' && person) {
        setPaidBy(user?.id || '');
        setPaidTo(person.id);
        setAmount(Math.abs(person.balance ?? 0).toFixed(2));
        setPaymentMethod('upi');
      } else if (mode === 'in-group') {
        setPaidBy(canRecordForOthers ? '' : user?.id || '');
        setPaidTo('');
        setAmount('');
        setPaymentMethod('cash');
      }
      // Use local date to avoid timezone issues
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      setSettleDate(`${year}-${month}-${day}`);
      setTransactionRef('');
      setPaymentNotes('');
    }
  }, [open, mode, person, user?.id, canRecordForOthers]);

  // Auto-suggest amount when receiver is selected
  const handleReceiverChange = (receiverId) => {
    setPaidTo(receiverId);

    if (mode === 'in-group') {
      const payerId = canRecordForOthers ? paidBy : user?.id;
      if (payerId) {
        const debt = getDebtsForPayer(payerId).find(d => d.to === receiverId);
        if (debt) {
          setAmount(debt.amount.toFixed(2));
        }
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    const finalPaidBy = canRecordForOthers ? paidBy : user?.id;

    if (!finalPaidBy) {
      toast({ title: 'Select payer', description: 'Please select who made the payment.', variant: 'destructive' });
      return;
    }

    if (!paidTo) {
      toast({ title: 'Select recipient', description: 'Please select who received the payment.', variant: 'destructive' });
      return;
    }

    if (finalPaidBy === paidTo) {
      toast({ title: 'Invalid selection', description: 'Payer and receiver cannot be the same person.', variant: 'destructive' });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount greater than 0.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      const settlementData = {
        fromUserId: finalPaidBy,
        toUserId: paidTo,
        amount: parseFloat(amount),
        currency: 'INR',
        paymentMethod,
        settledAt: settleDate,
        transactionRef: transactionRef.trim() || undefined,
        paymentNotes: paymentNotes.trim() || undefined,
      };

      // Add group ID for in-group settlements
      if (mode === 'in-group' && group) {
        settlementData.groupId = group.id;
      }

      await onSubmit(settlementData);

      // Close modal on success
      onOpenChange(false);
    } catch (error) {
      console.error('Settlement submission error:', error);
      toast({
        title: 'Settlement Failed',
        description: error.response?.data?.message || error.message || 'Failed to create settlement',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render title and description based on mode
  const getTitle = () => {
    if (mode === 'cross-group' && person) {
      return `Settle with ${person.name}`;
    }
    return 'Record Settlement';
  };

  const getDescription = () => {
    if (mode === 'cross-group') {
      return 'Record a cross-group settlement. This will update balances across all shared groups.';
    }
    return 'Record a payment you made to settle up';
  };

  // Check if all settled
  const isAllSettled = mode === 'in-group' && debts.length === 0;
  const userIsSettled = mode === 'in-group' && !canRecordForOthers && userDebts.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">{getTitle()}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">{getDescription()}</DialogDescription>
        </DialogHeader>

        {/* All Settled State */}
        {(isAllSettled || userIsSettled) && (
          <div className="text-center py-6">
            <CheckCircle className="mx-auto text-success mb-3" size={48} />
            <p className="text-lg font-medium text-foreground">
              {isAllSettled ? "All settled up!" : "You're all settled up!"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isAllSettled
                ? "No pending settlements in this group."
                : "You don't owe anyone in this group."}
            </p>
          </div>
        )}

        {/* Settlement Form */}
        {!isAllSettled && !userIsSettled && (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 py-4">
            {/* Payer Selection (Admin/Creator or Cross-Group) */}
            {canRecordForOthers && (
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Who paid?</Label>
                <Select
                  value={paidBy}
                  onValueChange={(val) => {
                    setPaidBy(val);
                    setPaidTo('');
                    setAmount('');
                  }}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Select payer" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set(debts.map(d => d.from))].map(memberId => (
                      <SelectItem key={memberId} value={memberId}>
                        {getUserProfile(memberId)?.name || 'Unknown'}
                        {memberId === user?.id && ' (You)'}
                        <span className="text-destructive ml-2">
                          (owes ₹{Math.abs(balances[memberId] ?? 0).toFixed(0)})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Show current user as payer (non-admin) */}
            {!canRecordForOthers && mode === 'in-group' && (
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">You are paying</Label>
                <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                  <span className="font-medium">{getUserProfile(user?.id)?.name || 'You'}</span>
                  <span className="text-destructive ml-2">
                    (owes ₹{Math.abs(balances[user?.id] ?? 0).toFixed(0)})
                  </span>
                </div>
              </div>
            )}

            {/* Receiver Selection */}
            {(mode === 'cross-group' || !canRecordForOthers || paidBy) && (
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">
                  {mode === 'cross-group' ? 'Settling with' : canRecordForOthers ? 'Paid to' : 'Pay to'}
                </Label>
                {mode === 'cross-group' && person ? (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                    <span className="font-medium">{person.name}</span>
                    <span className="text-success ml-2">
                      (balance: ₹{Math.abs(person.balance ?? 0).toFixed(0)})
                    </span>
                  </div>
                ) : (
                  <Select value={paidTo} onValueChange={handleReceiverChange}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder={canRecordForOthers ? "Select receiver" : "Select who to pay"} />
                    </SelectTrigger>
                    <SelectContent>
                      {getDebtsForPayer(canRecordForOthers ? paidBy : user?.id).map(debt => (
                        <SelectItem key={debt.to} value={debt.to}>
                          {getUserProfile(debt.to)?.name || 'Unknown'}
                          <span className="text-success ml-2">
                            ({canRecordForOthers ? 'owed' : 'you owe'} ₹{debt.amount.toFixed(0)})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm sm:text-base">Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0.01"
                step="0.01"
                className="min-h-[44px]"
                required
              />
              {paidTo && mode === 'in-group' && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Note:</span>{' '}
                  {canRecordForOthers
                    ? `${getUserProfile(paidBy)?.name} owes ₹${getDebtsForPayer(paidBy).find(d => d.to === paidTo)?.amount.toFixed(2) || 0} to ${getUserProfile(paidTo)?.name}`
                    : `You owe ₹${userDebts.find(d => d.to === paidTo)?.amount.toFixed(2) || 0} to ${getUserProfile(paidTo)?.name}`
                  }
                </p>
              )}
              {mode === 'cross-group' && person && (
                <p className="text-xs text-muted-foreground">
                  Maximum: ₹{Math.abs(person.balance ?? 0).toFixed(2)}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Payment Method</Label>
              {mode === 'cross-group' ? (
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                    className="flex-1 min-h-[44px] h-auto text-sm"
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <Wallet size={16} className="mr-1" />
                    Cash
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === 'upi' ? 'default' : 'outline'}
                    className="flex-1 min-h-[44px] h-auto text-sm"
                    onClick={() => setPaymentMethod('upi')}
                    disabled={!paidTo || !getUserProfile(paidTo)?.upiId}
                    title={!paidTo ? 'Select receiver first' : !getUserProfile(paidTo)?.upiId ? 'Receiver has not set up UPI ID' : 'Pay via UPI'}
                  >
                    <Smartphone size={16} className="mr-1" />
                    UPI
                  </Button>
                </div>
              )}
              {mode === 'in-group' && paidTo && !getUserProfile(paidTo)?.upiId && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Note:</span> UPI payment unavailable - {getUserProfile(paidTo)?.name} hasn't added their UPI ID yet
                </p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="settleDate" className="text-sm sm:text-base">Date</Label>
              <div className="relative">
                <Input
                  id="settleDate"
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="pr-10 min-h-[44px] cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
              </div>
            </div>

            {/* Transaction Reference (Optional) */}
            {mode === 'cross-group' && (
              <div className="space-y-2">
                <Label htmlFor="transactionRef" className="text-sm sm:text-base">
                  Transaction Reference (Optional)
                </Label>
                <Input
                  id="transactionRef"
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="e.g., TXN123456"
                  className="min-h-[44px]"
                />
              </div>
            )}

            {/* Payment Notes (Optional) */}
            {mode === 'cross-group' && (
              <div className="space-y-2">
                <Label htmlFor="paymentNotes" className="text-sm sm:text-base">
                  Notes (Optional)
                </Label>
                <Input
                  id="paymentNotes"
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Add a note..."
                  className="min-h-[44px]"
                />
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full min-h-[44px] h-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  Record Settlement
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedSettlementModal;
