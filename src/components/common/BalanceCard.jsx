import React, { memo } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { useGroups } from '../../context/GroupContext';

const BalanceCard = memo(({ memberId, balance }) => {
  const { getUserProfile } = useGroups();
  const isPositive = balance > 0;
  const isNegative = balance < 0;
  const isSettled = balance === 0;
  const userName = getUserProfile(memberId)?.name || 'User';

  return (
    <div className={`relative rounded p-4 animate-fade-in w-full border transition-colors duration-200
      ${isPositive ? 'bg-success/5 border-success/20 hover:border-success/40' : ''}
      ${isNegative ? 'bg-destructive/5 border-destructive/20 hover:border-destructive/40' : ''}
      ${isSettled ? 'bg-card border-border' : ''}
    `}>

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded flex items-center justify-center text-sm sm:text-base font-semibold flex-shrink-0
            ${isPositive ? 'bg-success/10 text-success' : ''}
            ${isNegative ? 'bg-destructive/10 text-destructive' : ''}
            ${isSettled ? 'bg-muted text-muted-foreground' : ''}
          `}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm sm:text-base text-foreground truncate">{userName}</p>
            <p className={`text-xs sm:text-sm flex items-center gap-1
              ${isPositive ? 'text-success' : ''}
              ${isNegative ? 'text-destructive' : ''}
              ${isSettled ? 'text-muted-foreground' : ''}
            `}>
              {isPositive && <>gets back <ArrowRight size={12} className="opacity-60" /></>}
              {isNegative && <>owes <ArrowRight size={12} className="opacity-60" /></>}
              {isSettled && 'all settled up'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`p-1.5 rounded
            ${isPositive ? 'bg-success/10' : ''}
            ${isNegative ? 'bg-destructive/10' : ''}
            ${isSettled ? 'bg-muted' : ''}
          `}>
            {isPositive && <TrendingUp className="text-success" size={18} />}
            {isNegative && <TrendingDown className="text-destructive" size={18} />}
            {isSettled && <Minus className="text-muted-foreground" size={18} />}
          </div>
          <span className={`font-display font-bold text-2xl sm:text-3xl tracking-tight whitespace-nowrap
            ${isPositive ? 'text-success' : ''}
            ${isNegative ? 'text-destructive' : ''}
            ${isSettled ? 'text-muted-foreground' : ''}
          `}>
            {isSettled ? '₹0' : `₹${Math.abs(balance).toLocaleString()}`}
          </span>
        </div>
      </div>
    </div>
  );
});

// Display name for debugging
BalanceCard.displayName = 'BalanceCard';

export default BalanceCard;
