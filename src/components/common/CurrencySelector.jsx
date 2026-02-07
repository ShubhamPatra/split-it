import React from 'react';
import { DollarSign } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';

// Supported currencies with symbols and names
const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
];

/**
 * Currency Selector Component
 * 
 * Dropdown selector for choosing currency with symbol and name display
 */
const CurrencySelector = ({
  value = 'INR',
  onChange,
  disabled = false,
  showLabel = true,
  className = ''
}) => {
  const selectedCurrency = CURRENCIES.find(c => c.code === value) || CURRENCIES[0];

  return (
    <div className={className}>
      {showLabel && (
        <Label htmlFor="currency" className="flex items-center gap-2 mb-2">
          <DollarSign size={16} />
          Currency
        </Label>
      )}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="currency" className="w-full">
          <SelectValue>
            <span className="flex items-center gap-2">
              <span className="font-semibold">{selectedCurrency.symbol}</span>
              <span>{selectedCurrency.code}</span>
              <span className="text-muted-foreground text-sm">- {selectedCurrency.name}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <span className="flex items-center gap-2">
                <span className="font-semibold w-6">{currency.symbol}</span>
                <span className="font-medium w-12">{currency.code}</span>
                <span className="text-muted-foreground">- {currency.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

/**
 * Get currency symbol by code
 */
export const getCurrencySymbol = (code) => {
  const currency = CURRENCIES.find(c => c.code === code);
  return currency ? currency.symbol : code;
};

/**
 * Get currency name by code
 */
export const getCurrencyName = (code) => {
  const currency = CURRENCIES.find(c => c.code === code);
  return currency ? currency.name : code;
};

/**
 * Format amount with currency symbol
 * Uses Intl.NumberFormat with user's locale for proper formatting
 */
export const formatCurrency = (amount, currencyCode = 'INR') => {
  const numAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'symbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numAmount);
};

export { CURRENCIES };
export default CurrencySelector;
