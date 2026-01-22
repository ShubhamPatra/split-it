import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import {
    CreditCard,
    Banknote,
    CheckCircle,
    AlertCircle,
    Loader2,
    Calendar,
    ArrowRight,
} from 'lucide-react';
import apiClient from '../../lib/apiClient';
import { cn } from '../../lib/utils';
import { useGroups } from '../../context/GroupContext';
import { toast } from '../../hooks/use-toast';

/**
 * In-Group Settlement Modal
 * Multi-step flow for recording in-group settlements
 * Matches the design and flow of CrossGroupSettlementModal
 */
const InGroupSettlementModal = ({
    isOpen,
    onClose,
    userDebts,
    allDebts,
    getUserProfile,
    isAdmin,
    currentUserId,
    groupId,
    onSettlementCreated,
    onUpiPayNow,
    initialDebt = null,
    initialMethod = null,
}) => {
    const { addSettlementLocally, invalidateBalanceCache } = useGroups();

    // Form state
    const [step, setStep] = useState(1);
    const [selectedDebt, setSelectedDebt] = useState(null);
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [settledAt, setSettledAt] = useState(new Date().toISOString().split('T')[0]);
    const [paymentNotes, setPaymentNotes] = useState('');

    // Status
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getInitials = (name) => {
        if (!name || typeof name !== 'string') return '?';
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Get relevant debts - ALWAYS show only current user's debts (what they owe)
    // Even admins should only see their own debts in this modal
    const debts = userDebts?.filter(debt => debt.from === currentUserId) || [];
    const activeDebts = debts
        .filter(debt => debt.amount > 0)
        .sort((a, b) => b.amount - a.amount);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSelectedDebt(initialDebt || null);
            setAmount(initialDebt?.amount?.toFixed(2) || '');
            setPaymentMethod(initialMethod || 'cash');
            setSettledAt(new Date().toISOString().split('T')[0]);
            setPaymentNotes('');
            setError(null);
            setSuccess(false);
        }
    }, [isOpen, initialDebt, initialMethod]);

    const handleDebtSelect = (debt) => {
        setSelectedDebt(debt);
        setAmount(debt.amount.toFixed(2));
        setStep(2);
    };

    const handleAmountChange = (e) => {
        const value = e.target.value;
        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
            setAmount(value);
        }
    };

    const handleSubmit = async () => {
        setError(null);

        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        if (numAmount > selectedDebt.amount + 0.01) {
            setError(`Amount cannot exceed ₹${selectedDebt.amount.toFixed(2)}`);
            return;
        }

        // Validate UPI ID if UPI payment
        if (paymentMethod === 'upi') {
            const receiverProfile = getUserProfile(selectedDebt.to);
            if (!receiverProfile?.upiId) {
                setError('Receiver has not set up UPI ID. Please use cash payment.');
                return;
            }
        }

        setIsSubmitting(true);

        try {
            const payload = {
                groupId,
                fromUserId: selectedDebt.from,
                toUserId: selectedDebt.to,
                amount: numAmount,
                currency: 'INR',
                settledAt,
                paymentMethod,
                paymentStatus: 'pending',
                paymentNotes: paymentNotes.trim() || undefined,
            };

            const response = await apiClient.post('/settlements', payload);

            // Update local state
            if (addSettlementLocally && response) {
                addSettlementLocally(response);
            }

            // Invalidate cache
            if (invalidateBalanceCache) {
                invalidateBalanceCache(groupId);
            }

            // Call parent callback
            if (onSettlementCreated) {
                onSettlementCreated();
            }

            setSuccess(true);

            // Show toast
            toast({
                title: paymentMethod === 'upi' ? 'UPI Payment Initiated' : 'Cash Payment Recorded',
                description: `₹${numAmount.toFixed(2)} - Pending receiver confirmation.`,
                duration: 5000,
            });

            // Trigger UPI payment if applicable
            if (paymentMethod === 'upi' && onUpiPayNow && selectedDebt.from === currentUserId) {
                const receiverProfile = getUserProfile(selectedDebt.to);
                onUpiPayNow({
                    amount: numAmount,
                    receiverName: receiverProfile?.name || 'Unknown User',
                    receiverUpiId: receiverProfile?.upiId,
                    note: paymentNotes || `Settlement - Split-It`
                });
            }

        } catch (err) {
            console.error('Settlement creation failed:', err);
            const errorMessage = err.message || 'Failed to record settlement. Please try again.';
            setError(errorMessage);
            toast({
                title: 'Failed to record settlement',
                description: errorMessage,
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            onClose();
        }
    };

    const renderStep1 = () => (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Select Who You're Paying
            </h3>
            {activeDebts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                        <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={32} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">All Settled Up!</h3>
                    <p className="text-muted-foreground">No pending settlements in this group</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {activeDebts.map((debt) => {
                        const receiverProfile = getUserProfile(debt.to);
                        const receiverName = receiverProfile?.name || 'Unknown User';

                        return (
                            <button
                                key={`${debt.from}-${debt.to}`}
                                onClick={() => handleDebtSelect(debt)}
                                className={cn(
                                    'w-full p-4 rounded-xl border-2 transition-all text-left',
                                    'hover:border-primary/50 hover:bg-accent/30',
                                    'border-border bg-card'
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-12 w-12 ring-2 ring-background">
                                        <AvatarFallback className="bg-gradient-to-br from-red-500 to-red-600 text-white font-semibold">
                                            {getInitials(receiverName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">
                                            Pay {receiverName}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            You owe
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-xl text-red-600 dark:text-red-400">
                                            ₹{debt.amount.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderStep2 = () => {
        const receiverProfile = getUserProfile(selectedDebt.to);
        const receiverName = receiverProfile?.name || 'Unknown User';
        const hasUpiId = !!receiverProfile?.upiId;

        return (
            <div className="space-y-4">
                {/* Recipient Info */}
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                            {getInitials(receiverName)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <p className="font-medium">{receiverName}</p>
                        <p className="text-sm text-muted-foreground">
                            Total owed: ₹{selectedDebt.amount.toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                    <label htmlFor="amount" className="block text-sm font-medium">Settlement Amount</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                        <Input
                            id="amount"
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={handleAmountChange}
                            placeholder="0.00"
                            className="pl-8 text-lg font-semibold"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAmount(selectedDebt.amount.toFixed(2))}
                        >
                            Full Amount
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAmount((selectedDebt.amount / 2).toFixed(2))}
                        >
                            Half
                        </Button>
                    </div>
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium">Payment Method</label>
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setPaymentMethod('cash')}
                            className={cn(
                                'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                                paymentMethod === 'cash'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                            )}
                        >
                            <Banknote size={24} className={paymentMethod === 'cash' ? 'text-primary' : 'text-muted-foreground'} />
                            <span className="font-medium">Cash</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => hasUpiId && setPaymentMethod('upi')}
                            disabled={!hasUpiId}
                            className={cn(
                                'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                                !hasUpiId && 'opacity-50 cursor-not-allowed',
                                paymentMethod === 'upi'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                            )}
                            title={!hasUpiId ? "Receiver hasn't set up UPI" : ''}
                        >
                            <CreditCard size={24} className={paymentMethod === 'upi' ? 'text-primary' : 'text-muted-foreground'} />
                            <span className="font-medium">UPI</span>
                        </button>
                    </div>
                </div>

                {/* Date */}
                <div className="space-y-2">
                    <label htmlFor="date" className="block text-sm font-medium">Settlement Date</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <Input
                            id="date"
                            type="date"
                            value={settledAt}
                            onChange={(e) => setSettledAt(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                    <label htmlFor="notes" className="block text-sm font-medium">Notes (Optional)</label>
                    <Textarea
                        id="notes"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="Add a note about this payment..."
                        rows={2}
                    />
                </div>
            </div>
        );
    };

    const renderStep3 = () => {
        const receiverProfile = getUserProfile(selectedDebt.to);
        const receiverName = receiverProfile?.name || 'Unknown User';

        return (
            <div className="space-y-4">
                <h3 className="font-semibold text-center">Confirm Settlement</h3>

                {/* Summary Card */}
                <div className="p-4 rounded-xl bg-muted/50 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Paying</span>
                        <span className="font-bold text-lg">₹{parseFloat(amount).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">To</span>
                        <span className="font-medium">{receiverName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Method</span>
                        <Badge variant="secondary">
                            {paymentMethod === 'cash' ? 'Cash' : 'UPI'}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span>{new Date(settledAt).toLocaleDateString()}</span>
                    </div>
                    {paymentNotes && (
                        <div className="pt-2 border-t">
                            <span className="text-muted-foreground text-sm">Note: </span>
                            <span className="text-sm">{paymentNotes}</span>
                        </div>
                    )}
                </div>

                {parseFloat(amount) < selectedDebt.amount - 0.01 && (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            This is a partial settlement. ₹{(selectedDebt.amount - parseFloat(amount)).toFixed(2)} will remain.
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        );
    };

    const renderSuccess = () => (
        <div className="text-center py-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={32} />
            </div>
            <div>
                <h3 className="font-semibold text-lg">Settlement Recorded!</h3>
                <p className="text-muted-foreground mt-1">
                    Your payment of ₹{parseFloat(amount).toFixed(2)} has been recorded and is pending receiver confirmation.
                </p>
            </div>
            <Button onClick={handleClose} className="mt-4">
                Done
            </Button>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                {!success && (
                    <DialogHeader>
                        <DialogTitle>
                            {step === 1 && 'Record Settlement'}
                            {step === 2 && 'Payment Details'}
                            {step === 3 && 'Review & Confirm'}
                        </DialogTitle>
                        {/* Step indicator */}
                        {selectedDebt && (
                            <div className="flex gap-2 pt-2">
                                {[1, 2, 3].map((s) => (
                                    <div
                                        key={s}
                                        className={cn(
                                            'h-1 flex-1 rounded-full transition-colors',
                                            s <= step ? 'bg-primary' : 'bg-muted'
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </DialogHeader>
                )}

                <div className="py-4">
                    {success ? (
                        renderSuccess()
                    ) : (
                        <>
                            {step === 1 && renderStep1()}
                            {step === 2 && renderStep2()}
                            {step === 3 && renderStep3()}

                            {error && (
                                <Alert variant="destructive" className="mt-4">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            {/* Navigation Buttons */}
                            {selectedDebt && (
                                <div className="flex gap-3 mt-6">
                                    {step > 1 && (
                                        <Button
                                            variant="outline"
                                            onClick={() => setStep(step - 1)}
                                            disabled={isSubmitting}
                                        >
                                            Back
                                        </Button>
                                    )}
                                    {step === 1 && activeDebts.length > 0 && (
                                        <Button variant="outline" onClick={handleClose} className="flex-1">
                                            Cancel
                                        </Button>
                                    )}
                                    {step < 3 && (
                                        <Button
                                            onClick={() => setStep(step + 1)}
                                            disabled={!amount || parseFloat(amount) <= 0}
                                            className="flex-1"
                                        >
                                            Continue
                                            <ArrowRight size={16} className="ml-2" />
                                        </Button>
                                    )}
                                    {step === 3 && (
                                        <Button
                                            onClick={handleSubmit}
                                            disabled={isSubmitting}
                                            className="flex-1"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="animate-spin mr-2" size={16} />
                                                    Processing...
                                                </>
                                            ) : (
                                                'Confirm Settlement'
                                            )}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default InGroupSettlementModal;
