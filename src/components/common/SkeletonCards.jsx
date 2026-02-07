import React from 'react';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';

/**
 * Skeleton for GroupCard component
 * Matches the structure of GroupCard.jsx
 */
export const SkeletonGroupCard = () => {
  return (
    <div className="relative overflow-hidden bg-card rounded p-5 border border-border shadow-sm w-full animate-pulse">
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Group name */}
          <Skeleton className="h-6 w-3/4" />
          {/* Created date */}
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Delete button placeholder */}
        <Skeleton className="h-10 w-10 rounded" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-14" />
        </div>
      </div>

      {/* View details button */}
      <Skeleton className="h-9 w-full rounded" />
    </div>
  );
};

/**
 * Skeleton for ExpenseCard component
 * Matches the structure of ExpenseCard.jsx
 */
export const SkeletonExpenseCard = () => {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left side: Icon and details */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Category icon */}
            <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
            
            <div className="flex-1 min-w-0 space-y-2">
              {/* Description */}
              <Skeleton className="h-5 w-3/4" />
              {/* Category and date */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              {/* Paid by */}
              <Skeleton className="h-4 w-32" />
            </div>
          </div>

          {/* Right side: Amount and actions */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Skeleton for BalanceCard component
 * Matches the structure of BalanceCard.jsx
 */
export const SkeletonBalanceCard = () => {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* User info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            
            <div className="flex-1 min-w-0 space-y-2">
              {/* Name */}
              <Skeleton className="h-5 w-32" />
              {/* Balance description */}
              <Skeleton className="h-4 w-24" />
            </div>
          </div>

          {/* Amount and action */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-20 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Skeleton for SettlementCard component
 * Matches the structure of SettlementCard.jsx
 */
export const SkeletonSettlementCard = () => {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left side: Details */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* From -> To */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-5 w-24" />
            </div>
            
            {/* Amount */}
            <Skeleton className="h-6 w-28" />
            
            {/* Payment method and date */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>

          {/* Right side: Status badge */}
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Multiple skeleton cards for list views
 */
export const SkeletonGroupCardList = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonGroupCard key={index} />
      ))}
    </div>
  );
};

export const SkeletonExpenseCardList = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonExpenseCard key={index} />
      ))}
    </div>
  );
};

export const SkeletonBalanceCardList = ({ count = 4 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBalanceCard key={index} />
      ))}
    </div>
  );
};

export const SkeletonSettlementCardList = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonSettlementCard key={index} />
      ))}
    </div>
  );
};

