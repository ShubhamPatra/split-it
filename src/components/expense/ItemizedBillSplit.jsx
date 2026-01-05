import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Users, Receipt, ChevronDown, ChevronUp, Calculator, Utensils, ShoppingBag } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { useGroups } from '../../context/GroupContext';

const ItemizedBillSplit = ({ 
  open, 
  onOpenChange, 
  members, 
  onSave,
  initialItems = [],
  initialTax = 0,
  initialTip = 0 
}) => {
  const { getUserProfile } = useGroups();
  
  // Bill items state
  const [items, setItems] = useState([
    { id: 1, name: '', price: '', sharedBy: [...members] }
  ]);
  
  // Additional charges
  const [taxAmount, setTaxAmount] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [tipPercent, setTipPercent] = useState('');
  const [showTaxTip, setShowTaxTip] = useState(false);
  
  // UI state
  const [expandedItem, setExpandedItem] = useState(null);

  // Initialize from props
  useEffect(() => {
    if (open) {
      if (initialItems.length > 0) {
        setItems(initialItems);
      } else {
        setItems([{ id: 1, name: '', price: '', sharedBy: [...members] }]);
      }
      setTaxAmount(initialTax > 0 ? initialTax.toString() : '');
      setTipAmount(initialTip > 0 ? initialTip.toString() : '');
    }
  }, [open, initialItems, initialTax, initialTip, members]);

  // Calculate subtotal
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  }, [items]);

  // Calculate tax from percent
  useEffect(() => {
    if (taxPercent && subtotal > 0) {
      const calculatedTax = (subtotal * parseFloat(taxPercent)) / 100;
      setTaxAmount(calculatedTax.toFixed(2));
    }
  }, [taxPercent, subtotal]);

  // Calculate tip from percent
  useEffect(() => {
    if (tipPercent && subtotal > 0) {
      const calculatedTip = (subtotal * parseFloat(tipPercent)) / 100;
      setTipAmount(calculatedTip.toFixed(2));
    }
  }, [tipPercent, subtotal]);

  // Calculate total
  const totalAmount = useMemo(() => {
    return subtotal + (parseFloat(taxAmount) || 0) + (parseFloat(tipAmount) || 0);
  }, [subtotal, taxAmount, tipAmount]);

  // Calculate per-person amounts
  const perPersonAmounts = useMemo(() => {
    const amounts = {};
    members.forEach(m => { amounts[m] = 0; });

    // Add item amounts
    items.forEach(item => {
      const price = parseFloat(item.price) || 0;
      if (price > 0 && item.sharedBy.length > 0) {
        const perPerson = price / item.sharedBy.length;
        item.sharedBy.forEach(memberId => {
          amounts[memberId] = (amounts[memberId] || 0) + perPerson;
        });
      }
    });

    // Distribute tax & tip proportionally based on item amounts
    const tax = parseFloat(taxAmount) || 0;
    const tip = parseFloat(tipAmount) || 0;
    
    if ((tax > 0 || tip > 0) && subtotal > 0) {
      members.forEach(memberId => {
        const proportion = amounts[memberId] / subtotal;
        amounts[memberId] += (tax + tip) * proportion;
      });
    }

    // Round to 2 decimals
    Object.keys(amounts).forEach(key => {
      amounts[key] = Math.round(amounts[key] * 100) / 100;
    });

    return amounts;
  }, [items, members, taxAmount, tipAmount, subtotal]);

  // Add new item
  const addItem = () => {
    const newId = Math.max(...items.map(i => i.id), 0) + 1;
    setItems([...items, { id: newId, name: '', price: '', sharedBy: [...members] }]);
    setExpandedItem(newId);
  };

  // Remove item
  const removeItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  // Update item
  const updateItem = (id, field, value) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Toggle member for item
  const toggleMemberForItem = (itemId, memberId, checked) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const newSharedBy = checked 
          ? [...item.sharedBy, memberId]
          : item.sharedBy.filter(m => m !== memberId);
        return { ...item, sharedBy: newSharedBy };
      }
      return item;
    }));
  };

  // Select all members for item
  const selectAllForItem = (itemId) => {
    setItems(items.map(item => 
      item.id === itemId ? { ...item, sharedBy: [...members] } : item
    ));
  };

  // Handle save
  const handleSave = () => {
    // Filter valid items and create split config
    const validItems = items.filter(item => item.name.trim() && parseFloat(item.price) > 0);
    
    const splitConfig = {
      type: 'itemized',
      shares: perPersonAmounts,
      items: validItems.map(item => ({
        name: item.name.trim(),
        price: parseFloat(item.price),
        sharedBy: item.sharedBy
      })),
      tax: parseFloat(taxAmount) || 0,
      tip: parseFloat(tipAmount) || 0,
      subtotal,
      total: totalAmount
    };

    onSave(splitConfig, totalAmount);
    onOpenChange(false);
  };

  const getMemberName = (memberId) => {
    return getUserProfile(memberId)?.name?.split(' ')[0] || 'User';
  };

  // Validation
  const hasValidItems = items.some(item => item.name.trim() && parseFloat(item.price) > 0);
  const totalCalculatedShares = Object.values(perPersonAmounts).reduce((sum, val) => sum + val, 0);
  const isBalanced = Math.abs(totalCalculatedShares - totalAmount) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Utensils size={20} className="text-primary" />
            Split by Items
          </DialogTitle>
          <DialogDescription>
            Add items from the bill and select who had each item
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Items List */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <ShoppingBag size={16} />
              Bill Items
            </Label>
            
            {items.map((item, index) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-3 bg-secondary/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                  <Input
                    placeholder="Item name (e.g., Pizza)"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      placeholder="Price"
                      value={item.price}
                      onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      className="pl-6"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="text-destructive hover:text-destructive h-9 w-9"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>

                {/* Member Selection */}
                <div className="space-y-2">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                  >
                    <span className="text-xs text-muted-foreground">
                      Shared by: {item.sharedBy.length === members.length 
                        ? 'Everyone' 
                        : item.sharedBy.length === 0 
                          ? 'No one selected'
                          : item.sharedBy.map(m => getMemberName(m)).join(', ')}
                    </span>
                    {expandedItem === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                  
                  {expandedItem === item.id && (
                    <div className="bg-background rounded-md p-2 space-y-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium">Select who had this item:</span>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="h-auto p-0 text-xs"
                          onClick={() => selectAllForItem(item.id)}
                        >
                          Select All
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {members.map(memberId => (
                          <label 
                            key={memberId} 
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/50 p-1 rounded"
                          >
                            <Checkbox
                              checked={item.sharedBy.includes(memberId)}
                              onCheckedChange={(checked) => toggleMemberForItem(item.id, memberId, checked)}
                            />
                            <span className="truncate">{getMemberName(memberId)}</span>
                          </label>
                        ))}
                      </div>
                      {item.sharedBy.length > 0 && parseFloat(item.price) > 0 && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          ₹{(parseFloat(item.price) / item.sharedBy.length).toFixed(2)} per person
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={addItem}
              className="w-full"
            >
              <Plus size={16} className="mr-2" />
              Add Item
            </Button>
          </div>

          {/* Subtotal */}
          <div className="flex justify-between items-center py-2 border-t">
            <span className="font-medium">Subtotal</span>
            <span className="font-medium">₹{subtotal.toFixed(2)}</span>
          </div>

          {/* Tax & Tip Section */}
          <div>
            <Button
              variant="ghost"
              onClick={() => setShowTaxTip(!showTaxTip)}
              className="w-full justify-between h-auto py-2"
            >
              <span className="flex items-center gap-2">
                <Calculator size={16} />
                Add Tax & Tip
              </span>
              {showTaxTip ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>

            {showTaxTip && (
              <div className="space-y-3 pt-3">
                {/* Tax */}
                <div className="flex items-center gap-2">
                  <Label className="w-12">Tax</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={taxAmount}
                      onChange={(e) => { setTaxAmount(e.target.value); setTaxPercent(''); }}
                      onWheel={(e) => e.target.blur()}
                      className="pl-6"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <span className="text-muted-foreground">or</span>
                  <div className="relative w-20">
                    <Input
                      type="number"
                      placeholder="%"
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      className="pr-6"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>

                {/* Tip */}
                <div className="flex items-center gap-2">
                  <Label className="w-12">Tip</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={tipAmount}
                      onChange={(e) => { setTipAmount(e.target.value); setTipPercent(''); }}
                      onWheel={(e) => e.target.blur()}
                      className="pl-6"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <span className="text-muted-foreground">or</span>
                  <div className="relative w-20">
                    <Input
                      type="number"
                      placeholder="%"
                      value={tipPercent}
                      onChange={(e) => setTipPercent(e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      className="pr-6"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>

                {/* Quick tip buttons */}
                <div className="flex gap-2">
                  <span className="text-xs text-muted-foreground">Quick tip:</span>
                  {[10, 15, 20].map(percent => (
                    <Button
                      key={percent}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setTipPercent(percent.toString())}
                    >
                      {percent}%
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center py-3 border-t border-b bg-primary/5 px-2 rounded">
            <span className="font-bold text-lg">Total</span>
            <span className="font-bold text-lg text-primary">₹{totalAmount.toFixed(2)}</span>
          </div>

          {/* Per Person Breakdown */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users size={16} />
              Each Person Pays
            </Label>
            <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
              {members.map(memberId => {
                const amount = perPersonAmounts[memberId] || 0;
                const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
                
                return (
                  <div key={memberId} className="flex items-center justify-between">
                    <span className="text-sm">{getMemberName(memberId)}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="font-medium text-sm w-20 text-right">
                        ₹{amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation Warning */}
          {!isBalanced && hasValidItems && (
            <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Receipt size={14} />
              Some items may not be assigned to anyone
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!hasValidItems}
          >
            Apply Split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ItemizedBillSplit;
