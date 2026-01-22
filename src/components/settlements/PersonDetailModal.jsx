import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Alert, AlertDescription } from '../ui/alert';
import { Users, ArrowRight, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import BalanceBadge from './BalanceBadge';
import { useSettlements } from '../../context/SettlementsContext';
import { cn } from '../../lib/utils';

/**
 * Person Detail Modal
 * Shows detailed breakdown of balance with a person across groups
 */
const PersonDetailModal = ({
    isOpen,
    onClose,
    person,
    onSettle,
}) => {
    const { fetchPersonDetail, loading } = useSettlements();
    const [personDetail, setPersonDetail] = useState(null);

    const getInitials = (name) => {
        if (!name || typeof name !== 'string') return '?';
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const loadPersonDetail = async () => {
        if (!person?.userId) return;
        const detail = await fetchPersonDetail(person.userId);
        setPersonDetail(detail);
    };

    useEffect(() => {
        if (isOpen && person?.userId) {
            loadPersonDetail();
        } else {
            setPersonDetail(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, person?.userId]);

    const isPositive = (person?.netBalance || personDetail?.netBalance || 0) > 0;

    const handleSettle = () => {
        onClose();
        onSettle?.(person, personDetail);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <Avatar className={cn(
                            'h-10 w-10 ring-2',
                            isPositive ? 'ring-emerald-500/30' : 'ring-red-500/30'
                        )}>
                            <AvatarFallback className={cn(
                                'text-white font-semibold',
                                isPositive
                                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                                    : 'bg-gradient-to-br from-red-500 to-red-600'
                            )}>
                                {getInitials(person?.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <span className="block">{person?.name || 'Loading...'}</span>
                            <span className="text-sm font-normal text-muted-foreground">
                                {person?.email}
                            </span>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Net Balance Summary */}
                    <div className={cn(
                        'p-4 rounded-xl border-2',
                        isPositive
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                    )}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {isPositive ? (
                                    <TrendingUp className="text-emerald-600 dark:text-emerald-400" size={20} />
                                ) : (
                                    <TrendingDown className="text-red-600 dark:text-red-400" size={20} />
                                )}
                                <span className="font-medium">
                                    {isPositive ? 'They owe you' : 'You owe them'}
                                </span>
                            </div>
                            <BalanceBadge
                                amount={person?.netBalance || 0}
                                size="xl"
                                showSign={false}
                            />
                        </div>
                        {personDetail?.sharedGroups > 0 && (
                            <p className="text-sm text-muted-foreground mt-2">
                                Across {personDetail.sharedGroups} shared group{personDetail.sharedGroups > 1 ? 's' : ''}
                            </p>
                        )}
                    </div>

                    {/* Group Breakdown */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Users size={14} />
                            Balance by Group
                        </h4>

                        {/* Mixed Direction Warning */}
                        {personDetail?.hasMixedDirections && (
                            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                <AlertDescription className="text-sm text-amber-800 dark:text-amber-300">
                                    {personDetail.mixedDirectionWarning || 'You have balances in both directions. Settling the net amount may not clear all group debts.'}
                                </AlertDescription>
                            </Alert>
                        )}

                        {loading.personDetail ? (
                            <div className="space-y-2">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        ) : personDetail?.groupBreakdown?.length > 0 ? (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {personDetail.groupBreakdown.map((group) => (
                                    <div
                                        key={group.groupId}
                                        className={cn(
                                            'p-3 rounded-lg border transition-colors',
                                            'bg-card hover:bg-accent/30',
                                            'border-l-4',
                                            group.balance > 0
                                                ? 'border-l-emerald-500'
                                                : 'border-l-red-500'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium">{group.groupName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {group.members} members
                                                </p>
                                            </div>
                                            <BalanceBadge
                                                amount={group.balance}
                                                showSign={false}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No group breakdown available
                            </p>
                        )}
                    </div>

                    {/* Settlement Suggestion */}
                    {personDetail?.settlementSuggestion && Math.abs(personDetail.settlementSuggestion.amount) > 0.01 && (
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                            <h4 className="text-sm font-semibold mb-2">Settlement Suggestion</h4>
                            <div className="flex items-center gap-2 text-sm">
                                {personDetail.settlementSuggestion.direction === 'youOweThem' ? (
                                    <>
                                        <span>Pay</span>
                                        <span className="font-bold">
                                            ₹{personDetail.settlementSuggestion.amount.toLocaleString('en-IN')}
                                        </span>
                                        <ArrowRight size={16} />
                                        <span>{person?.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Request</span>
                                        <span className="font-bold">
                                            ₹{personDetail.settlementSuggestion.amount.toLocaleString('en-IN')}
                                        </span>
                                        <span>from {person?.name}</span>
                                    </>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                This will settle balances across {personDetail.settlementSuggestion.affectedGroups} group{personDetail.settlementSuggestion.affectedGroups > 1 ? 's' : ''}
                            </p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Close
                    </Button>
                    {!isPositive && (
                        <Button onClick={handleSettle} className="flex-1">
                            Pay Now
                        </Button>
                    )}
                    {isPositive && (
                        <Button onClick={handleSettle} className="flex-1">
                            Record Payment Received
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PersonDetailModal;
