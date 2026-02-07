/**
 * Currency Conversion Service
 * 
 * Provides exchange rate fetching, caching, and currency conversion utilities.
 * Uses exchangerate-api.com free tier (1500 requests/month).
 * 
 * Features:
 * - Fetches latest exchange rates
 * - Caches rates for 1 hour (reduces API calls)
 * - Converts between any supported currencies
 * - Graceful fallback to cached rates
 * - Base currency: INR (Indian Rupee)
 */

import NodeCache from 'node-cache';
import axios from 'axios';

// Cache with 1 hour TTL
const rateCache = new NodeCache({ stdTTL: 3600 });

// Base currency for the application
const BASE_CURRENCY = 'INR';

// Free tier API - no key required for basic usage
// Alternative: Use exchangerate-api.com with API key for higher limits
const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest';

// Supported currencies (can be extended)
const SUPPORTED_CURRENCIES = [
  'INR', // Indian Rupee (base)
  'USD', // US Dollar
  'EUR', // Euro
  'GBP', // British Pound
  'AUD', // Australian Dollar
  'CAD', // Canadian Dollar
  'SGD', // Singapore Dollar
  'AED', // UAE Dirham
  'JPY', // Japanese Yen
  'CNY', // Chinese Yuan
];

/**
 * Fetch latest exchange rates from API
 * @param {string} baseCurrency - Base currency code (default: INR)
 * @returns {Promise<Object>} Exchange rates object
 */
async function fetchExchangeRates(baseCurrency = BASE_CURRENCY) {
  try {
    const cacheKey = `rates_${baseCurrency}`;
    
    // Check cache first
    const cachedRates = rateCache.get(cacheKey);
    if (cachedRates) {
      console.log(`[Currency Service] Using cached rates for ${baseCurrency}`);
      return cachedRates;
    }

    // Fetch from API
    console.log(`[Currency Service] Fetching rates for ${baseCurrency} from API`);
    const response = await axios.get(`${EXCHANGE_RATE_API_URL}/${baseCurrency}`, {
      timeout: 5000, // 5 second timeout
    });

    if (response.data && response.data.rates) {
      const rates = {
        base: baseCurrency,
        rates: response.data.rates,
        timestamp: Date.now(),
        source: 'api',
      };

      // Cache the rates
      rateCache.set(cacheKey, rates);
      console.log(`[Currency Service] Cached rates for ${baseCurrency}`);

      return rates;
    }

    throw new Error('Invalid API response format');
  } catch (error) {
    console.error('[Currency Service] Error fetching exchange rates:', error.message);

    // Try to return stale cache if available
    const cacheKey = `rates_${baseCurrency}`;
    const staleRates = rateCache.get(cacheKey);
    if (staleRates) {
      console.warn('[Currency Service] Using stale cached rates due to API error');
      return { ...staleRates, source: 'stale_cache' };
    }

    // If no cache available, throw error
    throw new Error('Unable to fetch exchange rates and no cached rates available');
  }
}

/**
 * Convert amount from one currency to another
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {Promise<number>} Converted amount
 */
async function convertCurrency(amount, fromCurrency, toCurrency) {
  // If same currency, no conversion needed
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Validate currencies
  if (!SUPPORTED_CURRENCIES.includes(fromCurrency)) {
    throw new Error(`Unsupported source currency: ${fromCurrency}`);
  }
  if (!SUPPORTED_CURRENCIES.includes(toCurrency)) {
    throw new Error(`Unsupported target currency: ${toCurrency}`);
  }

  try {
    // Get rates with fromCurrency as base
    const ratesData = await fetchExchangeRates(fromCurrency);
    const rate = ratesData.rates[toCurrency];

    if (!rate) {
      throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
    }

    // Convert and round to 2 decimal places
    const converted = amount * rate;
    return Math.round(converted * 100) / 100;
  } catch (error) {
    console.error('[Currency Service] Conversion error:', error.message);
    throw error;
  }
}

/**
 * Convert amount to base currency (INR)
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @returns {Promise<number>} Amount in base currency
 */
async function convertToBaseCurrency(amount, fromCurrency) {
  return convertCurrency(amount, fromCurrency, BASE_CURRENCY);
}

/**
 * Get exchange rate between two currencies
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {Promise<number>} Exchange rate
 */
async function getExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  const ratesData = await fetchExchangeRates(fromCurrency);
  const rate = ratesData.rates[toCurrency];

  if (!rate) {
    throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
  }

  return rate;
}

/**
 * Get all supported currencies
 * @returns {Array<string>} List of supported currency codes
 */
function getSupportedCurrencies() {
  return [...SUPPORTED_CURRENCIES];
}

/**
 * Check if currency is supported
 * @param {string} currencyCode - Currency code to check
 * @returns {boolean} True if supported
 */
function isCurrencySupported(currencyCode) {
  return SUPPORTED_CURRENCIES.includes(currencyCode);
}

/**
 * Clear rate cache (useful for testing or manual refresh)
 */
function clearCache() {
  rateCache.flushAll();
  console.log('[Currency Service] Cache cleared');
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
function getCacheStats() {
  return {
    keys: rateCache.keys(),
    stats: rateCache.getStats(),
  };
}

export {
  BASE_CURRENCY,
  SUPPORTED_CURRENCIES,
  fetchExchangeRates,
  convertCurrency,
  convertToBaseCurrency,
  getExchangeRate,
  getSupportedCurrencies,
  isCurrencySupported,
  clearCache,
  getCacheStats,
};
