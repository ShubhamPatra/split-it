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
    <div className={`relative rounded p-4 animate-fade-in w-full border transition-colors duration-150
      ${isPositive ? 'bg-card border-l-4 border-l-success' : ''}
      ${isNegative ? 'bg-card border-l-4 border-l-destructive' : ''}
      ${isSettled ? 'bg-card border-border' : ''}
    `}>

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded flex items-center justify-center text-sm sm:text-base font-semibold flex-shrink-0 bg-muted text-foreground`}>
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
          {isPositive && <TrendingUp className="text-success" size={18} />}
          {isNegative && <TrendingDown className="text-destructive" size={18} />}
          {isSettled && <Minus className="text-muted-foreground" size={18} />}
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
