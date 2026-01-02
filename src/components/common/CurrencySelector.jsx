import React from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const CurrencySelector = ({ compact = false }) => {
  const { currency, setCurrency, currencies } = useCurrency();

  if (!currencies || !currency) {
    return null;
  }

  if (compact) {
    return (
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{currencies.map(c => (<SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>))}</SelectContent>
      </Select>
    );
  }

  return (
    <Select value={currency} onValueChange={setCurrency}>
      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
      <SelectContent>{currencies.map(c => (<SelectItem key={c.code} value={c.code}>{c.symbol} {c.name}</SelectItem>))}</SelectContent>
    </Select>
  );
};

export default CurrencySelector;
