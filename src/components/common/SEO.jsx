import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://split-it.live';
const DEFAULT_TITLE = 'Split-It - Expense Sharing Made Easy';
const DEFAULT_DESCRIPTION = 'Split-It - Easily split expenses with friends, track group spending, and settle up seamlessly. The modern expense sharing app for groups, roommates, and trips.';

/**
 * SEO component for managing meta tags and canonical URLs
 * @param {Object} props
 * @param {string} [props.title] - Page title (will be appended with site name)
 * @param {string} [props.description] - Page description
 * @param {boolean} [props.noIndex] - Whether to add noindex meta tag
 */
const SEO = ({ title, description, noIndex = false }) => {
  const location = useLocation();
  
  // Build canonical URL (always non-www, no trailing slash except for root)
  const pathname = location.pathname === '/' ? '/' : location.pathname.replace(/\/$/, '');
  const canonicalUrl = `${SITE_URL}${pathname}`;
  
  const pageTitle = title ? `${title} | Split-It` : DEFAULT_TITLE;
  const pageDescription = description || DEFAULT_DESCRIPTION;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <link rel="canonical" href={canonicalUrl} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
    </Helmet>
  );
};

export default SEO;
