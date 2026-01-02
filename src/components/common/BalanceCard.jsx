import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getUserName } from '../../data/mockData';

const BalanceCard = ({ memberId, balance }) => {
  const isPositive = balance > 0;
  const isNegative = balance < 0;
  const isSettled = balance === 0;

  return (
    <div className="glass-card rounded-lg sm:rounded-xl p-3 sm:p-4 animate-fade-in w-full">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm sm:text-base font-medium flex-shrink-0
            ${isPositive ? 'bg-success/10 text-success' : ''}
            ${isNegative ? 'bg-destructive/10 text-destructive' : ''}
            ${isSettled ? 'bg-muted text-muted-foreground' : ''}
          `}>
            {getUserName(memberId).charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm sm:text-base text-foreground truncate">{getUserName(memberId)}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {isPositive && 'gets back'}
              {isNegative && 'owes'}
              {isSettled && 'settled up'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {isPositive && <TrendingUp className="text-success flex-shrink-0" size={18} />}
          {isNegative && <TrendingDown className="text-destructive flex-shrink-0" size={18} />}
          {isSettled && <Minus className="text-muted-foreground flex-shrink-0" size={18} />}
          <span className={`font-display font-bold text-base sm:text-lg md:text-xl whitespace-nowrap
            ${isPositive ? 'text-success' : ''}
            ${isNegative ? 'text-destructive' : ''}
            ${isSettled ? 'text-muted-foreground' : ''}
          `}>
            {isSettled ? '₹0' : `₹${Math.abs(balance).toFixed(0)}`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BalanceCard;
