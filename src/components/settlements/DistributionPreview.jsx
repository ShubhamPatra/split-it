import React from 'react';
import { cn } from '../../lib/utils';
import { Users } from 'lucide-react';
import { Progress } from '../ui/progress';

/**
 * Distribution Preview Component
 * Shows how a settlement amount will be distributed across groups
 */
const DistributionPreview = ({
    distributions = [],
    totalAmount = 0,
    remainingDebt = 0,
    className
}) => {
    if (!distributions || distributions.length === 0) {
        return null;
    }

    return (
        <div className={cn('space-y-3', className)}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Users size={16} />
                <span>Distribution across {distributions.length} group{distributions.length > 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2">
                {distributions.map((dist, index) => {
                    const percentage = totalAmount > 0 ? (dist.amount / totalAmount) * 100 : 0;

                    return (
                        <div key={dist.groupId || index} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium truncate max-w-[60%]">
                                    {dist.groupName}
                                </span>
                                <span className="text-foreground font-semibold">
                                    ₹{dist.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <Progress
                                value={percentage}
                                className="h-2"
                            />
                            {dist.remainingBalance > 0.01 && (
                                <p className="text-xs text-muted-foreground">
                                    ₹{dist.remainingBalance.toLocaleString('en-IN')} remaining in this group
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            <div className="pt-3 mt-3 border-t border-border">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total to settle</span>
                    <span className="font-semibold">
                        ₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                </div>
                {remainingDebt > 0.01 && (
                    <div className="flex justify-between text-sm mt-1">
                        <span className="text-muted-foreground">Remaining after settlement</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                            ₹{remainingDebt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DistributionPreview;
