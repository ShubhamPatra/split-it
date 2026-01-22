import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { CheckCircle, Wallet, Smartphone, Check, Calendar, X, AlertTriangle } from 'lucide-react';
import apiClient from '../../lib/apiClient';
import { toast } from '../../hooks/use-toast';
import { useGroups } from '../../context/GroupContext';

const RecordSettlementModal = ({
    isOpen,
    onClose,
    userDebts,
    allDebts,
    balances,
    getUserProfile,
    isAdmin,
    currentUserId,
    groupId,
    onSettlementCreated,
    onUpiPayNow,
    initialDebt = null,
    initialMethod = null,
    loading = false
}) => {
    // Get GroupContext methods for direct state updates
    const { addSettlementLocally, invalidateBalanceCache } = useGroups();

    // State management
    const [selectedDebt, setSelectedDebt] = useState(null);
    const [expandedDebtId, setExpandedDebtId] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState(null);
    const [isPending, setIsPending] = useState(false); // Track pending state for both cash and UPI

    // Get relevant debts
    const debts = isAdmin ? allDebts : userDebts.filter(debt => debt.from === currentUserId);

    // Filter out settled debts and sort by amount
    const activeDebts = debts
        .filter(debt => debt.amount > 0)
        .sort((a, b) => b.amount - a.amount);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedDebt(null);
            setExpandedDebtId(null);
            setPaymentMethod(null);
            setAmount('');
            setDate(new Date().toISOString().split('T')[0]);
            setNote('');
            setShowSuccess(false);
            setError(null);
            setIsPending(false); // Reset pending state
        }
    }, [isOpen]);

    // Set initial selection from settlement suggestions (Comment 3)
    useEffect(() => {
        if (isOpen && initialDebt && activeDebts.length > 0) {
            // Find matching debt in activeDebts based on from/to
            const matchingDebt = activeDebts.find(
                debt => debt.from === initialDebt.from && debt.to === initialDebt.to
            );
            if (matchingDebt) {
                setSelectedDebt(matchingDebt);
                setExpandedDebtId(`${matchingDebt.from}-${matchingDebt.to}`);
                // Comment 2: Only set UPI if receiver has a valid UPI ID
                if (initialMethod) {
                    const receiverProfile = getUserProfile(matchingDebt.to);
                    const hasUpiId = !!receiverProfile?.upiId;
                    if (initialMethod === 'upi' && !hasUpiId) {
                        // Don't set UPI if receiver doesn't have UPI ID
                        setPaymentMethod(null);
                    } else {
                        setPaymentMethod(initialMethod);
                    }
                }
                setAmount(matchingDebt.amount.toFixed(2));
            }
        }
    }, [isOpen, initialDebt, initialMethod, activeDebts, getUserProfile]);

    // Pre-fill amount when debt is selected
    useEffect(() => {
        if (selectedDebt) {
            setAmount(selectedDebt.amount.toFixed(2));
        }
    }, [selectedDebt]);

    // Comment 2: Clear paymentMethod if UPI is selected but receiver has no UPI ID
    useEffect(() => {
        if (selectedDebt && paymentMethod === 'upi') {
            const receiverProfile = getUserProfile(selectedDebt.to);
            const hasUpiId = !!receiverProfile?.upiId;
            if (!hasUpiId) {
                setPaymentMethod(null);
            }
        }
    }, [selectedDebt, paymentMethod, getUserProfile]);

    const handlePayClick = (debt) => {
        setSelectedDebt(debt);
        setExpandedDebtId(`${debt.from}-${debt.to}`);
        setPaymentMethod(null);
        setError(null); // Clear any previous errors when selecting a new debt
        setIsPending(false); // Reset pending state when selecting new debt
    };

    // Comment 3: Handler to go back to the full debt list
    const handleBackToList = () => {
        setExpandedDebtId(null);
        setSelectedDebt(null);
        setPaymentMethod(null);
        setIsPending(false);
        setError(null);
    };

    const handlePaymentMethodSelect = (method) => {
        setPaymentMethod(method);
    };

    const handleAmountChange = (e) => {
        const value = e.target.value;
        // Tighten regex to disallow lone decimal (Comment 4)
        if (value === '' || /^\d+(\.\d{0,2})?$/.test(value)) {
            setAmount(value);
        }
    };

    const validateForm = () => {
        const amountNum = parseFloat(amount);

        if (!selectedDebt) {
            toast({ title: 'Error', description: 'Please select a debt to settle', variant: 'destructive' });
            return false;
        }

        if (!paymentMethod) {
            toast({ title: 'Error', description: 'Please select a payment method', variant: 'destructive' });
            return false;
        }

        // Comment 2: Block UPI submissions when receiver lacks valid UPI ID
        if (paymentMethod === 'upi') {
            const receiverProfile = getUserProfile(selectedDebt.to);
            const hasUpiId = !!receiverProfile?.upiId;
            if (!hasUpiId) {
                toast({ title: 'Error', description: 'Receiver does not have a valid UPI ID. Please use cash payment.', variant: 'destructive' });
                return false;
            }
        }

        // Reject non-finite numbers including NaN (Comment 4)
        if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
            toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' });
            return false;
        }

        if (amountNum > selectedDebt.amount) {
            toast({ title: 'Error', description: 'Amount cannot exceed the owed amount', variant: 'destructive' });
            return false;
        }

        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setIsSubmitting(true);
        setError(null); // Clear previous errors on retry

        try {
            const payload = {
                groupId,
                fromUserId: selectedDebt.from,
                toUserId: selectedDebt.to,
                amount: parseFloat(amount),
                currency: 'INR',
                settledAt: date,
                paymentMethod: paymentMethod,
                // All settlements start as pending - receiver must confirm receipt
                paymentStatus: 'pending',
                paymentNotes: note,
            };

            const response = await apiClient.post('/settlements', payload);

            // Immediately update local state via GroupContext helper (resilient against socket lag)
            // This prevents duplicate settlements by using the API response instead of making another POST
            if (addSettlementLocally && response) {
                addSettlementLocally(response);
            }

            // Invalidate balance cache so balances recalculate on next access
            if (invalidateBalanceCache) {
                invalidateBalanceCache(groupId);
            }

            // Call parent callback to refresh balances and settlements
            if (onSettlementCreated) {
                onSettlementCreated();
            }

            // Both payment methods now follow the same pending confirmation flow
            // Set pending state to disable further submissions
            setIsPending(true);

            if (paymentMethod === 'upi') {
                // Show pending confirmation state - don't set showSuccess, don't auto-close
                toast({
                    title: 'UPI Payment Initiated',
                    description: `₹${parseFloat(amount).toFixed(2)} - Please complete the payment in your UPI app. The settlement will be confirmed once the receiver acknowledges it.`,
                    duration: 6000
                });

                // Only trigger UPI payment prompt if the current user is the payer
                // This prevents the UPI prompt for admin-recorded settlements on behalf of others
                if (onUpiPayNow && selectedDebt.from === currentUserId) {
                    const receiverProfile = getUserProfile(selectedDebt.to);
                    onUpiPayNow({
                        amount: parseFloat(amount),
                        receiverName: receiverProfile?.name || 'Unknown User',
                        receiverUpiId: receiverProfile?.upiId,
                        note: note || `Settlement - Split-It`
                    });
                } else if (selectedDebt.from !== currentUserId) {
                    // Show neutral toast for admin-recorded settlements
                    toast({
                        title: 'Settlement recorded',
                        description: 'The settlement is pending receiver confirmation.',
                        duration: 4000
                    });
                }

                // Keep modal open for UPI payments - user must manually close
                // No auto-close for pending payments
            } else {
                // For cash, show pending confirmation state similar to UPI
                // Cash settlements also require receiver confirmation before being finalized
                toast({
                    title: 'Cash Payment Recorded',
                    description: `₹${parseFloat(amount).toFixed(2)} - Pending receiver confirmation. The receiver will be notified to confirm receipt.`,
                    duration: 5000
                });

                // Keep modal open for cash payments too - same pending confirmation flow as UPI
                // User can manually close once they see the pending confirmation state
            }
        } catch (err) {
            console.error('Settlement creation failed:', err);

            // Set inline error state for user guidance
            const errorMessage = err.response?.data?.message || err.message || 'Failed to record settlement. Please check your connection and try again.';
            setError(errorMessage);

            // Keep toast for immediate feedback
            toast({
                title: 'Failed to record settlement',
                description: errorMessage,
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getAmountHelper = () => {
        if (!selectedDebt || !amount) return null;

        const amountNum = parseFloat(amount);
        const owedAmount = selectedDebt.amount;

        if (amountNum === owedAmount) {
            return <span className="text-success">Full amount: ₹{owedAmount.toFixed(2)}</span>;
        } else if (amountNum < owedAmount) {
            const remaining = owedAmount - amountNum;
            return <span className="text-warning">Partial payment - ₹{remaining.toFixed(2)} will remain</span>;
        }

        return null;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto mobile-scroll">
                <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">Record Settlement</DialogTitle>
                    <p className="text-sm text-muted-foreground">Record a payment you made to settle up</p>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    {/* Loading State */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3 sm:mb-4"></div>
                            <p className="text-sm text-muted-foreground">Loading settlements...</p>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && activeDebts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                            <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-success mb-3 sm:mb-4" />
                            <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">All Settled Up!</h3>
                            <p className="text-sm text-muted-foreground">No pending settlements in this group</p>
                        </div>
                    )}

                    {/* Debt Cards List - Only show selected card when expanded, otherwise show all */}
                    {!loading && activeDebts.length > 0 && activeDebts
                        .filter(debt => !expandedDebtId || expandedDebtId === `${debt.from}-${debt.to}`)
                        .map((debt) => (
                            <DebtorCard
                                key={`${debt.from}-${debt.to}`}
                                debt={debt}
                                getUserProfile={getUserProfile}
                                expandedDebtId={expandedDebtId}
                                isExpanded={expandedDebtId === `${debt.from}-${debt.to}`}
                                isSelected={selectedDebt && `${selectedDebt.from}-${selectedDebt.to}` === `${debt.from}-${debt.to}`}
                                onPayClick={handlePayClick}
                                onBackToList={handleBackToList}
                                paymentMethod={paymentMethod}
                                onPaymentMethodSelect={handlePaymentMethodSelect}
                                amount={amount}
                                onAmountChange={handleAmountChange}
                                date={date}
                                onDateChange={setDate}
                                note={note}
                                onNoteChange={setNote}
                                onSubmit={handleSubmit}
                                isSubmitting={isSubmitting}
                                showSuccess={showSuccess}
                                isPending={isPending}
                                amountHelper={getAmountHelper()}
                                isAdmin={isAdmin}
                                currentUserId={currentUserId}
                                error={error}
                            />
                        ))}
                </div>
            </DialogContent>
        </Dialog>
    );
};

// DebtorCard Component
const DebtorCard = ({
    debt,
    getUserProfile,
    expandedDebtId,
    isExpanded,
    isSelected,
    onPayClick,
    onBackToList,
    paymentMethod,
    onPaymentMethodSelect,
    amount,
    onAmountChange,
    date,
    onDateChange,
    note,
    onNoteChange,
    onSubmit,
    isSubmitting,
    showSuccess,
    isPending,
    amountHelper,
    isAdmin,
    currentUserId,
    error
}) => {
    const receiverProfile = getUserProfile(debt.to);
    const receiverName = receiverProfile?.name || 'Unknown User';
    const receiverInitial = receiverName.charAt(0).toUpperCase();
    const hasUpiId = !!receiverProfile?.upiId;

    // For admin view, also get payer information (Comment 2)
    const payerProfile = isAdmin ? getUserProfile(debt.from) : null;
    const payerName = payerProfile?.name || 'Unknown User';
    const isCurrentUserPayer = debt.from === currentUserId;

    return (
        <div
            className={`glass-card border-l-4 border-destructive p-4 sm:p-6 transition-all duration-300 animate-fade-in ${showSuccess && isSelected ? 'border-success' : ''} ${isPending && isSelected ? 'border-warning' : ''}`}
        >
            {/* Card Header */}
            <div className="flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-semibold ${showSuccess && isSelected ? 'bg-success' : isPending && isSelected ? 'bg-warning' : 'bg-destructive'
                        }`}>
                        {showSuccess && isSelected ? (
                            <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                        ) : isPending && isSelected ? (
                            <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
                        ) : (
                            receiverInitial
                        )}
                    </div>

                    {/* Name and Amount */}
                    <div className="flex-1 min-w-0">
                        {isAdmin ? (
                            <>
                                <h3 className="font-semibold text-base sm:text-lg truncate">
                                    {isCurrentUserPayer ? 'You' : payerName} owes {receiverName}
                                </h3>
                                <p className="text-xs sm:text-sm text-muted-foreground">Owes</p>
                            </>
                        ) : (
                            <>
                                <h3 className="font-semibold text-base sm:text-lg truncate">{receiverName}</h3>
                                <p className="text-xs sm:text-sm text-muted-foreground">You owe</p>
                            </>
                        )}
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                        <p className={`font-display font-bold text-xl sm:text-2xl ${showSuccess && isSelected ? 'text-success' : isPending && isSelected ? 'text-warning' : 'text-destructive'
                            }`}>
                            ₹{debt.amount.toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Comment 3: Back to list button when expanded */}
                {isExpanded && (
                    <button
                        onClick={onBackToList}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Back to list"
                        aria-label="Back to debt list"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Pay Button - Only show if not expanded */}
            {!isExpanded && (
                <Button
                    onClick={() => onPayClick(debt)}
                    className="w-full mt-4 min-h-[44px] sm:min-h-[48px]"
                    variant="default"
                >
                    Pay Now
                </Button>
            )}

            {/* Expanded Section */}
            {isExpanded && (
                <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6 animate-slide-up">
                    {/* Pending State Banner (for both Cash and UPI) */}
                    {isPending && (
                        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 sm:p-4 animate-fade-in">
                            <div className="flex items-start gap-3">
                                <Smartphone className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm text-warning mb-1">Awaiting Confirmation</h4>
                                    <p className="text-sm text-muted-foreground">The settlement has been recorded. The receiver will confirm once payment is received.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payment Method Selector - disabled when pending */}
                    {!isPending && (
                        <PaymentMethodSelector
                            selected={paymentMethod}
                            onSelect={onPaymentMethodSelect}
                            hasUpiId={hasUpiId}
                        />
                    )}

                    {/* Settlement Form */}
                    {paymentMethod && (
                        <SettlementForm
                            amount={amount}
                            onAmountChange={onAmountChange}
                            date={date}
                            onDateChange={onDateChange}
                            note={note}
                            onNoteChange={onNoteChange}
                            onSubmit={onSubmit}
                            isSubmitting={isSubmitting}
                            showSuccess={showSuccess}
                            isPending={isPending}
                            amountHelper={amountHelper}
                            error={error}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

// PaymentMethodSelector Component
const PaymentMethodSelector = ({ selected, onSelect, hasUpiId }) => {
    return (
        <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">Select Payment Method</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Cash Option */}
                <button
                    onClick={() => onSelect('cash')}
                    className={`glass-card-interactive min-h-[120px] p-4 flex flex-col items-center justify-center gap-2 transition-all relative ${selected === 'cash'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/30'
                        }`}
                    aria-label="Pay with Cash"
                >
                    <Wallet className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                    <span className="font-semibold">Cash</span>
                    <span className="text-xs text-muted-foreground text-center">Physical payment</span>
                    {selected === 'cash' && (
                        <CheckCircle className="w-5 h-5 text-primary absolute top-2 right-2" />
                    )}
                </button>

                {/* UPI Option */}
                <button
                    onClick={() => hasUpiId && onSelect('upi')}
                    className={`glass-card-interactive min-h-[120px] p-4 flex flex-col items-center justify-center gap-2 transition-all relative ${!hasUpiId
                        ? 'opacity-50 cursor-not-allowed'
                        : selected === 'upi'
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/30'
                        }`}
                    disabled={!hasUpiId}
                    aria-label="Pay with UPI"
                    title={!hasUpiId ? "Receiver hasn't set up UPI" : ''}
                >
                    <Smartphone className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                    <span className="font-semibold">UPI</span>
                    <span className="text-xs text-muted-foreground text-center">
                        {hasUpiId ? 'Digital payment' : 'Not available'}
                    </span>
                    {selected === 'upi' && hasUpiId && (
                        <CheckCircle className="w-5 h-5 text-primary absolute top-2 right-2" />
                    )}
                </button>
            </div>
        </div>
    );
};

// SettlementForm Component
const SettlementForm = ({
    amount,
    onAmountChange,
    date,
    onDateChange,
    note,
    onNoteChange,
    onSubmit,
    isSubmitting,
    showSuccess,
    isPending,
    amountHelper,
    error
}) => {
    // Disable inputs when pending or showing success
    const isDisabled = isSubmitting || showSuccess || isPending;
    return (
        <div className="space-y-4 animate-fade-in">
            {/* Amount Input */}
            <div>
                <label htmlFor="amount" className="block text-sm font-medium mb-2">
                    Amount
                </label>
                <Input
                    id="amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={onAmountChange}
                    placeholder="0.00"
                    className="text-lg"
                    disabled={isDisabled}
                    aria-describedby="amount-helper"
                />
                {amountHelper && (
                    <p id="amount-helper" className="text-xs mt-1">{amountHelper}</p>
                )}
            </div>

            {/* Date Picker */}
            <div>
                <label htmlFor="date" className="block text-sm font-medium mb-2">
                    Date
                </label>
                <div className="relative">
                    <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => onDateChange(e.target.value)}
                        disabled={isDisabled}
                        className="pr-10"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
            </div>

            {/* Note Textarea */}
            <div>
                <label htmlFor="note" className="block text-sm font-medium mb-2">
                    Note (optional)
                </label>
                <Textarea
                    id="note"
                    value={note}
                    onChange={(e) => onNoteChange(e.target.value)}
                    placeholder="Add a note (optional)"
                    maxLength={200}
                    rows={3}
                    disabled={isDisabled}
                />
                <p className="text-xs text-muted-foreground mt-1">{note.length}/200</p>
            </div>

            {/* Error Banner with Retry Action */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 sm:p-4 animate-fade-in">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-destructive mb-1">Settlement Failed</h4>
                            <p className="text-sm text-muted-foreground mb-3">{error}</p>
                            <Button
                                onClick={onSubmit}
                                variant="outline"
                                size="sm"
                                disabled={isSubmitting || !amount || !Number.isFinite(parseFloat(amount)) || parseFloat(amount) <= 0}
                                className="border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
                                        Retrying...
                                    </>
                                ) : (
                                    'Retry'
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Button - Always visible */}
            <Button
                onClick={onSubmit}
                disabled={isDisabled || !amount || !Number.isFinite(parseFloat(amount)) || parseFloat(amount) <= 0}
                className={`w-full min-h-[48px] text-base ${isPending ? 'bg-warning hover:bg-warning/90' : ''}`}
                variant="default"
            >
                {isSubmitting ? (
                    <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                        Processing...
                    </>
                ) : showSuccess ? (
                    <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Settled!
                    </>
                ) : isPending ? (
                    <>
                        <Smartphone className="w-5 h-5 mr-2" />
                        Awaiting confirmation
                    </>
                ) : (
                    `Confirm ₹${parseFloat(amount || 0).toFixed(2)} Payment`
                )}
            </Button>
        </div>
    );
};

export default RecordSettlementModal;
