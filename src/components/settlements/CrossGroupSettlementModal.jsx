import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
    Download,
    Copy,
    Check,
} from 'lucide-react';
import DistributionPreview from './DistributionPreview';
import BalanceBadge from './BalanceBadge';
import { useSettlements } from '../../context/SettlementsContext';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import QRCode from 'qrcode';
import { generateUpiUrl, validateUpiId } from '../../utils/upiHelpers';
import { useToast } from '../../hooks/use-toast';
import { useIsMobile } from '../../hooks/use-mobile';

/**
 * Cross-Group Settlement Modal
 * Multi-step flow for creating cross-group settlements
 */
const CrossGroupSettlementModal = ({
    isOpen,
    onClose,
    person,
    personDetail: personDetailProp,
}) => {
    const { createCrossGroupSettlement, fetchPersonDetail, loading } = useSettlements();
    const { user } = useAuth();
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const canvasRef = useRef(null);

    // Form state
    const [step, setStep] = useState(1);
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [settledAt, setSettledAt] = useState(new Date().toISOString().split('T')[0]);
    const [paymentNotes, setPaymentNotes] = useState('');
    const [idempotencyKey, setIdempotencyKey] = useState('');
    const [copied, setCopied] = useState(false);

    // Distribution preview
    const [distributionPreview, setDistributionPreview] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Status
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Local person detail state (fetched if not provided as prop)
    const [localPersonDetail, setLocalPersonDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Use prop if provided, otherwise use locally fetched detail
    const personDetail = personDetailProp || localPersonDetail;

    const getInitials = (name) => {
        if (!name || typeof name !== 'string') return '?';
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const maxAmount = Math.abs(person?.netBalance || personDetail?.netBalance || 0);
    const isReceiverInitiated = (person?.netBalance || personDetail?.netBalance || 0) > 0; // Positive means they owe us
    const totalSteps = paymentMethod === 'upi' && !isReceiverInitiated ? 4 : 3; // Add QR step for UPI payer-initiated
    
    // Determine the actual receiver's UPI ID based on who is initiating
    // When receiver-initiated: current user is the receiver, use their UPI ID
    // When payer-initiated: other user is the receiver, use their UPI ID
    const receiverUpiId = isReceiverInitiated ? user?.upiId : personDetail?.otherUserUpiId;
    
    // Check for pending payments
    const hasPendingPayment = personDetail?.hasPendingPayment || false;
    const pendingAmount = Math.abs(personDetail?.pendingAmount || 0);
    const availableBalance = Math.abs(personDetail?.availableBalance || personDetail?.netBalance || 0);
    
    // Determine if user can make a payment
    const canMakePayment = !hasPendingPayment || (hasPendingPayment && availableBalance > 0.01);
    const maxAllowedAmount = hasPendingPayment ? availableBalance : maxAmount;

    // Generate QR code for UPI payments
    const generateQRCode = useCallback(async () => {
        if (!canvasRef.current || paymentMethod !== 'upi' || !receiverUpiId) return;

        const upiUrl = generateUpiUrl({
            receiverUpiId: receiverUpiId,
            receiverName: person?.name || personDetail?.otherUserName,
            amount: parseFloat(amount),
            note: `Cross-group settlement${paymentNotes ? ': ' + paymentNotes : ''}`,
            transactionId: idempotencyKey,
        });

        try {
            await QRCode.toCanvas(canvasRef.current, upiUrl, {
                width: 280,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff',
                },
                errorCorrectionLevel: 'M',
            });
        } catch (error) {
            console.error('QR generation failed:', error);
            toast({
                title: "QR Code Error",
                description: "Failed to generate QR code. Please try another payment method.",
                variant: "destructive"
            });
        }
    }, [paymentMethod, receiverUpiId, person, personDetail, amount, paymentNotes, idempotencyKey, toast]);

    // Generate idempotency key when modal opens
    useEffect(() => {
        if (isOpen && person?.userId) {
            // Generate unique idempotency key: timestamp + userId + random
            const key = `${Date.now()}-${person.userId}-${Math.random().toString(36).substring(7)}`;
            setIdempotencyKey(key);
            console.log('[CrossGroupSettlementModal] Generated idempotency key:', key);
            console.log('[CrossGroupSettlementModal] Modal opened for person:', person.userId, person.name);
        }
    }, [isOpen, person?.userId]);

    // Fetch person detail if not provided as prop
    useEffect(() => {
        const fetchDetail = async () => {
            if (isOpen && person?.userId && !personDetailProp) {
                setLoadingDetail(true);
                try {
                    // Always fetch fresh data to get latest pending payments
                    const detail = await fetchPersonDetail(person.userId);
                    setLocalPersonDetail(detail);
                    console.log('[CrossGroupSettlementModal] Fetched person detail:', {
                        hasPendingPayment: detail?.hasPendingPayment,
                        pendingAmount: detail?.pendingAmount,
                        availableBalance: detail?.availableBalance
                    });
                } catch (err) {
                    console.error('Error fetching person detail:', err);
                } finally {
                    setLoadingDetail(false);
                }
            }
        };
        fetchDetail();
    }, [isOpen, person?.userId, personDetailProp, fetchPersonDetail]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setAmount(maxAmount.toFixed(2)); // Always use full amount
            setPaymentMethod('cash');
            setSettledAt(new Date().toISOString().split('T')[0]);
            setPaymentNotes('');
            setDistributionPreview(null);
            setError(null);
            setSuccess(false);
            if (!personDetailProp) {
                setLocalPersonDetail(null);
            }
            // Don't reset idempotencyKey here - it's set in the other useEffect
        }
    }, [isOpen, maxAmount, personDetailProp]);

    // Fetch distribution preview when amount changes
    const fetchDistributionPreview = useCallback(async () => {
        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0 || !person?.userId) return;

        setLoadingPreview(true);
        try {
            // Use the person detail to build a preview
            // In a real scenario, you might call the API for this
            if (personDetail?.groupBreakdown) {
                const distributions = [];
                let remaining = numAmount;

                // Check for mixed directions
                const hasPositiveBalances = personDetail.groupBreakdown.some(g => g.balance > 0);
                const hasNegativeBalances = personDetail.groupBreakdown.some(g => g.balance < 0);
                const hasMixedDirections = hasPositiveBalances && hasNegativeBalances;

                // For receiver-initiated, we're recording payment from groups where they owe us (positive balance)
                // For payer-initiated, we're paying groups where we owe them (negative balance)
                const relevantGroups = isReceiverInitiated
                    ? [...personDetail.groupBreakdown].filter(g => g.balance > 0) // They owe us
                    : [...personDetail.groupBreakdown].filter(g => g.balance < 0); // We owe them

                // Distribute across groups (largest first)
                const sortedGroups = relevantGroups
                    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

                for (const group of sortedGroups) {
                    if (remaining <= 0.01) break;
                    const debtAmount = Math.abs(group.balance);
                    const settleAmount = Math.min(remaining, debtAmount);
                    distributions.push({
                        groupId: group.groupId,
                        groupName: group.groupName,
                        amount: Math.round(settleAmount * 100) / 100,
                        originalBalance: group.balance,
                        remainingBalance: Math.round((debtAmount - settleAmount) * 100) / 100,
                    });
                    remaining -= settleAmount;
                }

                setDistributionPreview({
                    distributions,
                    totalDistributed: Math.round((numAmount - remaining) * 100) / 100,
                    remainingDebt: Math.max(0, Math.round((maxAllowedAmount - numAmount) * 100) / 100),
                    isPartial: numAmount < maxAllowedAmount - 0.01,
                    hasMixedDirections,
                });
            }
        } catch (err) {
            console.error('Error fetching distribution preview:', err);
        } finally {
            setLoadingPreview(false);
        }
    }, [amount, person?.userId, personDetail, maxAllowedAmount, isReceiverInitiated]);

    useEffect(() => {
        if (step === 1 && isOpen) {
            const timer = setTimeout(fetchDistributionPreview, 300);
            return () => clearTimeout(timer);
        }
    }, [amount, step, isOpen, fetchDistributionPreview, isReceiverInitiated]);

    // Generate QR code when reaching step 3 (for UPI)
    useEffect(() => {
        if (step === 3 && paymentMethod === 'upi' && !isReceiverInitiated && isOpen) {
            setTimeout(generateQRCode, 100);
        }
    }, [step, paymentMethod, isReceiverInitiated, isOpen, generateQRCode]);

    const handleAmountChange = (e) => {
        const value = e.target.value;
        // Only allow valid number input
        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
            setAmount(value);
        }
    };

    const copyUpiId = async () => {
        try {
            await navigator.clipboard.writeText(receiverUpiId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast({ title: "UPI ID copied!" });
        } catch {
            toast({ title: "Failed to copy", variant: "destructive" });
        }
    };

    const downloadQRCode = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `cross-group-payment-${amount}.png`;
        link.href = canvasRef.current.toDataURL();
        link.click();
        toast({ title: "QR Code downloaded!" });
    };

    const handleContinue = () => {
        // For UPI payer-initiated, go to QR step (step 3) before confirmation (step 4)
        if (step === 2 && paymentMethod === 'upi' && !isReceiverInitiated) {
            setStep(3);
        } else if (step === 3 && paymentMethod === 'upi' && !isReceiverInitiated) {
            setStep(4); // Go to confirmation
        } else {
            setStep(step + 1);
        }
    };

    const handleSubmit = async () => {
        // Prevent duplicate submissions
        if (loading.settlement || success) {
            console.log('[CrossGroupSettlementModal] Submission already in progress or completed');
            return;
        }

        setError(null);

        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        // Enforce full amount settlement
        if (Math.abs(numAmount - maxAmount) > 0.01) {
            setError(`You must settle the full amount of ₹${maxAmount.toFixed(2)}`);
            return;
        }

        console.log('[CrossGroupSettlementModal] Submitting settlement with idempotency key:', idempotencyKey);

        try {
            await createCrossGroupSettlement({
                toUserId: person.userId,
                amount: numAmount,
                paymentMethod,
                settledAt,
                paymentNotes: paymentNotes.trim() || undefined,
                isReceiverInitiated, // Pass the flag to backend
                idempotencyKey, // Include idempotency key
            });
            setSuccess(true);
            // Auto-close modal after showing success message
            setTimeout(() => {
                handleClose();
            }, 2000);
        } catch (err) {
            // Display the actual error message from the backend
            const errorMessage = err.response?.data?.message || err.message || 'Failed to create settlement';
            console.error('Settlement creation error:', err);
            setError(errorMessage);
        }
    };

    const handleClose = () => {
        if (!loading.settlement) {
            // Reset success state when closing
            if (success) {
                setSuccess(false);
            }
            onClose();
        }
    };

    const renderStep1 = () => (
        <div className="space-y-4">
            {/* Pending Payment Warning - Block all payments */}
            {hasPendingPayment && !isReceiverInitiated && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        <strong>Cannot create a new payment.</strong><br />
                        You have a pending payment of ₹{pendingAmount.toFixed(2)} waiting for confirmation.
                        Please wait for {person?.name} to confirm or reject the pending payment before making another one.
                    </AlertDescription>
                </Alert>
            )}

            {/* Block payment if pending exists */}
            {hasPendingPayment && !isReceiverInitiated && (
                <div className="p-4 bg-muted rounded-lg border-2 border-dashed">
                    <p className="text-center text-muted-foreground">
                        Settlement creation is disabled until the pending payment is resolved.
                    </p>
                </div>
            )}

            {/* Recipient Info */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Avatar className="h-10 w-10">
                    <AvatarFallback className={cn(
                        "text-white",
                        isReceiverInitiated
                            ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                            : "bg-gradient-to-br from-red-500 to-red-600"
                    )}>
                        {getInitials(person?.name)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <p className="font-medium">{person?.name}</p>
                    <p className="text-sm text-muted-foreground">
                        {isReceiverInitiated ? 'They owe you' : 'You owe them'}: <BalanceBadge amount={Math.abs(person?.netBalance || 0)} showSign={false} size="sm" />
                    </p>
                </div>
            </div>

            {/* Amount Display (Read-only, always full amount) */}
            {!hasPendingPayment || isReceiverInitiated ? (
                <div className="space-y-2">
                    <Label htmlFor="amount">Settlement Amount (Full Balance)</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                        <Input
                            id="amount"
                            type="text"
                            value={amount}
                            readOnly
                            className="pl-8 text-lg font-semibold bg-muted cursor-not-allowed"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Full balance will be settled. Partial payments are not allowed.
                    </p>
                </div>
            ) : null}

            {/* Distribution Preview */}
            {loadingPreview ? (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="animate-spin text-muted-foreground" />
                </div>
            ) : distributionPreview && distributionPreview.distributions?.length > 0 ? (
                <DistributionPreview
                    distributions={distributionPreview.distributions}
                    totalAmount={distributionPreview.totalDistributed}
                    remainingDebt={0}
                />
            ) : null}

            {/* Mixed Direction Warning */}
            {distributionPreview?.hasMixedDirections && (
                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-sm text-amber-800 dark:text-amber-300">
                        You have balances in both directions across different groups. This settlement will prioritize clearing debts where you owe money first.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );

    const renderStep2 = () => {
        const hasUpiId = !!receiverUpiId;

        return (
            <div className="space-y-4">
                {/* Payment Method */}
                <div className="space-y-2">
                    <Label>Payment Method</Label>
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
                            title={!hasUpiId ? (isReceiverInitiated ? "You haven't set up UPI" : "Receiver hasn't set up UPI") : ''}
                        >
                            <CreditCard size={24} className={paymentMethod === 'upi' ? 'text-primary' : 'text-muted-foreground'} />
                            <span className="font-medium">UPI</span>
                        </button>
                    </div>
                    {!hasUpiId && (
                        <p className="text-sm text-muted-foreground mt-2">
                            {isReceiverInitiated 
                                ? "UPI payment is not available. You haven't set up your UPI ID yet."
                                : `UPI payment is not available. ${person?.name} hasn't set up their UPI ID yet.`
                            }
                        </p>
                    )}
                </div>

                {/* Date */}
                <div className="space-y-2">
                    <Label htmlFor="date">Settlement Date</Label>
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
                    <Label htmlFor="notes">Notes (Optional)</Label>
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
        // For UPI payer-initiated, this is the QR code step
        if (paymentMethod === 'upi' && !isReceiverInitiated) {
            const upiValidation = validateUpiId(receiverUpiId);

            return (
                <div className="space-y-4">
                    <h3 className="font-semibold text-center">Scan QR Code to Pay</h3>

                    {/* QR Code Display */}
                    <div className="flex flex-col items-center space-y-4 py-4">
                        <div className="p-4 bg-white rounded border border-border">
                            <canvas ref={canvasRef} className="max-w-full h-auto" />
                        </div>

                        {/* Payment Info Card */}
                        <div className="w-full space-y-3">
                            <div className="p-4 bg-primary/10 rounded border border-primary/20">
                                <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
                                <p className="font-display text-3xl font-bold text-primary">
                                    ₹{parseFloat(amount).toFixed(2)}
                                </p>
                                {idempotencyKey && (
                                    <p className="text-xs text-muted-foreground mt-2 font-mono">
                                        Ref: {idempotencyKey.substring(0, 20)}...
                                    </p>
                                )}
                            </div>

                            <div className="p-4 bg-secondary rounded border border-border">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-muted-foreground">Pay to</p>
                                    {upiValidation.provider && (
                                        <Badge variant="outline" className="text-xs">
                                            {upiValidation.provider}
                                        </Badge>
                                    )}
                                </div>
                                <p className="font-semibold text-lg">{person?.name}</p>
                                <div className="flex items-center justify-between gap-2 mt-2">
                                    <p className="text-sm font-mono text-muted-foreground break-all flex-1">
                                        {receiverUpiId}
                                    </p>
                                    <Button variant="ghost" size="sm" onClick={copyUpiId}>
                                        {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                                    </Button>
                                </div>
                                {upiValidation.bank && (
                                    <p className="text-xs text-muted-foreground mt-1">{upiValidation.bank}</p>
                                )}
                            </div>

                            <div className="p-3 bg-info/10 rounded border border-info/20">
                                <p className="text-xs text-info flex items-center gap-2">
                                    <AlertCircle size={14} />
                                    Open any UPI app on your device and scan this QR code
                                </p>
                            </div>
                        </div>

                        <Button onClick={downloadQRCode} variant="outline" size="sm" className="w-full">
                            <Download size={16} className="mr-2" />
                            Download QR Code
                        </Button>
                    </div>
                </div>
            );
        }

        // For cash or receiver-initiated, this is the confirmation step
        return renderConfirmation();
    };

    const renderStep4 = () => {
        // This is only for UPI payer-initiated - the confirmation step
        return renderConfirmation();
    };

    const renderConfirmation = () => (
        <div className="space-y-4">
            <h3 className="font-semibold text-center">Confirm Settlement</h3>

            {/* Summary Card */}
            <div className="p-4 rounded-xl bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                        {isReceiverInitiated ? 'Recording Payment' : 'Paying'}
                    </span>
                    <span className="font-bold text-lg">₹{parseFloat(amount).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                        {isReceiverInitiated ? 'From' : 'To'}
                    </span>
                    <span className="font-medium">{person?.name}</span>
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

            {/* Distribution Summary */}
            {distributionPreview?.distributions?.length > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                    This will settle the full balance across {distributionPreview.distributions.length} group{distributionPreview.distributions.length > 1 ? 's' : ''}
                </div>
            )}
        </div>
    );

    const renderSuccess = () => (
        <div className="text-center py-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={32} />
            </div>
            <div>
                <h3 className="font-semibold text-lg">
                    {isReceiverInitiated ? 'Payment Recorded!' : 'Settlement Recorded!'}
                </h3>
                <p className="text-muted-foreground mt-1">
                    {isReceiverInitiated
                        ? `Full payment of ₹${parseFloat(amount).toFixed(2)} from ${person?.name} has been recorded.`
                        : `Your full payment of ₹${parseFloat(amount).toFixed(2)} to ${person?.name} has been recorded.`
                    }
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
                            {step === 1 && (isReceiverInitiated ? 'Record Payment Received' : 'Settlement Amount')}
                            {step === 2 && 'Payment Details'}
                            {step === 3 && paymentMethod === 'upi' && !isReceiverInitiated && 'Scan QR Code'}
                            {step === 3 && (paymentMethod === 'cash' || isReceiverInitiated) && 'Review & Confirm'}
                            {step === 4 && 'Review & Confirm'}
                        </DialogTitle>
                        {/* Step indicator */}
                        <div className="flex gap-2 pt-2">
                            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                                <div
                                    key={s}
                                    className={cn(
                                        'h-1 flex-1 rounded-full transition-colors',
                                        s <= step ? 'bg-primary' : 'bg-muted'
                                    )}
                                />
                            ))}
                        </div>
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
                            {step === 4 && renderStep4()}

                            {error && (
                                <Alert variant="destructive" className="mt-4">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            {/* Navigation Buttons */}
                            <div className="flex gap-3 mt-6">
                                {step > 1 && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep(step - 1)}
                                        disabled={loading.settlement}
                                    >
                                        Back
                                    </Button>
                                )}
                                {step === 1 && (
                                    <Button variant="outline" onClick={handleClose} className="flex-1">
                                        Cancel
                                    </Button>
                                )}
                                {step < totalSteps && (
                                    <Button
                                        onClick={handleContinue}
                                        disabled={!amount || parseFloat(amount) <= 0 || !canMakePayment}
                                        className="flex-1"
                                    >
                                        Continue
                                        <ArrowRight size={16} className="ml-2" />
                                    </Button>
                                )}
                                {step === totalSteps && (
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={loading.settlement}
                                        className="flex-1"
                                    >
                                        {loading.settlement ? (
                                            <>
                                                <Loader2 className="animate-spin mr-2" size={16} />
                                                Processing...
                                            </>
                                        ) : isReceiverInitiated ? (
                                            'Record Payment'
                                        ) : (
                                            'Confirm Settlement'
                                        )}
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CrossGroupSettlementModal;
