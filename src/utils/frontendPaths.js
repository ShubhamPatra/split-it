const getBasePath = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const publicUrl = process.env.PUBLIC_URL || '/';

  if (!publicUrl || publicUrl === '/') {
    return '';
  }

  try {
    const pathname = new URL(publicUrl, window.location.origin).pathname;
    return pathname === '/' ? '' : pathname.replace(/\/$/, '');
  } catch (error) {
    const fallbackPath = publicUrl.startsWith('/') ? publicUrl : `/${publicUrl}`;
    return fallbackPath === '/' ? '' : fallbackPath.replace(/\/$/, '');
  }
};

export const getRouterBasename = () => {
  const basePath = getBasePath();
  return basePath || undefined;
};

export const getFrontendPath = (pathname = '/') => {
  const basePath = getBasePath();
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (!basePath) {
    return normalizedPath;
  }

  return `${basePath}${normalizedPath}`;
};

export const getFrontendUrl = (pathname = '/') => {
  if (typeof window === 'undefined') {
    return pathname;
  }

  return `${window.location.origin}${getFrontendPath(pathname)}`;
};