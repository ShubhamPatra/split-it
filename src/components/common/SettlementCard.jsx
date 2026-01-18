import React, { memo } from 'react';
import { ArrowRight, Trash2, Clock, Smartphone, CreditCard, CheckCircle, Building2, Wallet } from 'lucide-react';
import { useGroups } from '../../context/GroupContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/use-toast';
import UpiPaymentButton from './UpiPaymentButton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { getUpiProviderIcon, formatUpiIdForDisplay } from '../../utils/upiHelpers';

const SettlementCard = memo(({ settlement }) => {
  const { deleteSettlement, getUserProfile } = useGroups();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleDelete = () => { deleteSettlement(settlement.id); toast({ title: "Settlement deleted" }); };

  const receiver = getUserProfile(settlement.toUserId);
  const isPending = settlement.paymentStatus === 'pending';
  const isUpi = settlement.paymentMethod === 'upi';
  const isCurrentUserPayer = user?.id === settlement.fromUserId;
  const providerIcon = isUpi && receiver?.upiId ? getUpiProviderIcon(receiver.upiId) : null;
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

  return (
    <div className={`glass-card rounded p-3 sm:p-4 animate-slide-in border-l-4 ${isPending ? 'border-warning' : 'border-success'} group w-full`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className={`p-2.5 sm:p-3 rounded flex-shrink-0 ${isPending ? 'bg-warning/10' : 'bg-success/10'}`}>
          {isPending ? <Clock className="text-warning" size={20} /> : <CheckCircle className="text-success" size={20} />}
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
          {isUpi && upiDisplay && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {upiDisplay}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-left sm:text-right">
            <p className={`font-display font-bold text-lg sm:text-xl whitespace-nowrap ${isPending ? 'text-warning' : 'text-success'}`}>₹{settlement.amount.toLocaleString()}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">{isPending ? 'Pending' : 'Settled'}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isPending && isUpi && receiver?.upiId && isCurrentUserPayer && (
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
