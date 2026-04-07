import { getFrontendUrl } from '../utils/frontendPaths';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Request cache and pending requests for deduplication
const requestCache = new Map();
const pendingRequests = new Map();
const etagCache = new Map(); // Store ETags for conditional requests
const CACHE_TTL = 5000; // 5 seconds for regular cache
const STATIC_CACHE_TTL = 300000; // 5 minutes for static data (user profiles, group members)
const MAX_CACHE_SIZE = 100;  // Add size limit

// Define which endpoints should use longer cache TTL
const STATIC_ENDPOINTS = [
  '/users/', // User profiles
  '/groups/', // Group details (when not mutating)
];

// Check if endpoint is static (should use longer cache)
const isStaticEndpoint = (endpoint) => {
  return STATIC_ENDPOINTS.some(pattern => endpoint.includes(pattern));
};

// 429 rate limit tracking
const rateLimitTracking = new Map(); // key -> { retryAfter, resetTime }

// Track if we're currently refreshing to avoid multiple refresh calls
let isRefreshing = false;
let refreshPromise = null;

// Add cache cleanup function
const cleanupCache = () => {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    const ttl = isStaticEndpoint(key) ? STATIC_CACHE_TTL : CACHE_TTL;
    if (now - value.timestamp > ttl) {
      requestCache.delete(key);
      etagCache.delete(key); // Clean up associated ETag
    }
  }

  // If still too large, remove oldest entries
  if (requestCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(requestCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, requestCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => {
      requestCache.delete(key);
      etagCache.delete(key);
    });
  }
};

// Clean up rate limit tracking (remove entries past their reset time)
const cleanupRateLimitTracking = () => {
  const now = Date.now();
  for (const [key, value] of rateLimitTracking.entries()) {
    if (now > value.resetTime) {
      rateLimitTracking.delete(key);
    }
  }
};

// Exponential backoff with jitter for 429 responses
const calculateBackoffDelay = (retryCount, retryAfter = null) => {
  if (retryAfter) {
    return retryAfter;
  }

  // Exponential backoff: 2^retryCount * 100ms, max 32 seconds
  const baseDelay = Math.min(Math.pow(2, retryCount) * 100, 32000);
  // Add jitter: ±25% of baseDelay
  const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(100, baseDelay + jitter);
};

// Run cleanup every 10 seconds
setInterval(() => {
  cleanupCache();
  cleanupRateLimitTracking();
}, 10000);

// Try to refresh the access token (Comment 11)
const tryRefreshToken = async () => {
  if (isRefreshing) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const data = await response.json();
      if (data.success && data.user) {
        // Update session storage with refreshed user data
        const session = {
          user: data.user,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
        sessionStorage.setItem('splitit_user', JSON.stringify(session));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// Helper to handle API responses with better error handling
const handleResponse = async (response, originalRequest = null) => {
  let data;
  try {
    data = await response.json();
  } catch (error) {
    // Handle non-JSON responses
    if (response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    throw new Error('Unable to process server response');
  }

  if (!response.ok) {
    // Handle specific error codes
    switch (response.status) {
      case 401:
        // Try to refresh token before giving up (Comment 11)
        if (originalRequest && !originalRequest._retried) {
          const refreshed = await tryRefreshToken();
          if (refreshed) {
            // Retry the original request
            originalRequest._retried = true;
            const retryResponse = await fetch(originalRequest.url, {
              ...originalRequest.options,
              credentials: 'include',
            });
            return handleResponse(retryResponse);
          }
        }
        // Session expired or invalid - clear session storage
        sessionStorage.removeItem('splitit_user');
        setTimeout(() => window.location.href = getFrontendUrl('/login'), 100);
        throw new Error('Session expired. Please login again.');
      case 403:
        throw new Error('You do not have permission to perform this action');
      case 404:
        throw new Error('The requested resource was not found');
      case 429:
        // Rate limited - pass error with retry-after header to makeRequest for backoff retry
        const retryAfter = response.headers.get('Retry-After');
        const error = new Error(data.message || 'Too many requests. Please wait a moment before trying again.');
        error.status = 429;
        error.retryAfter = retryAfter ? parseInt(retryAfter) * 1000 : null; // Convert to ms
        throw error;
      case 500:
      case 502:
      case 503:
        throw new Error('Server error. Please try again later.');
      default:
        throw new Error(data.message || `Request failed with status ${response.status}`);
    }
  }

  return data;
};

// Helper to make requests with timeout and retry logic
const makeRequest = async (url, options, retries = 1, cacheKey = null, retryCount = 0) => {
  // Check if we're offline
  if (!navigator.onLine) {
    throw new Error('No internet connection. Please check your network.');
  }

  // Check cache for GET requests
  if (options.method === 'GET' && cacheKey) {
    const cached = requestCache.get(cacheKey);
    const ttl = isStaticEndpoint(cacheKey) ? STATIC_CACHE_TTL : CACHE_TTL;

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    // Check if request is already pending (deduplication)
    const pending = pendingRequests.get(cacheKey);
    if (pending) {
      return pending;
    }

    // Add If-None-Match header for ETag support
    const etag = etagCache.get(cacheKey);
    if (etag && cached) {
      options.headers = {
        ...options.headers,
        'If-None-Match': etag,
      };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15 seconds instead of 30

  const requestPromise = (async () => {
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);

      // Handle 304 Not Modified - return cached data
      if (response.status === 304 && cacheKey) {
        const cached = requestCache.get(cacheKey);
        if (cached) {
          // Update timestamp to extend cache
          cached.timestamp = Date.now();
          return cached.data;
        }
        // Cache miss on 304 - re-fetch without conditional header
        // This can happen if cache was evicted between request and response
        console.warn('304 received but cache miss, re-fetching:', cacheKey);
        const refetchOptions = { ...options };
        delete refetchOptions.headers?.['If-None-Match'];
        const refetchResponse = await fetch(url, { ...refetchOptions, signal: controller.signal });
        const refetchData = await handleResponse(refetchResponse, { url, options: refetchOptions });
        requestCache.set(cacheKey, { data: refetchData, timestamp: Date.now() });
        const newEtag = refetchResponse.headers.get('ETag');
        if (newEtag) {
          etagCache.set(cacheKey, newEtag);
        }
        return refetchData;
      }

      const data = await handleResponse(response, { url, options });

      // Cache successful GET requests
      if (options.method === 'GET' && cacheKey) {
        requestCache.set(cacheKey, { data, timestamp: Date.now() });

        // Store ETag if present
        const etag = response.headers.get('ETag');
        if (etag) {
          etagCache.set(cacheKey, etag);
        }
      }

      return data;
    } catch (error) {
      clearTimeout(timeout);

      // Handle abort/timeout
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your connection.');
      }

      // Handle 429 rate limit with exponential backoff retry
      if (error.status === 429) {
        const maxRetries = 3;
        if (retryCount < maxRetries) {
          const backoffDelay = calculateBackoffDelay(retryCount, error.retryAfter);
          console.warn(`Rate limited (429). Retrying after ${backoffDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);

          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return makeRequest(url, options, retries, cacheKey, retryCount + 1);
        } else {
          console.error('Rate limit retry exhausted after', maxRetries, 'attempts');
          throw new Error('Rate limit exceeded. Please try again later.');
        }
      }

      // Retry on network errors
      if (retries > 0 && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        return makeRequest(url, options, retries - 1, cacheKey, retryCount);
      }

      throw error;
    } finally {
      // Clean up pending request
      if (cacheKey) {
        pendingRequests.delete(cacheKey);
      }
    }
  })();

  // Store pending request IMMEDIATELY for deduplication (BEFORE any await)
  // This fixes the race condition where multiple calls can pass the check above
  if (options.method === 'GET' && cacheKey) {
    pendingRequests.set(cacheKey, requestPromise);
  }

  return requestPromise;
};

// Clear cache utility
const clearCache = (selective = false, endpoint = null) => {
  if (selective && endpoint) {
    // Clear only caches related to specific endpoint
    for (const [key] of requestCache.entries()) {
      if (key.includes(endpoint)) {
        requestCache.delete(key);
        etagCache.delete(key);
      }
    }
  } else {
    // Clear all caches
    requestCache.clear();
    pendingRequests.clear();
    etagCache.clear();
  }
};

// Get cache statistics
const getCacheStats = () => {
  return {
    size: requestCache.size,
    pendingRequests: pendingRequests.size,
    etags: etagCache.size,
    entries: Array.from(requestCache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
      hasEtag: etagCache.has(key),
    })),
  };
};

// Create axios-like API client using HttpOnly cookie auth
const apiClient = {
  get: async (endpoint) => {
    const cacheKey = `GET:${endpoint}`;
    return makeRequest(
      `${API_URL}${endpoint}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send HttpOnly cookies
      },
      1,
      cacheKey
    );
  },

  post: async (endpoint, body) => {
    // Selective cache clearing - only clear related caches
    if (endpoint.includes('/expenses')) {
      clearCache(true, '/expenses');
      clearCache(true, '/groups'); // Groups contain expenses
    } else if (endpoint.includes('/settlements')) {
      clearCache(true, '/settlements');
      clearCache(true, '/groups'); // Groups contain settlements
    } else if (endpoint.includes('/groups')) {
      clearCache(true, '/groups');
    } else {
      // Clear all cache for other mutations
      clearCache();
    }

    return makeRequest(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Send HttpOnly cookies
      body: JSON.stringify(body),
    });
  },

  put: async (endpoint, body) => {
    // Selective cache clearing
    if (endpoint.includes('/expenses')) {
      clearCache(true, '/expenses');
      clearCache(true, '/groups');
    } else if (endpoint.includes('/settlements')) {
      clearCache(true, '/settlements');
      clearCache(true, '/groups');
    } else if (endpoint.includes('/groups')) {
      clearCache(true, '/groups');
    } else if (endpoint.includes('/users')) {
      clearCache(true, '/users');
    } else {
      clearCache();
    }

    return makeRequest(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Send HttpOnly cookies
      body: JSON.stringify(body),
    });
  },

  delete: async (endpoint) => {
    // Selective cache clearing
    if (endpoint.includes('/expenses')) {
      clearCache(true, '/expenses');
      clearCache(true, '/groups');
    } else if (endpoint.includes('/settlements')) {
      clearCache(true, '/settlements');
      clearCache(true, '/groups');
    } else if (endpoint.includes('/groups')) {
      clearCache(true, '/groups');
    } else {
      clearCache();
    }

    return makeRequest(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Send HttpOnly cookies
    });
  },

  // Utility to manually clear cache
  clearCache,

  // Utility to get cache statistics
  getCacheStats,
};

// Export abort controller for component cleanup
export const createCancellableRequest = () => {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
};

export default apiClient;
