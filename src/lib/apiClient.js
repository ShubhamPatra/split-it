const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Request cache and pending requests for deduplication
const requestCache = new Map();
const pendingRequests = new Map();
const CACHE_TTL = 5000; // 5 seconds
const MAX_CACHE_SIZE = 100;  // Add size limit

// Track if we're currently refreshing to avoid multiple refresh calls
let isRefreshing = false;
let refreshPromise = null;

// Add cache cleanup function
const cleanupCache = () => {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      requestCache.delete(key);
    }
  }
  
  // If still too large, remove oldest entries
  if (requestCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(requestCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, requestCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => requestCache.delete(key));
  }
};

// Run cleanup every 10 seconds
setInterval(cleanupCache, 10000);

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
        setTimeout(() => window.location.href = '/login', 100);
        throw new Error('Session expired. Please login again.');
      case 403:
        throw new Error('You do not have permission to perform this action');
      case 404:
        throw new Error('The requested resource was not found');
      case 429:
        throw new Error('Too many requests. Please slow down.');
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
const makeRequest = async (url, options, retries = 1, cacheKey = null) => {
  // Check if we're offline
  if (!navigator.onLine) {
    throw new Error('No internet connection. Please check your network.');
  }

  // Check cache for GET requests
  if (options.method === 'GET' && cacheKey) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Check if request is already pending (deduplication)
    const pending = pendingRequests.get(cacheKey);
    if (pending) {
      return pending;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15 seconds instead of 30

  const requestPromise = (async () => {
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      const data = await handleResponse(response, { url, options });

      // Cache successful GET requests
      if (options.method === 'GET' && cacheKey) {
        requestCache.set(cacheKey, { data, timestamp: Date.now() });
      }

      return data;
    } catch (error) {
      clearTimeout(timeout);
      
      // Handle abort/timeout
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your connection.');
      }
      
      // Retry on network errors
      if (retries > 0 && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        return makeRequest(url, options, retries - 1, cacheKey);
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
const clearCache = () => {
  requestCache.clear();
  pendingRequests.clear();
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
    // Clear cache on mutations
    clearCache();
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
    // Clear cache on mutations
    clearCache();
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
    // Clear cache on mutations
    clearCache();
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
