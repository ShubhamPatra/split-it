import React, { useMemo } from 'react';
import { TrendingDown, TrendingUp, AlertCircle, CheckCircle2, ArrowRight, Sparkles, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { calculateMinimumTransactions, calculateSettlementStats } from '../../utils/settlementOptimizer';
import { getUpiProviderIcon } from '../../utils/upiHelpers';
import UpiPaymentButton from './UpiPaymentButton';

const SettlementSuggestions = ({ balances, settlements, profiles, onSettleClick }) => {
  // Calculate optimal settlements using minimum transactions algorithm
  const optimalSettlements = useMemo(() => {
    return calculateMinimumTransactions(balances);
  }, [balances]);

  // Calculate stats
  const stats = useMemo(() => {
    return calculateSettlementStats(balances, settlements);
  }, [balances, settlements]);

  const getUserName = (userId) => {
    return profiles[userId]?.name || 'Unknown User';
  };

  const getUserUpiId = (userId) => {
    return profiles[userId]?.upiId || null;
  };

  const hasUpiId = (userId) => {
    const upiId = getUserUpiId(userId);
    return upiId && upiId.trim().length > 0;
  };

  if (optimalSettlements.length === 0) {
    return (
      <Card className="border-success/20 bg-success/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-success" size={24} />
            <div>
              <CardTitle className="text-success">All Settled!</CardTitle>
              <CardDescription>No pending settlements in this group</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Settlement Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles size={20} className="text-primary" />
            Settlement Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Total to Settle</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground">₹{stats.remainingToSettle.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Transactions Needed</p>
              <p className="text-lg sm:text-2xl font-bold text-primary">{stats.optimalTransactionCount}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Settled</p>
              <p className="text-lg sm:text-2xl font-bold text-success">₹{stats.settledAmount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Progress</p>
              <div className="flex items-center gap-2">
                <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.settlementProgress}%</p>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-success to-primary transition-all duration-500"
              style={{ width: `${stats.settlementProgress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Optimal Settlement Suggestions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles size={20} className="text-warning" />
                Optimal Settlement Plan
              </CardTitle>
              <CardDescription>
                Minimize transactions with smart suggestions
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">
              {optimalSettlements.length} transaction{optimalSettlements.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {optimalSettlements.map((settlement, index) => {
            const fromUser = getUserName(settlement.from);
            const toUser = getUserName(settlement.to);
            const toUserUpiId = getUserUpiId(settlement.to);
            const hasUpi = hasUpiId(settlement.to);
            const providerIcon = hasUpi ? getUpiProviderIcon(toUserUpiId) : null;
            
            return (
              <div 
                key={`${settlement.from}-${settlement.to}-${index}`}
                className="glass-card p-3 sm:p-4 rounded-lg hover:shadow-md transition-all"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                  {/* From User */}
                  <div className="flex items-center gap-3 w-full sm:flex-1">
                    <div className="p-2 rounded-lg bg-destructive/10 flex-shrink-0">
                      <TrendingDown className="text-destructive" size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm sm:text-base truncate">{fromUser}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Pays</p>
                    </div>
                    {/* Amount - shown inline on mobile */}
                    <div className="flex sm:hidden items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
                      <ArrowRight className="text-primary" size={14} />
                      <span className="font-bold text-base text-primary">
                        ₹{settlement.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Amount - shown separately on desktop */}
                  <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <ArrowRight className="text-primary" size={16} />
                    <span className="font-bold text-lg text-primary">
                      ₹{settlement.amount.toLocaleString()}
                    </span>
                  </div>
                  
                  {/* To User & Settle Button */}
                  <div className="flex items-center justify-between w-full sm:w-auto sm:flex-1 gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-success/10 flex-shrink-0">
                        <TrendingUp className="text-success" size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground text-sm sm:text-base truncate">{toUser}</p>
                          {hasUpi && providerIcon && (
                            <Badge variant="ghost" className="text-xs flex-shrink-0">
                              {providerIcon}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Receives</p>
                    </div>
                  </div>
                  
                  {/* Payment Method Selector */}
                  <div className="flex gap-2 flex-shrink-0">
                    {hasUpi && (
                      <UpiPaymentButton
                        amount={settlement.amount}
                        receiverName={toUser}
                        receiverUpiId={toUserUpiId}
                        note={`Settlement - Split-It`}
                        onPaymentInitiated={() => {
                          onSettleClick(settlement.from, settlement.to, settlement.amount, 'upi');
                        }}
                        size="sm"
                        variant="default"
                      />
                    )}
                    {!hasUpi && (
                      <Button
                        onClick={() => onSettleClick(settlement.from, settlement.to, settlement.amount, 'cash')}
                        size="sm"
                        variant="default"
                        className="min-h-[44px] h-auto"
                      >
                        <Wallet size={16} className="mr-1 sm:mr-2" />
                        <span className="text-xs sm:text-sm">Settle</span>
                      </Button>
                    )}
                  </div>
                  </div>
                </div>
                {hasUpi && toUserUpiId && (
                  <div className="mt-2 pl-12">
                    <p className="text-xs text-muted-foreground">
                      UPI: {toUserUpiId}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          
          <div className="mt-4 p-3 bg-info/10 rounded-lg border border-info/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-info mt-0.5" size={16} />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Smart Optimization Applied</p>
                <p>
                  This plan minimizes the number of transactions needed to settle all debts in the group.
                  {stats.optimalTransactionCount < Object.keys(balances).length - 1 && 
                    ` Saved ${Object.keys(balances).length - 1 - stats.optimalTransactionCount} extra transaction${Object.keys(balances).length - 1 - stats.optimalTransactionCount !== 1 ? 's' : ''}!`
                  }
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettlementSuggestions;
