/**
 * Debounce utility to prevent rapid consecutive function calls
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {Object} options - Optional configuration
 * @param {boolean} options.leading - Call function on leading edge
 * @param {boolean} options.trailing - Call function on trailing edge (default: true)
 * @returns {Function} Debounced function
 */
export const debounce = (fn, delay, options = {}) => {
  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;
  const { leading = false, trailing = true } = options;
  let lastCallTime = 0;
  let lastInvokeTime = 0;

  const invokeFunc = () => {
    if (lastArgs !== null) {
      fn.apply(lastThis, lastArgs);
      lastInvokeTime = Date.now();
      lastArgs = null;
      lastThis = null;
    }
  };

  const debounced = function (...args) {
    const time = Date.now();
    const isInvoking = leading && (lastCallTime === 0 || time - lastCallTime >= delay);

    lastCallTime = time;
    lastArgs = args;
    lastThis = this;

    clearTimeout(timeoutId);

    if (isInvoking) {
      invokeFunc();
    } else if (trailing) {
      timeoutId = setTimeout(invokeFunc, delay);
    }

    return lastInvokeTime;
  };

  debounced.cancel = () => {
    clearTimeout(timeoutId);
    lastArgs = null;
    lastThis = null;
  };

  debounced.flush = () => {
    if (timeoutId) {
      invokeFunc();
      clearTimeout(timeoutId);
    }
  };

  return debounced;
};

/**
 * Request deduplicator - returns same promise for in-flight requests
 * @returns {Object} Object with track and get methods
 */
export const createRequestDeduplicator = () => {
  const pendingRequests = new Map();

  return {
    // Track a request and return a promise
    track: (key, promiseFn) => {
      if (pendingRequests.has(key)) {
        return pendingRequests.get(key);
      }

      const promise = promiseFn()
        .then(result => {
          pendingRequests.delete(key);
          return result;
        })
        .catch(error => {
          pendingRequests.delete(key);
          throw error;
        });

      pendingRequests.set(key, promise);
      return promise;
    },

    // Get existing request if any
    get: (key) => {
      return pendingRequests.get(key);
    },

    // Clear all pending requests
    clear: () => {
      pendingRequests.clear();
    },

    // Clear specific request
    clearKey: (key) => {
      pendingRequests.delete(key);
    },
  };
};
