import React, { useState } from 'react';
import { X, Send, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { useSettlements } from '../../context/SettlementsContext';
import { toast } from '../../hooks/use-toast';

// Simple Radio Button Component
const RadioButton = ({ id, value, checked, onChange, children, disabled }) => (
    <div className="flex items-center space-x-2">
        <input
            type="radio"
            id={id}
            value={value}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="h-4 w-4 text-primary focus:ring-primary"
        />
        <Label htmlFor={id} className="flex-1 cursor-pointer">
            {children}
        </Label>
    </div>
);

/**
 * Simplified Repayment Request Modal (Comment 2)
 * Removed multi-step wizard - now a single-step form for quick requests
 */
const RepaymentRequestModal = ({ isOpen, onClose, receiver, amount, groups, onSuccess }) => {
    const { createRepaymentRequest, loading } = useSettlements();
    const [amountType, setAmountType] = useState('full');
    const [customAmount, setCustomAmount] = useState('');
    const [message, setMessage] = useState('');
    const [messageExpanded, setMessageExpanded] = useState(false);

    const finalAmount = amountType === 'full' ? amount : parseFloat(customAmount) || 0;

    const resetForm = () => {
        setAmountType('full');
        setCustomAmount('');
        setMessage('');
        setMessageExpanded(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async () => {
        // Validate amount
        if (amountType === 'partial' && (!customAmount || parseFloat(customAmount) <= 0 || parseFloat(customAmount) > amount)) {
            toast({
                title: 'Invalid Amount',
                description: 'Please enter a valid amount',
                variant: 'destructive',
            });
            return;
        }

        try {
            const relatedGroups = groups.map(g => g.groupId);
            const groupBreakdown = groups.map(g => ({
                groupId: g.groupId,
                amount: (finalAmount * g.amount) / amount, // Proportional distribution
                originalBalance: g.amount
            }));

            await createRepaymentRequest(
                receiver._id,
                finalAmount,
                message.trim() || undefined,
                relatedGroups,
                groupBreakdown
            );

            toast({
                title: 'Success',
                description: 'Repayment request sent successfully!',
            });
            onSuccess?.();
            handleClose();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to send repayment request',
                variant: 'destructive',
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Request Repayment</span>
                        <Button variant="ghost" size="sm" onClick={handleClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Recipient Info */}
                    <div className="text-center pb-2">
                        <p className="text-sm text-muted-foreground mb-1">Requesting from</p>
                        <p className="text-lg font-semibold">{receiver.name}</p>
                    </div>

                    <Separator />

                    {/* Amount Selection */}
                    <div className="space-y-4">
                        <h3 className="font-medium">Select Amount</h3>
                        
                        <RadioButton
                            id="full"
                            value="full"
                            checked={amountType === 'full'}
                            onChange={() => setAmountType('full')}
                        >
                            <div className="flex justify-between items-center">
                                <span className="font-medium">Full Amount</span>
                                <span className="text-lg font-bold text-emerald-600">₹{amount.toFixed(2)}</span>
                            </div>
                        </RadioButton>

                        <RadioButton
                            id="partial"
                            value="partial"
                            checked={amountType === 'partial'}
                            onChange={() => setAmountType('partial')}
                        >
                            <div className="space-y-3">
                                <div className="font-medium">Partial Amount</div>
                                <Input
                                    type="number"
                                    placeholder="Enter amount"
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value)}
                                    disabled={amountType !== 'partial'}
                                    min="0.01"
                                    max={amount}
                                    step="0.01"
                                    className="w-32"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Maximum: ₹{amount.toFixed(2)}
                                </p>
                            </div>
                        </RadioButton>
                    </div>

                    {/* Group Breakdown Preview */}
                    <div>
                        <h4 className="font-medium text-sm mb-2">Group Breakdown</h4>
                        <Card>
                            <CardContent className="p-4">
                                <div className="space-y-2">
                                    {groups.map((group) => {
                                        const groupAmount = amountType === 'full' 
                                            ? group.amount 
                                            : (finalAmount * group.amount) / amount;
                                        return (
                                            <div key={group.groupId} className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">{group.groupName}</span>
                                                <span className="font-medium">₹{groupAmount.toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                    <Separator />
                                    <div className="flex justify-between font-medium">
                                        <span>Total</span>
                                        <span className="text-emerald-600">₹{finalAmount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Optional Message - Collapsible */}
                    <Collapsible open={messageExpanded} onOpenChange={setMessageExpanded}>
                        <CollapsibleTrigger asChild>
                            <Button variant="outline" className="w-full justify-between" type="button">
                                <span>Add message (optional)</span>
                                <ChevronDown className={`h-4 w-4 transition-transform ${messageExpanded ? 'rotate-180' : ''}`} />
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                            <Textarea
                                placeholder="Add a friendly note (optional)"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                maxLength={500}
                                rows={3}
                                className="resize-none"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                {message.length}/500 characters
                            </p>
                        </CollapsibleContent>
                    </Collapsible>

                    {/* Notification Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                        <p className="text-blue-800 font-medium mb-1">What happens next:</p>
                        <ul className="text-blue-700 space-y-1 text-xs">
                            <li>• {receiver.name} will receive an in-app notification</li>
                            <li>• An email will be sent to {receiver.email}</li>
                            <li>• They can view and settle the request directly</li>
                        </ul>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={handleClose} disabled={loading.repaymentRequest}>
                        Cancel
                    </Button>
                    
                    <Button 
                        onClick={handleSubmit} 
                        disabled={loading.repaymentRequest || (amountType === 'partial' && (!customAmount || parseFloat(customAmount) <= 0))}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        <Send className="h-4 w-4 mr-2" />
                        {loading.repaymentRequest ? 'Sending...' : 'Send Request'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default RepaymentRequestModal;
