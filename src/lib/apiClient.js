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

// Clear cache utility
const clearCache = () => {
  requestCache.clear();
  pendingRequests.clear();
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

  post: async (endpoint, body) => {
    const token = getToken();
    // Clear cache on mutations
    clearCache();
    return makeRequest(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });
  },

  put: async (endpoint, body) => {
    const token = getToken();
    // Clear cache on mutations
    clearCache();
    return makeRequest(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });
  },

  delete: async (endpoint) => {
    const token = getToken();
    // Clear cache on mutations
    clearCache();
    return makeRequest(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
  },

  // Utility to manually clear cache
  clearCache,
};

export default apiClient;
