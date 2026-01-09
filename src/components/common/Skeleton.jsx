import React from 'react';
import { cn } from '../../lib/utils';

// Skeleton component for loading states with shimmer effect
export const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-muted/60',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:animate-shimmer before:bg-gradient-to-r',
        'before:from-transparent before:via-white/20 before:to-transparent',
        className
      )}
      {...props}
    />
  );
};

// Card skeleton for loading group/expense cards
export const CardSkeleton = () => {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/50 shadow-sm animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
};

// Table skeleton for loading data tables
export const TableSkeleton = ({ rows = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-card/50">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full max-w-[200px]" />
            <Skeleton className="h-3 w-3/4 max-w-[150px]" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
};

// Stats card skeleton
export const StatsCardSkeleton = () => {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/50 shadow-sm">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border/30">
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
};

// Expense card skeleton
export const ExpenseCardSkeleton = () => {
  return (
    <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="text-right">
              <Skeleton className="h-7 w-24 mb-1" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
          </div>
          <div className="mt-2">
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Balance card skeleton
export const BalanceCardSkeleton = () => {
  return (
    <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
