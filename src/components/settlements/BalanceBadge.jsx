import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Balance Badge Component
 * Displays balance amount with color coding
 * Green for positive (they owe me), Red for negative (I owe them)
 */
const BalanceBadge = ({
    amount,
    currency = '₹',
    size = 'default',
    showSign = true,
    className
}) => {
    const isPositive = amount > 0;
    const isZero = Math.abs(amount) < 0.01;

    const formattedAmount = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(Math.abs(amount));

    const sizeClasses = {
        sm: 'text-sm font-medium',
        default: 'text-base font-semibold',
        lg: 'text-lg font-bold',
        xl: 'text-xl font-bold',
    };

    const colorClasses = isZero
        ? 'text-muted-foreground'
        : isPositive
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400';

    const sign = isZero ? '' : (isPositive && showSign ? '+' : (showSign ? '-' : ''));

    return (
        <span className={cn(
            sizeClasses[size] || sizeClasses.default,
            colorClasses,
            className
        )}>
            {sign}{currency}{formattedAmount}
        </span>
    );
};

export default BalanceBadge;
