import React from 'react';
import { CreditCard } from 'lucide-react';

const Logo = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl'
  };

  const iconSizes = {
    sm: 20,
    md: 28,
    lg: 40
  };

  return (
    <div className="flex items-center gap-2">
      <CreditCard className="text-primary" size={iconSizes[size]} />
      <span className={`font-display font-bold text-foreground ${sizeClasses[size]}`}>
        Split-It
      </span>
    </div>
  );
};

export default Logo;
