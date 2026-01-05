const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Request cache and pending requests for deduplication
const requestCache = new Map();
const pendingRequests = new Map();
const CACHE_TTL = 5000; // 5 seconds

// Get token from localStorage
const getToken = () => {
  try {
    const session = localStorage.getItem('splitit_session');
    if (session) {
      const { token } = JSON.parse(session);
      return token;
    }
  } catch (error) {
    console.error('Error reading session:', error);
    localStorage.removeItem('splitit_session');
  }
  return null;
};

// Helper to handle API responses with better error handling
const handleResponse = async (response) => {
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
        // Token expired or invalid - clear session
        localStorage.removeItem('splitit_session');
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
  // Allow all requests to proceed so SW can handle offline/cache/background sync

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
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  const requestPromise = (async () => {
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      const data = await handleResponse(response);

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

  // Store pending request for deduplication
  if (options.method === 'GET' && cacheKey) {
    pendingRequests.set(cacheKey, requestPromise);
  }

  return requestPromise;
};


// Selective cache invalidation utility
const clearCache = (predicate) => {
  if (!predicate) {
    requestCache.clear();
    pendingRequests.clear();
    return;
  }
  for (const key of Array.from(requestCache.keys())) {
    if (predicate(key)) requestCache.delete(key);
  }
  for (const key of Array.from(pendingRequests.keys())) {
    if (predicate(key)) pendingRequests.delete(key);
  }
};

// Helper to update cache optimistically
const updateCache = (cacheKey, updater) => {
  if (requestCache.has(cacheKey)) {
    const entry = requestCache.get(cacheKey);
    const updated = updater(entry.data);
    requestCache.set(cacheKey, { data: updated, timestamp: Date.now() });
  }
};

// Create axios-like API client
const apiClient = {

  get: async (endpoint) => {
    const token = getToken();
    const cacheKey = `GET:${endpoint}:${token || 'anon'}`;
    return makeRequest(
      `${API_URL}${endpoint}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      },
      1,
      cacheKey
    );
  },


  post: async (endpoint, body, { optimisticKey, optimisticUpdater, rollbackUpdater } = {}) => {
    const token = getToken();
    // Optimistic update
    let previousData;
    if (optimisticKey && optimisticUpdater) {
      if (requestCache.has(optimisticKey)) {
        previousData = requestCache.get(optimisticKey).data;
        updateCache(optimisticKey, optimisticUpdater);
      }
    }
    // Selective cache invalidation
    clearCache(key => key.includes(endpoint.split('/')[1]));
    try {
      const result = await makeRequest(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(body),
      });
      return result;
    } catch (error) {
      // Rollback on error
      if (optimisticKey && rollbackUpdater && previousData) {
        requestCache.set(optimisticKey, { data: rollbackUpdater(previousData), timestamp: Date.now() });
      }
      throw error;
    }
  },


  put: async (endpoint, body, { optimisticKey, optimisticUpdater, rollbackUpdater } = {}) => {
    const token = getToken();
    let previousData;
    if (optimisticKey && optimisticUpdater) {
      if (requestCache.has(optimisticKey)) {
        previousData = requestCache.get(optimisticKey).data;
        updateCache(optimisticKey, optimisticUpdater);
      }
    }
    clearCache(key => key.includes(endpoint.split('/')[1]));
    try {
      const result = await makeRequest(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(body),
      });
      return result;
    } catch (error) {
      if (optimisticKey && rollbackUpdater && previousData) {
        requestCache.set(optimisticKey, { data: rollbackUpdater(previousData), timestamp: Date.now() });
      }
      throw error;
    }
  },


  delete: async (endpoint, { optimisticKey, optimisticUpdater, rollbackUpdater } = {}) => {
    const token = getToken();
    let previousData;
    if (optimisticKey && optimisticUpdater) {
      if (requestCache.has(optimisticKey)) {
        previousData = requestCache.get(optimisticKey).data;
        updateCache(optimisticKey, optimisticUpdater);
      }
    }
    clearCache(key => key.includes(endpoint.split('/')[1]));
    try {
      const result = await makeRequest(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      return result;
    } catch (error) {
      if (optimisticKey && rollbackUpdater && previousData) {
        requestCache.set(optimisticKey, { data: rollbackUpdater(previousData), timestamp: Date.now() });
      }
      throw error;
    }
  },

  // Utility to manually clear cache
  clearCache,
};

export default apiClient;
