import React, { useState, useEffect } from 'react';
import { Users, Percent, DollarSign } from 'lucide-react';
import { useGroups } from '../../context/GroupContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';

const AdvancedSplitDialog = ({ open, onOpenChange, members, totalAmount, currentSplit, onSave }) => {
  const { getUserProfile } = useGroups();
  const [splitType, setSplitType] = useState(currentSplit.type);
  const [shares, setShares] = useState(currentSplit.shares);
  const [selectedMembers, setSelectedMembers] = useState(Object.keys(currentSplit.shares).filter(m => currentSplit.shares[m] > 0) || members);

  useEffect(() => {
    if (open) { 
      setSplitType(currentSplit.type); 
      
      // Convert shares to appropriate format based on split type
      let initialShares = currentSplit.shares;
      if (currentSplit.type === 'percentage') {
        // If current split is percentage, shares are already percentages
        initialShares = currentSplit.shares;
      } else if (currentSplit.type === 'equal' || currentSplit.type === 'exact') {
        // Convert amounts to percentages for percentage view
        initialShares = Object.fromEntries(
          Object.entries(currentSplit.shares).map(([memberId, amount]) => [
            memberId, 
            totalAmount > 0 ? (amount / totalAmount) * 100 : 0
          ])
        );
      }
      
      setShares(initialShares); 
      setSelectedMembers(Object.keys(currentSplit.shares).filter(m => currentSplit.shares[m] > 0) || members); 
    }
  }, [open, currentSplit, members, totalAmount]);

  const equalShare = totalAmount / selectedMembers.length;
  const total = Object.values(shares).reduce((sum, val) => sum + (val || 0), 0);
  const isValid = splitType === 'equal' || (splitType === 'percentage' && Math.abs(total - 100) < 0.01) || (splitType === 'exact' && Math.abs(total - totalAmount) < 0.01);

  const handleMemberToggle = (memberId, checked) => setSelectedMembers(prev => checked ? [...prev, memberId] : prev.filter(m => m !== memberId));
  
  const handleShareChange = (memberId, value) => {
    const newValue = parseFloat(value) || 0;
    
    if (splitType === 'percentage') {
      // Auto-adjust other members' percentages
      setShares(prev => {
        const otherMembers = members.filter(m => m !== memberId);
        const remaining = 100 - newValue;
        
        if (otherMembers.length === 0) {
          return { ...prev, [memberId]: newValue };
        }
        
        // Calculate total of other members' current percentages
        const othersTotal = otherMembers.reduce((sum, m) => sum + (prev[m] || 0), 0);
        
        // Distribute remaining percentage proportionally among others
        const newShares = { ...prev, [memberId]: newValue };
        
        if (othersTotal > 0) {
          // Distribute proportionally based on current values
          otherMembers.forEach(m => {
            const proportion = (prev[m] || 0) / othersTotal;
            newShares[m] = remaining * proportion;
          });
        } else {
          // Distribute equally if others are all 0
          const equalShare = remaining / otherMembers.length;
          otherMembers.forEach(m => {
            newShares[m] = equalShare;
          });
        }
        
        return newShares;
      });
    } else if (splitType === 'exact') {
      // Auto-adjust other members' amounts
      setShares(prev => {
        const otherMembers = members.filter(m => m !== memberId);
        const remaining = totalAmount - newValue;
        
        if (otherMembers.length === 0) {
          return { ...prev, [memberId]: newValue };
        }
        
        // Calculate total of other members' current amounts
        const othersTotal = otherMembers.reduce((sum, m) => sum + (prev[m] || 0), 0);
        
        // Distribute remaining amount proportionally among others
        const newShares = { ...prev, [memberId]: newValue };
        
        if (othersTotal > 0) {
          // Distribute proportionally based on current values
          otherMembers.forEach(m => {
            const proportion = (prev[m] || 0) / othersTotal;
            newShares[m] = remaining * proportion;
          });
        } else {
          // Distribute equally if others are all 0
          const equalShare = remaining / otherMembers.length;
          otherMembers.forEach(m => {
            newShares[m] = equalShare;
          });
        }
        
        return newShares;
      });
    } else {
      // For equal split, just update the value
      setShares(prev => ({ ...prev, [memberId]: newValue }));
    }
  };
  
  const handleSplitTypeChange = (newType) => {
    const oldType = splitType;
    setSplitType(newType);
    
    // Convert shares when switching types
    if (oldType === 'percentage' && newType === 'exact') {
      // Convert percentages to exact amounts
      setShares(prev => Object.fromEntries(
        Object.entries(prev).map(([memberId, percentage]) => [
          memberId, 
          (percentage / 100) * totalAmount
        ])
      ));
    } else if (oldType === 'exact' && newType === 'percentage') {
      // Convert exact amounts to percentages
      setShares(prev => Object.fromEntries(
        Object.entries(prev).map(([memberId, amount]) => [
          memberId, 
          totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        ])
      ));
    } else if (newType === 'equal') {
      // Reset to equal shares
      setShares(Object.fromEntries(members.map(m => [m, equalShare])));
    } else if (oldType === 'equal' && newType === 'percentage') {
      // Convert equal shares to percentages
      const equalPercentage = 100 / members.length;
      setShares(Object.fromEntries(members.map(m => [m, equalPercentage])));
    } else if (oldType === 'equal' && newType === 'exact') {
      // Keep equal amounts
      setShares(Object.fromEntries(members.map(m => [m, equalShare])));
    }
  };

  const handleSave = () => {
    const finalShares = splitType === 'equal' 
      ? Object.fromEntries(selectedMembers.map(m => [m, equalShare]))
      : splitType === 'percentage'
        ? Object.fromEntries(Object.entries(shares).map(([m, v]) => [m, (v / 100) * totalAmount]))
        : shares;
    onSave({ type: splitType, shares: finalShares });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Users size={18} />
            Split Options
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Choose how to split ₹{totalAmount.toLocaleString()} among members
          </DialogDescription>
        </DialogHeader>
        <Tabs value={splitType} onValueChange={handleSplitTypeChange} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="equal" className="gap-2 min-h-[44px] text-xs sm:text-sm">
              <Users size={14} />
              Equal
            </TabsTrigger>
            <TabsTrigger value="exact" className="gap-2 min-h-[44px] text-xs sm:text-sm">
              <DollarSign size={14} />
              Exact
            </TabsTrigger>
            <TabsTrigger value="percentage" className="gap-2 min-h-[44px] text-xs sm:text-sm">
              <Percent size={14} />
              Percent
            </TabsTrigger>
          </TabsList>
          <TabsContent value="equal" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4 flex-1 overflow-hidden flex flex-col">
            <p className="text-xs sm:text-sm text-muted-foreground">Select members to split equally</p>
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {members.map(memberId => (
                <div key={memberId} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <Checkbox 
                      checked={selectedMembers.includes(memberId)} 
                      onCheckedChange={(checked) => handleMemberToggle(memberId, checked)}
                      className="flex-shrink-0"
                    />
                    <span className="font-medium text-sm sm:text-base truncate">{getUserProfile(memberId)?.name || 'User'}</span>
                  </div>
                  <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                    {selectedMembers.includes(memberId) ? `₹${equalShare.toFixed(2)}` : '-'}
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="exact" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4 flex-1 overflow-hidden flex flex-col">
            <p className="text-xs sm:text-sm text-muted-foreground">Enter exact amounts for each member</p>
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {members.map(memberId => (
                <div key={memberId} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 gap-2">
                  <span className="font-medium text-sm sm:text-base truncate flex-1 min-w-0">{getUserProfile(memberId)?.name || 'User'}</span>
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <span className="text-xs sm:text-sm text-muted-foreground">₹</span>
                    <Input 
                      type="number" 
                      value={shares[memberId] || ''} 
                      onChange={(e) => handleShareChange(memberId, e.target.value)} 
                      className="w-20 sm:w-24 min-h-[44px] text-sm" 
                      min="0" 
                      step="0.01" 
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className={`text-xs sm:text-sm font-medium ${isValid ? 'text-success' : 'text-destructive'}`}>
              Total: ₹{total.toFixed(2)} / ₹{totalAmount.toFixed(2)}
            </div>
          </TabsContent>
          <TabsContent value="percentage" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4 flex-1 overflow-hidden flex flex-col">
            <p className="text-xs sm:text-sm text-muted-foreground">Enter percentage for each member</p>
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {members.map(memberId => { 
                const percentage = shares[memberId] || 0; 
                const amount = (percentage / 100) * totalAmount; 
                return (
                  <div key={memberId} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 gap-2">
                    <span className="font-medium text-sm sm:text-base truncate flex-1 min-w-0">{getUserProfile(memberId)?.name || 'User'}</span>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">₹{amount.toFixed(2)}</span>
                      <div className="flex items-center gap-1">
                        <Input 
                          type="number" 
                          value={shares[memberId] || ''} 
                          onChange={(e) => handleShareChange(memberId, e.target.value)} 
                          className="w-16 sm:w-20 min-h-[44px] text-sm" 
                          min="0" 
                          max="100" 
                          step="0.1" 
                        />
                        <span className="text-xs sm:text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                ); 
              })}
            </div>
            <div className={`text-xs sm:text-sm font-medium ${isValid ? 'text-success' : 'text-destructive'}`}>
              Total: {total.toFixed(1)}%
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px] text-sm sm:text-base">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!isValid || (splitType === 'equal' && selectedMembers.length === 0)}
            className="min-h-[44px] text-sm sm:text-base"
          >
            Apply Split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedSplitDialog;
