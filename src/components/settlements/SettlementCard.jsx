import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronRight, Users, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import BalanceBadge from './BalanceBadge';

/**
 * Settlement Card Component
 * Reusable card for displaying person or group settlement info
 */
const SettlementCard = ({
    variant = 'person', // 'person' or 'group'
    data,
    onClick,
    onSettle,
    onRequestRepayment,
    requestStatus,
    lastRequestAt,
    isProcessing = false,
    className,
}) => {
    const getInitials = (name) => {
        if (!name || typeof name !== 'string') return '?';
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getRequestStatusBadge = () => {
        if (!requestStatus) return null;

        const statusConfig = {
            pending: { color: 'bg-amber-100 text-amber-800', icon: Clock, label: 'Requested' },
            partially_paid: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle, label: 'Partially Paid' },
            settled: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Settled' },
            cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Cancelled' }
        };

        const config = statusConfig[requestStatus];
        if (!config) return null;

        const Icon = config.icon;

        return (
            <Badge className={cn('flex items-center gap-1', config.color)}>
                <Icon className="h-3 w-3" />
                {config.label}
            </Badge>
        );
    };

    const formatTimeAgo = (date) => {
        if (!date) return '';

        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    };

    if (variant === 'person') {
        const { name, netBalance, totalGroups } = data;
        const isPositive = netBalance > 0;

        return (
            <div
                onClick={onClick}
                className={cn(
                    'group relative p-4 rounded border transition-colors duration-150 cursor-pointer',
                    'bg-card hover:bg-muted',
                    'border-l-4',
                    isPositive
                        ? 'border-l-success'
                        : 'border-l-destructive',
                    className
                )}
            >
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <Avatar className="h-12 w-12 shadow-sm">
                        <AvatarFallback
                            className={cn(
                                'font-semibold',
                                isPositive
                                    ? 'bg-success text-success-foreground'
                                    : 'bg-destructive text-destructive-foreground'
                            )}
                        >
                            {getInitials(name)}
                        </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate">{name}</h3>
                            {totalGroups > 1 && (
                                <Badge variant="secondary" className="text-xs">
                                    <Users size={12} className="mr-1" />
                                    {totalGroups} groups
                                </Badge>
                            )}
                            {getRequestStatusBadge()}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {isPositive ? 'owes you' : 'you owe'}
                        </p>
                        {lastRequestAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Last activity: {formatTimeAgo(lastRequestAt)}
                            </p>
                        )}
                    </div>

                    {/* Balance & Action */}
                    <div className="flex flex-col items-end gap-2">
                        <BalanceBadge
                            amount={netBalance}
                            size="lg"
                            showSign={false}
                        />

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            {isPositive && onRequestRepayment && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRequestRepayment(data);
                                    }}
                                    className="min-w-[100px]"
                                    disabled={requestStatus === 'pending'}
                                >
                                    {requestStatus === 'pending' ? (
                                        <>
                                            <Clock className="h-4 w-4 mr-2" />
                                            Requested
                                        </>
                                    ) : (
                                        'Request'
                                    )}
                                </Button>
                            )}

                            {onSettle && isPositive && (
                                <Button
                                    size="sm"
                                    variant="default"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSettle(data);
                                    }}
                                    className="min-w-[100px]"
                                    disabled={isProcessing}
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    {isProcessing ? 'Processing...' : 'Mark Paid'}
                                </Button>
                            )}

                            {onSettle && !isPositive && (
                                <Button
                                    size="sm"
                                    variant="default"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSettle(data);
                                    }}
                                    className="min-w-[80px]"
                                >
                                    Settle
                                </Button>
                            )}
                        </div>
                    </div>

                    <ChevronRight
                        size={20}
                        className="text-muted-foreground group-hover:text-foreground transition-colors"
                    />
                </div>
            </div>
        );
    }

    // Group variant
    if (variant === 'group') {
        const {
            groupName,
            membersCount,
            userOwes,
            userIsOwed,
            totalExpenses
        } = data;

        const netBalance = userIsOwed - userOwes;
        const hasBalance = userOwes > 0.01 || userIsOwed > 0.01;

        return (
            <div
                onClick={onClick}
                className={cn(
                    'group relative p-4 rounded border transition-colors duration-150 cursor-pointer',
                    'bg-card hover:bg-muted border-border',
                    hasBalance && 'border-l-4',
                    hasBalance && (netBalance >= 0
                        ? 'border-l-success'
                        : 'border-l-destructive'),
                    className
                )}
            >
                <div className="flex items-center gap-3">
                    {/* Group Avatar */}
                    <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                        <Users size={24} className="text-primary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{groupName}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{membersCount} members</span>
                            {totalExpenses > 0 && (
                                <>
                                    <span>•</span>
                                    <span>₹{totalExpenses.toLocaleString('en-IN')}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Balance Summary */}
                    <div className="text-right">
                        {hasBalance ? (
                            <>
                                {userOwes > 0.01 && (
                                    <p className="text-sm">
                                        <span className="text-muted-foreground">You owe </span>
                                        <span className="font-semibold text-red-600 dark:text-red-400">
                                            ₹{userOwes.toLocaleString('en-IN')}
                                        </span>
                                    </p>
                                )}
                                {userIsOwed > 0.01 && (
                                    <p className="text-sm">
                                        <span className="text-muted-foreground">You're owed </span>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                            ₹{userIsOwed.toLocaleString('en-IN')}
                                        </span>
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">All settled</p>
                        )}
                    </div>

                    <ChevronRight
                        size={20}
                        className="text-muted-foreground group-hover:text-foreground transition-colors"
                    />
                </div>
            </div>
        );
    }

    return null;
};

export default SettlementCard;
