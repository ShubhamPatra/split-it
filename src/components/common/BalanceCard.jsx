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
    <div className={`relative rounded-xl p-4 animate-fade-in w-full border transition-all duration-200 hover:shadow-md overflow-hidden
      ${isPositive ? 'bg-gradient-to-br from-success/10 via-success/5 to-transparent border-success/20 hover:border-success/40' : ''}
      ${isNegative ? 'bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent border-destructive/20 hover:border-destructive/40' : ''}
      ${isSettled ? 'bg-card border-border/50' : ''}
    `}>
      {/* Subtle gradient overlay */}
      {(isPositive || isNegative) && (
        <div className={`absolute inset-0 opacity-[0.03] pointer-events-none
          ${isPositive ? 'bg-gradient-to-r from-success to-transparent' : ''}
          ${isNegative ? 'bg-gradient-to-r from-destructive to-transparent' : ''}
        `} />
      )}
      
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-sm sm:text-base font-semibold flex-shrink-0 shadow-inner
            ${isPositive ? 'bg-success/15 text-success' : ''}
            ${isNegative ? 'bg-destructive/15 text-destructive' : ''}
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
              {isSettled && 'all settled up ✓'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`p-1.5 rounded-lg
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
