import React, { createContext, useContext, useState, useCallback } from 'react';

export const currencies = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', rate: 1 },
  { code: 'USD', symbol: '$', name: 'US Dollar', rate: 0.012 },
  { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.011 },
  { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.0095 },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', rate: 0.044 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', rate: 0.016 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rate: 1.78 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rate: 0.018 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rate: 0.016 },
];

const CurrencyContext = createContext(undefined);

export const CurrencyProvider = ({ children }) => {
  const baseCurrency = currencies[0]; // INR
  const [displayCurrency, setDisplayCurrencyState] = useState(baseCurrency);

  const getCurrency = useCallback((code) => {
    return currencies.find(c => c.code === code);
  }, []);

  const setDisplayCurrency = useCallback((code) => {
    const currency = getCurrency(code);
    if (currency) {
      setDisplayCurrencyState(currency);
    }
  }, [getCurrency]);

  const convert = useCallback((amount, fromCode, toCode) => {
    const fromCurrency = getCurrency(fromCode);
    const toCurrency = getCurrency(toCode);
    
    if (!fromCurrency || !toCurrency) return amount;
    
    // Convert to INR first (base), then to target
    const inrAmount = amount / fromCurrency.rate;
    return inrAmount * toCurrency.rate;
  }, [getCurrency]);

  const formatAmount = useCallback((amount, sourceCurrencyCode = 'INR') => {
    if (!amount && amount !== 0) return `${displayCurrency.symbol}0`;
    
    // Convert from source currency to display currency
    const convertedAmount = convert(amount, sourceCurrencyCode, displayCurrency.code);
    
    return `${displayCurrency.symbol}${convertedAmount.toLocaleString(undefined, { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    })}`;
  }, [displayCurrency, convert]);

  return (
    <CurrencyContext.Provider
      value={{
        baseCurrency,
        displayCurrency,
        setDisplayCurrency,
        convert,
        formatAmount,
        getCurrency,
        currency: displayCurrency.code,
        setCurrency: setDisplayCurrency,
        currencies,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
