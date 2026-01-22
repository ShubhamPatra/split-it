import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Search, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '../ui/collapsible';
import BalanceBadge from './BalanceBadge';
import RepaymentRequestModal from './RepaymentRequestModal';
import { cn } from '../../lib/utils';
import { useSettlements } from '../../context/SettlementsContext';
import { useToast } from '../../hooks/use-toast';

/**
 * Group Settlement View
 * Displays list of groups with balances and settlement options
 */
const GroupSettlementView = ({
    groups = [],
    loading = false,
    onSettleInGroup,
    currentUserId,
}) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroupId, setExpandedGroupId] = useState(null);
    const [requestModalData, setRequestModalData] = useState(null);
    const [processingMarkPaid, setProcessingMarkPaid] = useState(new Set());
    
    const { createCrossGroupSettlement, fetchGroupBalances } = useSettlements();
    const { toast } = useToast();

    const handleRequest = (group, member, amount) => {
        // Open repayment request modal for this specific member
        setRequestModalData({
            receiver: {
                _id: member.userId,
                name: member.name,
                email: member.email,
            },
            amount: amount,
            groups: [{
                groupId: group.groupId,
                groupName: group.groupName,
                amount: amount,
            }],
        });
    };

    const handleMarkPaid = async (group, member, amount) => {
        // Mark payment as received from this member
        const memberId = member.userId;
        
        if (processingMarkPaid.has(memberId)) {
            toast({
                title: 'Processing',
                description: 'Please wait, payment is being processed...',
                variant: 'default',
            });
            return;
        }

        try {
            setProcessingMarkPaid(prev => new Set(prev).add(memberId));

            const idempotencyKey = `mark-paid-group-${group.groupId}-${memberId}-${Date.now()}`;
            
            await createCrossGroupSettlement({
                toUserId: memberId,
                amount: amount,
                isReceiverInitiated: true,
                paymentMethod: 'cash',
                paymentStatus: 'confirmed',
                paymentNotes: `Payment received in ${group.groupName}`,
                idempotencyKey
            });

            toast({
                title: 'Payment recorded',
                description: `Marked ₹${amount.toFixed(2)} as received from ${member.name}`,
            });

            // Refresh group balances
            await fetchGroupBalances();
        } catch (error) {
            console.error('Error marking payment as paid:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to mark payment as paid',
                variant: 'destructive',
            });
        } finally {
            setProcessingMarkPaid(prev => {
                const next = new Set(prev);
                next.delete(memberId);
                return next;
            });
        }
    };

    // Filter groups by search
    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return groups;
        const query = searchQuery.toLowerCase();
        return groups.filter(g =>
            g.groupName.toLowerCase().includes(query)
        );
    }, [groups, searchQuery]);

    // Sort: groups with balances first
    const sortedGroups = useMemo(() => {
        return [...filteredGroups].sort((a, b) => {
            const aHasBalance = a.userOwes > 0.01 || a.userIsOwed > 0.01;
            const bHasBalance = b.userOwes > 0.01 || b.userIsOwed > 0.01;
            if (aHasBalance && !bHasBalance) return -1;
            if (!aHasBalance && bHasBalance) return 1;
            return (b.userOwes + b.userIsOwed) - (a.userOwes + a.userIsOwed);
        });
    }, [filteredGroups]);

    const getInitials = (name) => {
        if (!name || typeof name !== 'string') return '?';
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const handleToggleExpand = (groupId) => {
        setExpandedGroupId(expandedGroupId === groupId ? null : groupId);
    };

    const handleViewGroup = (groupId) => {
        navigate(`/group/${groupId}`);
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    if (groups.length === 0) {
        return (
            <Card className="border-border shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                        <Users className="text-muted-foreground" size={40} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Groups Found</h3>
                    <p className="text-muted-foreground max-w-sm">
                        You're not part of any groups yet. Create or join a group to start tracking expenses.
                    </p>
                    <Button onClick={() => navigate('/groups')} className="mt-4 min-h-[44px]">
                        Go to Groups
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const groupsWithBalances = groups.filter(g => g.userOwes > 0.01 || g.userIsOwed > 0.01);

    if (groupsWithBalances.length === 0) {
        return (
            <div className="space-y-4 animate-fade-in">
                {/* All Settled Message */}
                <Card className="border-success/20 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center bg-success/5">
                        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                            <CheckCircle2 className="text-success" size={32} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">All Groups Settled!</h3>
                        <p className="text-muted-foreground max-w-sm">
                            Great job! You don't have any pending balances in any of your groups.
                        </p>
                    </CardContent>
                </Card>

                {/* Show all groups anyway */}
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">All Groups ({groups.length})</p>
                    {groups.map((group, index) => (
                        <div
                            key={group.groupId}
                            className="animate-fade-in"
                            style={{ animationDelay: `${0.03 * index}s` }}
                        >
                            <GroupCard
                                group={group}
                                isExpanded={false}
                                onToggle={() => { }}
                                onView={() => handleViewGroup(group.groupId)}
                                onRequest={handleRequest}
                                onMarkPaid={handleMarkPaid}
                                isProcessingMarkPaid={(memberId) => processingMarkPaid.has(memberId)}
                                getInitials={getInitials}
                                currentUserId={currentUserId}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                    type="text"
                    placeholder="Search groups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
            </div>

            {/* Groups List */}
            <div className="space-y-3">
                {sortedGroups.map((group, index) => (
                    <div
                        key={group.groupId}
                        className="animate-fade-in"
                        style={{ animationDelay: `${0.03 * index}s` }}
                    >
                        <GroupCard
                            group={group}
                            isExpanded={expandedGroupId === group.groupId}
                            onToggle={() => handleToggleExpand(group.groupId)}
                            onView={() => handleViewGroup(group.groupId)}
                            onSettle={onSettleInGroup}
                            onRequest={handleRequest}
                            onMarkPaid={handleMarkPaid}
                            isProcessingMarkPaid={(memberId) => processingMarkPaid.has(memberId)}
                            getInitials={getInitials}
                            currentUserId={currentUserId}
                        />
                    </div>
                ))}
            </div>

            {filteredGroups.length === 0 && searchQuery && (
                <p className="text-center text-muted-foreground py-8">
                    No groups found matching "{searchQuery}"
                </p>
            )}

            {/* Repayment Request Modal */}
            {requestModalData && (
                <RepaymentRequestModal
                    isOpen={!!requestModalData}
                    onClose={() => setRequestModalData(null)}
                    receiver={requestModalData.receiver}
                    amount={requestModalData.amount}
                    groups={requestModalData.groups}
                    onSuccess={async () => {
                        setRequestModalData(null);
                        await fetchGroupBalances();
                        toast({
                            title: 'Request sent',
                            description: 'Repayment request has been sent successfully.',
                        });
                    }}
                />
            )}
        </div>
    );
};

/**
 * Group Card Component
 */
const GroupCard = ({
    group,
    isExpanded,
    onToggle,
    onView,
    onSettle,
    getInitials,
    currentUserId,
    onRequest,
    onMarkPaid,
    isProcessingMarkPaid,
}) => {
    const hasBalance = group.userOwes > 0.01 || group.userIsOwed > 0.01;
    const netBalance = group.userIsOwed - group.userOwes;

    return (
        <Collapsible open={isExpanded} onOpenChange={onToggle}>
            <div
                className={cn(
                    'rounded-xl border transition-all shadow-sm hover:shadow-md',
                    'bg-card border-border hover:border-primary/20',
                    hasBalance && 'border-l-4',
                    hasBalance && (netBalance >= 0
                        ? 'border-l-success'
                        : 'border-l-destructive'),
                )}
            >
                <CollapsibleTrigger asChild>
                    <div className="p-4 cursor-pointer hover:bg-accent/30 transition-colors duration-150 rounded-xl">
                        <div className="flex items-center gap-3">
                            {/* Group Icon */}
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                                <Users size={24} className="text-primary" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground truncate">{group.groupName}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{group.membersCount} members</span>
                                    {group.totalExpenses > 0 && (
                                        <>
                                            <span>•</span>
                                            <span>₹{group.totalExpenses.toLocaleString('en-IN')}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Balance */}
                            <div className="text-right flex-shrink-0">
                                {hasBalance ? (
                                    <>
                                        {group.userOwes > 0.01 && (
                                            <p className="text-sm">
                                                <span className="text-muted-foreground">Owe </span>
                                                <span className="font-semibold text-destructive">
                                                    ₹{group.userOwes.toLocaleString('en-IN')}
                                                </span>
                                            </p>
                                        )}
                                        {group.userIsOwed > 0.01 && (
                                            <p className="text-sm">
                                                <span className="text-muted-foreground">Owed </span>
                                                <span className="font-semibold text-success">
                                                    ₹{group.userIsOwed.toLocaleString('en-IN')}
                                                </span>
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <Badge variant="secondary" className="text-xs">Settled</Badge>
                                )}
                            </div>

                            {/* Expand Icon */}
                            <div className="text-muted-foreground">
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                        </div>
                    </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border/50">
                        {/* Show what current user owes */}
                        {hasBalance && group.userOwes > 0.01 && group.suggestions && (
                            <div className="space-y-2 pt-3">
                                <p className="text-sm font-medium text-muted-foreground">You Owe</p>
                                {group.suggestions
                                    .filter(suggestion => suggestion.from?.toString() === currentUserId?.toString())
                                    .map((suggestion, idx) => {
                                        const toMember = group.members?.find(m => m.userId === suggestion.to);
                                        
                                        return (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="text-xs bg-destructive text-white">
                                                            {getInitials(toMember?.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm font-medium">
                                                        {toMember?.name || 'Unknown'}
                                                    </span>
                                                </div>
                                                <span className="text-sm font-bold text-destructive">
                                                    ₹{suggestion.amount.toFixed(2)}
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}

                        {/* Show what current user is owed */}
                        {hasBalance && group.userIsOwed > 0.01 && group.suggestions && (
                            <div className="space-y-2 pt-3">
                                <p className="text-sm font-medium text-muted-foreground">You're Owed</p>
                                {group.suggestions
                                    .filter(suggestion => suggestion.to?.toString() === currentUserId?.toString())
                                    .map((suggestion, idx) => {
                                        const fromMember = group.members?.find(m => m.userId === suggestion.from);
                                        
                                        return (
                                            <div
                                                key={idx}
                                                className="space-y-2"
                                            >
                                                <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarFallback className="text-xs bg-success text-white">
                                                                {getInitials(fromMember?.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm font-medium">
                                                            {fromMember?.name || 'Unknown'}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm font-bold text-success">
                                                        ₹{suggestion.amount.toFixed(2)}
                                                    </span>
                                                </div>
                                                {/* Action buttons for this specific member */}
                                                <div className="grid grid-cols-2 gap-2 pl-10">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onRequest?.(group, fromMember, suggestion.amount);
                                                        }}
                                                        className="min-h-[40px] text-xs"
                                                    >
                                                        Request
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onMarkPaid?.(group, fromMember, suggestion.amount);
                                                        }}
                                                        disabled={isProcessingMarkPaid?.(fromMember?.userId)}
                                                        className="min-h-[40px] text-xs"
                                                    >
                                                        {isProcessingMarkPaid?.(fromMember?.userId) ? 'Processing...' : 'Mark Paid'}
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                        
                        {/* Actions - Only show settle button if user owes money */}
                        {hasBalance && group.userOwes > 0.01 && (
                            <div className="pt-2">
                                <Button
                                    size="sm"
                                    onClick={() => onSettle?.(group)}
                                    className="w-full min-h-[44px] active:scale-[0.98] transition-all"
                                >
                                    Settle Up
                                </Button>
                            </div>
                        )}
                        
                        {!hasBalance && (
                            <p className="text-sm text-muted-foreground text-center py-3">
                                All settled up in this group
                            </p>
                        )}
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
};

export default GroupSettlementView;
