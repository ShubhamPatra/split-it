import React, { memo, useState } from 'react';
import { ArrowRight, Trash2, Clock, Smartphone, CreditCard, CheckCircle, Building2, Wallet, XCircle, Check, X } from 'lucide-react';
import { useGroups } from '../../context/GroupContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/use-toast';
import UpiPaymentButton from './UpiPaymentButton';
import apiClient from '../../lib/apiClient';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { formatUpiIdForDisplay } from '../../utils/upiHelpers';

const SettlementCard = memo(({ settlement }) => {
  const { deleteSettlement, getUserProfile, refreshGroup } = useGroups();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDelete = () => { deleteSettlement(settlement.id); toast({ title: "Settlement deleted" }); };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await apiClient.post(`/settlements/${settlement.id}/confirm`);
      toast({ title: 'Payment confirmed!', description: 'The settlement has been marked as confirmed.' });
      if (settlement.groupId) refreshGroup(settlement.groupId);
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to confirm payment.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await apiClient.post(`/settlements/${settlement.id}/reject`, { reason: 'Payment not received' });
      toast({ title: 'Marked as not received', description: 'The payer has been notified.' });
      if (settlement.groupId) refreshGroup(settlement.groupId);
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to reject payment.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const receiver = getUserProfile(settlement.toUserId);
  const isPending = settlement.paymentStatus === 'pending';
  const isFailed = settlement.paymentStatus === 'failed';
  const isUpi = settlement.paymentMethod === 'upi';
  const isCurrentUserPayer = user?.id === settlement.fromUserId;
  const isCurrentUserReceiver = user?.id === settlement.toUserId;
  const upiDisplay = isUpi && receiver?.upiId ? formatUpiIdForDisplay(receiver.upiId) : null;

  const getPaymentMethodIcon = () => {
    switch (settlement.paymentMethod) {
      case 'upi': return <Smartphone size={12} />;
      case 'cash': return <Wallet size={12} />;
      case 'bank': return <Building2 size={12} />;
      case 'card': return <CreditCard size={12} />;
      default: return <CreditCard size={12} />;
    }
  };

  const getPaymentMethodLabel = () => {
    return settlement.paymentMethod?.toUpperCase() || 'CASH';
  };

  const getBorderColor = () => {
    if (isFailed) return 'border-destructive';
    if (isPending) return 'border-warning';
    return 'border-success';
  };

  const getIconBgColor = () => {
    if (isFailed) return 'bg-destructive/10';
    if (isPending) return 'bg-warning/10';
    return 'bg-success/10';
  };

  const getAmountColor = () => {
    if (isFailed) return 'text-destructive';
    if (isPending) return 'text-warning';
    return 'text-success';
  };

  const getStatusIcon = () => {
    if (isFailed) return <XCircle className="text-destructive" size={20} />;
    if (isPending) return <Clock className="text-warning" size={20} />;
    return <CheckCircle className="text-success" size={20} />;
  };

  const getStatusText = () => {
    if (isFailed) return 'Not Received';
    if (isPending) return 'Pending';
    return 'Settled';
  };

  return (
    <div className={`glass-card rounded p-3 sm:p-4 animate-slide-in border-l-4 ${getBorderColor()} group w-full`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className={`p-2.5 sm:p-3 rounded flex-shrink-0 ${getIconBgColor()}`}>
          {getStatusIcon()}
        </div>
        <div className="flex-1 min-w-0 w-full sm:w-auto">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm sm:text-base text-foreground truncate">{getUserProfile(settlement.fromUserId)?.name || 'User'}</span>
            <ArrowRight size={16} className="text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm sm:text-base text-foreground truncate">{getUserProfile(settlement.toUserId)?.name || 'User'}</span>
            <Badge variant="outline" className="text-[10px] sm:text-xs gap-1 flex-shrink-0">
              {getPaymentMethodIcon()}
              {getPaymentMethodLabel()}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs sm:text-sm text-muted-foreground">{new Date(settlement.settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            {isPending && <Badge variant="secondary" className="text-[10px] sm:text-xs bg-warning/10 text-warning border-warning/20">Pending Confirmation</Badge>}
            {isFailed && <Badge variant="secondary" className="text-[10px] sm:text-xs bg-destructive/10 text-destructive border-destructive/20">Not Received</Badge>}
            {settlement.transactionRef && (
              <Badge variant="ghost" className="text-[10px] sm:text-xs font-mono hidden sm:inline-flex">
                Ref: {settlement.transactionRef.substring(0, 12)}...
              </Badge>
            )}
          </div>
          {isPending && (
            <p className="text-xs text-muted-foreground italic mt-1">
              Waiting for {receiver?.name || 'receiver'} to confirm
            </p>
          )}
          {isFailed && (
            <p className="text-xs text-destructive/80 italic mt-1">
              {receiver?.name || 'Receiver'} reported payment not received
            </p>
          )}
          {isUpi && upiDisplay && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {upiDisplay}
            </p>
          )}
          {/* Confirm/Reject buttons for receiver when pending */}
          {isPending && isCurrentUserReceiver && (
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                className="h-9 text-xs min-h-[36px]"
                onClick={handleConfirm}
                disabled={isProcessing}
              >
                <Check size={14} className="mr-1" />
                {isProcessing ? 'Processing...' : 'Confirm Receipt'}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="h-9 text-xs min-h-[36px] text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
                onClick={handleReject}
                disabled={isProcessing}
              >
                <X size={14} className="mr-1" />
                Not Received
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-left sm:text-right">
            <p className={`font-display font-bold text-lg sm:text-xl whitespace-nowrap ${getAmountColor()}`}>₹{settlement.amount.toLocaleString()}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">{getStatusText()}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {(isPending || isFailed) && isUpi && receiver?.upiId && isCurrentUserPayer && (
              <UpiPaymentButton
                amount={settlement.amount}
                receiverName={receiver.name}
                receiverUpiId={receiver.upiId}
                note={`Settlement payment - ${settlement.groupId || 'Split-It'}`}
                onPaymentInitiated={(data) => {
                  toast({
                    title: 'Payment Initiated',
                    description: `Transaction: ${data.transactionRef}`
                  });
                }}
                variant="ghost"
                size="sm"
                className="min-h-[44px] min-w-[44px]"
              />
            )}
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
                  <AlertDialogTitle>Delete Settlement</AlertDialogTitle>
                  <AlertDialogDescription>Are you sure you want to delete this ₹{settlement.amount.toLocaleString()} settlement?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SettlementCard;

// Custom comparison to avoid unnecessary re-renders
SettlementCard.displayName = 'SettlementCard';
