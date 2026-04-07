const normalizeApiOrigin = (url) => {
  const trimmed = (url || '').replace(/\/$/, '');

  if (!trimmed) {
    return '';
  }

  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
};

export const getApiBaseUrl = () => {
  const configuredUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  return normalizeApiOrigin(configuredUrl) || 'http://localhost:5000';
};

export const getApiOriginUrl = () => {
  const configuredUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const normalizedOrigin = normalizeApiOrigin(configuredUrl);

  return normalizedOrigin || 'http://localhost:5000';
};