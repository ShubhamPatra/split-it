import React, { useState, useEffect } from 'react';
import { Users, Percent, DollarSign, List, Plus, Trash2 } from 'lucide-react';
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
  
  // Line items state for itemized splitting (Comment 5)
  const [lineItems, setLineItems] = useState([
    { id: 1, description: '', quantity: 1, unitPrice: 0, assignedTo: [] }
  ]);

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
  const isValid = splitType === 'equal' || (splitType === 'percentage' && Math.abs(total - 100) < 0.01) || (splitType === 'exact' && Math.abs(total - totalAmount) < 0.01) || splitType === 'itemized';

  // Calculate itemized totals (Comment 5)
  const lineItemsTotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const itemizedShares = calculateItemizedShares();
  
  function calculateItemizedShares() {
    const shares = {};
    members.forEach(m => { shares[m] = 0; });
    
    lineItems.forEach(item => {
      const itemTotal = item.quantity * item.unitPrice;
      if (item.assignedTo.length > 0) {
        const perPerson = itemTotal / item.assignedTo.length;
        item.assignedTo.forEach(memberId => {
          shares[memberId] = (shares[memberId] || 0) + perPerson;
        });
      }
    });
    
    return shares;
  }
  
  // Line item handlers (Comment 5)
  const addLineItem = () => {
    setLineItems(prev => [...prev, {
      id: Date.now(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      assignedTo: []
    }]);
  };
  
  const removeLineItem = (id) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter(item => item.id !== id));
    }
  };
  
  const updateLineItem = (id, field, value) => {
    setLineItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };
  
  const toggleLineItemMember = (itemId, memberId) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const isAssigned = item.assignedTo.includes(memberId);
      return {
        ...item,
        assignedTo: isAssigned 
          ? item.assignedTo.filter(m => m !== memberId)
          : [...item.assignedTo, memberId]
      };
    }));
  };

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
    let finalShares;
    
    if (splitType === 'equal') {
      finalShares = Object.fromEntries(selectedMembers.map(m => [m, equalShare]));
    } else if (splitType === 'percentage') {
      finalShares = Object.fromEntries(Object.entries(shares).map(([m, v]) => [m, (v / 100) * totalAmount]));
    } else if (splitType === 'itemized') {
      // For itemized, calculate shares from line items (Comment 5)
      finalShares = itemizedShares;
    } else {
      finalShares = shares;
    }
    
    const result = { type: splitType, shares: finalShares };
    
    // Include line items for itemized type
    if (splitType === 'itemized') {
      result.lineItems = lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
        assignedTo: item.assignedTo,
      }));
    }
    
    onSave(result);
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
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="equal" className="gap-1 min-h-[44px] text-xs sm:text-sm">
              <Users size={14} />
              <span className="hidden sm:inline">Equal</span>
            </TabsTrigger>
            <TabsTrigger value="exact" className="gap-1 min-h-[44px] text-xs sm:text-sm">
              <DollarSign size={14} />
              <span className="hidden sm:inline">Exact</span>
            </TabsTrigger>
            <TabsTrigger value="percentage" className="gap-1 min-h-[44px] text-xs sm:text-sm">
              <Percent size={14} />
              <span className="hidden sm:inline">%</span>
            </TabsTrigger>
            <TabsTrigger value="itemized" className="gap-1 min-h-[44px] text-xs sm:text-sm">
              <List size={14} />
              <span className="hidden sm:inline">Items</span>
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
          
          {/* Itemized Split Tab (Comment 5) */}
          <TabsContent value="itemized" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4 flex-1 overflow-hidden flex flex-col">
            <p className="text-xs sm:text-sm text-muted-foreground">Add line items and assign to members</p>
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {lineItems.map((item, index) => (
                <div key={item.id} className="p-3 border border-border rounded-lg space-y-3 bg-secondary/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(item.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                  
                  <Input
                    placeholder="Item description (e.g., Pizza, Drinks)"
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                    className="min-h-[40px] text-sm"
                  />
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Qty</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        className="min-h-[40px] text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Price (₹)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice || ''}
                        onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="min-h-[40px] text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Assigned to:</label>
                    <div className="flex flex-wrap gap-2">
                      {members.map(memberId => {
                        const isAssigned = item.assignedTo.includes(memberId);
                        return (
                          <button
                            key={memberId}
                            type="button"
                            onClick={() => toggleLineItemMember(item.id, memberId)}
                            className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                              isAssigned 
                                ? 'bg-primary text-primary-foreground border-primary' 
                                : 'bg-secondary border-border hover:border-primary/50'
                            }`}
                          >
                            {getUserProfile(memberId)?.name?.split(' ')[0] || 'User'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {item.quantity > 0 && item.unitPrice > 0 && (
                    <div className="text-xs text-muted-foreground text-right">
                      Subtotal: ₹{(item.quantity * item.unitPrice).toFixed(2)}
                      {item.assignedTo.length > 0 && (
                        <span className="ml-2">
                          (₹{((item.quantity * item.unitPrice) / item.assignedTo.length).toFixed(2)} each)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={addLineItem}
                className="w-full min-h-[40px] border-dashed"
              >
                <Plus size={14} className="mr-2" />
                Add Item
              </Button>
            </div>
            
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items Total:</span>
                <span className="font-medium">₹{lineItemsTotal.toFixed(2)}</span>
              </div>
              {Object.entries(itemizedShares).filter(([_, amt]) => amt > 0).length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Per person breakdown:</span>
                  {Object.entries(itemizedShares)
                    .filter(([_, amt]) => amt > 0)
                    .map(([memberId, amt]) => (
                      <div key={memberId} className="flex justify-between text-xs">
                        <span>{getUserProfile(memberId)?.name || 'User'}</span>
                        <span>₹{amt.toFixed(2)}</span>
                      </div>
                    ))
                  }
                </div>
              )}
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
