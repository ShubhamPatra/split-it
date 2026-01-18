/**
 * Split-It Email Template System
 * 
 * Professional fintech-grade, responsive, and accessible email templates
 * Aligned with Split-It brand design system
 * 
 * Brand Colors:
 * - Primary: #0b1f32 (dark navy)
 * - Accent: #0d9488 (teal)
 * - Action: #1a6bff (blue)
 * - Success: #0d9488 (teal)
 * - Warning: #FBBF24
 * - Danger: #EF4444
 * - Background: #f8f9fa
 * - Card: #FFFFFF
 * - Border: #e5e7eb
 * - Text Primary: #0b1f32
 * - Text Muted: #9ca3af
 */

// ============================================
// BRAND CONFIGURATION
// ============================================

const brand = {
  name: 'Split-It',
  logo: '', // Removed emoji for professional look
  // Logo URL - publicly accessible logo for emails
  logoUrl: process.env.LOGO_URL || 'https://split-it.live/icon-192.png',
  logoAlt: 'Split-It Logo',
  logoWidth: 40,
  logoHeight: 40,
  colors: {
    primary: '#0b1f32',
    primaryDark: '#081825',
    primaryLight: '#0e2538',
    accent: '#0d9488',
    accentLight: '#ccfbf1',
    action: '#1a6bff',
    actionDark: '#1557d6',
    success: '#0d9488',
    successLight: '#ccfbf1',
    successDark: '#0f766e',
    warning: '#FBBF24',
    warningLight: '#FEF3C7',
    warningDark: '#D97706',
    danger: '#EF4444',
    dangerLight: '#FEF2F2',
    dangerDark: '#DC2626',
    info: '#3B82F6',
    infoLight: '#EFF6FF',
    background: '#f8f9fa',
    card: '#FFFFFF',
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    textPrimary: '#0b1f32',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    textLight: '#9ca3af',
  },
  fonts: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    headingFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    sizeSmall: '12px',
    sizeBase: '13px',
    sizeMedium: '15px',
    sizeLarge: '18px',
    sizeXL: '22px',
    size2XL: '28px',
    size3XL: '36px',
    letterSpacing: '-0.025em',
  },
  spacing: {
    xs: '4px',
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
    xxl: '28px',
    xxxl: '40px',
  },
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
  },
  email: process.env.SMTP_FROM || 'notifications.splitit@gmail.com',
  supportEmail: 'notifications.splitit@gmail.com',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format currency with proper symbol
 */
const formatCurrency = (amount, currency = 'INR') => {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Format date in readable format
 */
const formatDate = (date, options = {}) => {
  const defaultOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };
  return new Date(date).toLocaleDateString('en-IN', { ...defaultOptions, ...options });
};

/**
 * Get current year
 */
const getCurrentYear = () => new Date().getFullYear();

// ============================================
// EMAIL COMPONENT BUILDERS
// ============================================

/**
 * Generate email wrapper/shell
 */
const emailWrapper = (content) => `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${brand.name}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <!-- Google Fonts Import -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    /* Font imports for email clients that support @import */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
    
    /* Reset styles */
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    
    /* Responsive styles */
    @media screen and (max-width: 600px) {
      .wrapper { width: 100% !important; padding: 10px !important; }
      .content { padding: 18px !important; }
      .header { padding: 18px !important; }
      .footer { padding: 18px !important; }
      .button { width: 100% !important; display: block !important; }
      .button-td { padding-left: 0 !important; padding-right: 0 !important; }
      .stats-table td { display: block !important; width: 100% !important; padding: 10px 0 !important; }
      .hide-mobile { display: none !important; }
      .stack-mobile { display: block !important; width: 100% !important; }
      h1 { font-size: 22px !important; }
      h2 { font-size: 18px !important; }
      .amount-large { font-size: 28px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${brand.colors.background}; font-family: ${brand.fonts.family};">
  <!-- Preheader text (hidden) -->
  <div style="display: none; max-height: 0px; overflow: hidden;">
    &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
  </div>
  
  <!-- Email container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${brand.colors.background};">
    <tr>
      <td align="center" style="padding: 20px 14px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="wrapper" style="max-width: 600px; width: 100%;">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * Email header component
 */
const emailHeader = (options = {}) => {
  const {
    title = '',
    subtitle = '',
    variant = 'default', // default, success, warning, danger
  } = options;

  const variants = {
    default: { bg: brand.colors.primary, text: '#FFFFFF' },
    success: { bg: brand.colors.success, text: '#FFFFFF' },
    warning: { bg: brand.colors.warning, text: '#0b1f32' },
    danger: { bg: brand.colors.danger, text: '#FFFFFF' },
  };

  const v = variants[variant] || variants.default;

  return `
  <!-- Header -->
  <tr>
    <td>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <!-- Top accent bar -->
        <tr>
          <td style="height: 2px; background-color: ${v.bg}; border-radius: ${brand.borderRadius.lg} ${brand.borderRadius.lg} 0 0;"></td>
        </tr>
        <!-- Logo row -->
        <tr>
          <td align="center" style="background-color: ${v.bg}; padding: 20px 28px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                ${brand.logoUrl ? `
                <td style="vertical-align: middle;">
                  <img src="${brand.logoUrl}" alt="${brand.logoAlt}" width="${brand.logoWidth}" height="${brand.logoHeight}" style="display: block; border: 0; outline: none; text-decoration: none;" />
                </td>
                <td style="vertical-align: middle; padding-left: 10px;">
                  <span style="font-family: ${brand.fonts.headingFamily}; font-size: 22px; font-weight: 600; color: ${v.text}; letter-spacing: ${brand.fonts.letterSpacing};">
                    ${brand.name}
                  </span>
                </td>
                ` : `
                <td style="vertical-align: middle;">
                  <span style="font-family: ${brand.fonts.headingFamily}; font-size: 22px; font-weight: 600; color: ${v.text}; letter-spacing: ${brand.fonts.letterSpacing};">
                    ${brand.name}
                  </span>
                </td>
                `}
              </tr>
            </table>
          </td>
        </tr>
        <!-- Title section -->
        ${title ? `
        <tr>
          <td align="center" class="header" style="background-color: ${brand.colors.card}; padding: 24px 28px; border-left: 1px solid ${brand.colors.border}; border-right: 1px solid ${brand.colors.border};">
            <h1 style="margin: 0; font-family: ${brand.fonts.headingFamily}; font-size: ${brand.fonts.sizeXL}; font-weight: 600; color: ${brand.colors.textPrimary}; line-height: 1.3; letter-spacing: ${brand.fonts.letterSpacing};">
              ${title}
            </h1>
            ${subtitle ? `<p style="margin: 6px 0 0; font-size: ${brand.fonts.sizeMedium}; color: ${brand.colors.textSecondary};">${subtitle}</p>` : ''}
          </td>
        </tr>
        ` : ''}
      </table>
    </td>
  </tr>
  `;
};

/**
 * Email content section
 */
const emailContent = (content) => `
  <!-- Content -->
  <tr>
    <td class="content" style="background-color: ${brand.colors.card}; padding: 28px; border-left: 1px solid ${brand.colors.border}; border-right: 1px solid ${brand.colors.border};">
      ${content}
    </td>
  </tr>
`;

/**
 * Email footer component
 */
const emailFooter = (options = {}) => {
  const {
    showPreferences = true,
    showSupport = true,
    showUnsubscribe = false,
  } = options;

  return `
  <!-- Footer -->
  <tr>
    <td style="background-color: ${brand.colors.borderLight}; padding: 20px 28px; border: 1px solid ${brand.colors.border}; border-top: none; border-radius: 0 0 ${brand.borderRadius.lg} ${brand.borderRadius.lg};">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td align="center">
            ${showPreferences ? `
            <p style="margin: 0 0 10px; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textMuted};">
              <a href="${brand.clientUrl}/settings/notifications" style="color: ${brand.colors.action}; text-decoration: none;">Manage email preferences</a>
            </p>
            ` : ''}
            ${showSupport ? `
            <p style="margin: 0 0 10px; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textMuted};">
              Need help? Contact us at 
              <a href="mailto:${brand.supportEmail}" style="color: ${brand.colors.action}; text-decoration: none;">${brand.supportEmail}</a>
            </p>
            ` : ''}
            ${showUnsubscribe ? `
            <p style="margin: 0 0 10px; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textLight};">
              <a href="${brand.clientUrl}/unsubscribe" style="color: ${brand.colors.textMuted}; text-decoration: underline;">Unsubscribe</a>
            </p>
            ` : ''}
            <p style="margin: 10px 0 0; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textLight};">
              ${getCurrentYear()} ${brand.name}. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  `;
};

/**
 * CTA Button component
 */
const buttonComponent = (text, url, options = {}) => {
  const {
    variant = 'primary', // primary, secondary, success, warning, danger, outline
    size = 'medium', // small, medium, large
    fullWidth = false,
  } = options;

  const variants = {
    primary: { bg: brand.colors.action, text: '#FFFFFF', border: brand.colors.action },
    secondary: { bg: brand.colors.textPrimary, text: '#FFFFFF', border: brand.colors.textPrimary },
    success: { bg: brand.colors.success, text: '#FFFFFF', border: brand.colors.success },
    warning: { bg: brand.colors.warning, text: '#0b1f32', border: brand.colors.warning },
    danger: { bg: brand.colors.danger, text: '#FFFFFF', border: brand.colors.danger },
    outline: { bg: 'transparent', text: brand.colors.action, border: brand.colors.action },
  };

  const sizes = {
    small: { padding: '8px 18px', fontSize: brand.fonts.sizeBase },
    medium: { padding: '12px 24px', fontSize: brand.fonts.sizeMedium },
    large: { padding: '14px 32px', fontSize: brand.fonts.sizeMedium },
  };

  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.medium;

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" ${fullWidth ? 'width="100%"' : ''} style="margin: 0 auto;">
    <tr>
      <td class="button-td" style="border-radius: ${brand.borderRadius.md}; background-color: ${v.bg}; border: 1px solid ${v.border};">
        <a href="${url}" class="button" target="_blank" style="display: inline-block; padding: ${s.padding}; font-family: ${brand.fonts.family}; font-size: ${s.fontSize}; font-weight: 500; color: ${v.text}; text-decoration: none; border-radius: ${brand.borderRadius.md}; ${fullWidth ? 'width: 100%; text-align: center; box-sizing: border-box;' : ''}">
          ${text}
        </a>
      </td>
    </tr>
  </table>
  `;
};

/**
 * Card/Section component
 */
const cardComponent = (content, options = {}) => {
  const {
    variant = 'default', // default, success, warning, danger, info
    padding = 'medium', // small, medium, large
  } = options;

  const variants = {
    default: { bg: brand.colors.card, border: brand.colors.border },
    success: { bg: brand.colors.card, border: brand.colors.border },
    warning: { bg: brand.colors.card, border: brand.colors.border },
    danger: { bg: brand.colors.card, border: brand.colors.border },
    info: { bg: brand.colors.card, border: brand.colors.border },
  };

  const paddings = {
    small: '10px 14px',
    medium: '14px 18px',
    large: '18px 22px',
  };

  const v = variants[variant] || variants.default;
  const p = paddings[padding] || paddings.medium;

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 14px 0;">
    <tr>
      <td style="background-color: ${v.bg}; border: 1px solid ${v.border}; border-radius: ${brand.borderRadius.md}; padding: ${p};">
        ${content}
      </td>
    </tr>
  </table>
  `;
};

/**
 * Alert box component
 */
const alertComponent = (message, options = {}) => {
  const {
    variant = 'info', // success, warning, danger, info
  } = options;

  const variants = {
    success: { bg: '#f0fdf4', border: brand.colors.success, text: '#166534' },
    warning: { bg: '#fffbeb', border: brand.colors.warning, text: '#92400E' },
    danger: { bg: '#fef2f2', border: brand.colors.danger, text: '#991B1B' },
    info: { bg: '#eff6ff', border: brand.colors.info, text: '#1E40AF' },
  };

  const v = variants[variant] || variants.info;

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 14px 0;">
    <tr>
      <td style="background-color: ${v.bg}; border-left: 4px solid ${v.border}; border-radius: ${brand.borderRadius.md}; padding: 14px 16px;">
        <p style="margin: 0; font-family: ${brand.fonts.family}; font-size: ${brand.fonts.sizeBase}; color: ${v.text}; line-height: 1.5;">
          ${message}
        </p>
      </td>
    </tr>
  </table>
  `;
};

/**
 * Info row component (for details lists)
 */
const infoRowComponent = (label, value, options = {}) => {
  const { highlight = false } = options;
  return `
  <tr>
    <td style="padding: 8px 0; font-size: ${brand.fonts.sizeBase}; color: ${brand.colors.textMuted}; border-bottom: 1px solid ${brand.colors.borderLight};">
      ${label}
    </td>
    <td style="padding: 8px 0; font-size: ${brand.fonts.sizeBase}; font-weight: ${highlight ? '600' : '500'}; color: ${highlight ? brand.colors.accent : brand.colors.textPrimary}; text-align: right; border-bottom: 1px solid ${brand.colors.borderLight}; font-variant-numeric: tabular-nums;">
      ${value}
    </td>
  </tr>
  `;
};

/**
 * Table wrapper component
 */
const tableComponent = (headers, rows, options = {}) => {
  const { variant = 'default' } = options;

  const headerHtml = headers.map((h, i) => `
    <th style="padding: 10px 14px; text-align: ${i === 0 ? 'left' : 'right'}; font-size: ${brand.fonts.sizeSmall}; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; color: ${brand.colors.textMuted}; background-color: ${brand.colors.borderLight}; border-bottom: 1px solid ${brand.colors.border};">
      ${h}
    </th>
  `).join('');

  const rowsHtml = rows.map(row => `
    <tr>
      ${row.map((cell, i) => `
        <td style="padding: 10px 14px; text-align: ${i === 0 ? 'left' : 'right'}; font-size: ${brand.fonts.sizeBase}; color: ${brand.colors.textPrimary}; border-bottom: 1px solid ${brand.colors.borderLight};">
          ${cell}
        </td>
      `).join('')}
    </tr>
  `).join('');

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 14px 0; border-collapse: collapse;">
    <thead>
      <tr>${headerHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  `;
};

/**
 * Amount display component (for large currency displays)
 */
const amountDisplayComponent = (amount, options = {}) => {
  const {
    currency = 'INR',
    variant = 'default', // default, success, danger
    label = '',
    sublabel = '',
  } = options;

  const variants = {
    default: brand.colors.textPrimary,
    success: brand.colors.accent,
    danger: brand.colors.danger,
    primary: brand.colors.primary,
  };

  const color = variants[variant] || variants.default;
  const formattedAmount = formatCurrency(amount, currency);

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 14px 0;">
    <tr>
      <td align="center">
        ${label ? `<p style="margin: 0 0 4px; font-size: ${brand.fonts.sizeSmall}; text-transform: uppercase; letter-spacing: 0.5px; color: ${brand.colors.textMuted};">${label}</p>` : ''}
        <p class="amount-large" style="margin: 0; font-size: ${brand.fonts.size2XL}; font-weight: 600; color: ${color}; font-variant-numeric: tabular-nums;">
          ${formattedAmount}
        </p>
        ${sublabel ? `<p style="margin: 4px 0 0; font-size: ${brand.fonts.sizeBase}; color: ${brand.colors.textMuted};">${sublabel}</p>` : ''}
      </td>
    </tr>
  </table>
  `;
};

/**
 * Progress bar component
 */
const progressBarComponent = (percentage, options = {}) => {
  const {
    variant = 'primary', // primary, success, warning, danger
    showLabel = true,
  } = options;

  const variants = {
    primary: brand.colors.accent,
    success: brand.colors.success,
    warning: brand.colors.warning,
    danger: brand.colors.danger,
  };

  const color = variants[variant] || variants.primary;
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 10px 0;">
    <tr>
      <td>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${brand.colors.border}; border-radius: ${brand.borderRadius.sm}; overflow: hidden;">
          <tr>
            <td style="height: 6px; width: ${clampedPercentage}%; background-color: ${color}; border-radius: ${brand.borderRadius.sm};"></td>
            <td style="height: 6px;"></td>
          </tr>
        </table>
        ${showLabel ? `<p style="margin: 4px 0 0; font-size: ${brand.fonts.sizeSmall}; font-weight: 500; color: ${color}; text-align: center;">${percentage}% used</p>` : ''}
      </td>
    </tr>
  </table>
  `;
};

/**
 * Divider component
 */
const dividerComponent = (options = {}) => {
  const { spacing = 'medium' } = options;
  const spacings = { small: '10px', medium: '20px', large: '28px' };
  const s = spacings[spacing] || spacings.medium;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: ${s} 0;"><tr><td style="border-top: 1px solid ${brand.colors.border};"></td></tr></table>`;
};

/**
 * Text paragraph component
 */
const textComponent = (text, options = {}) => {
  const {
    variant = 'body', // body, muted, small, heading
    align = 'left',
  } = options;

  const variants = {
    body: { size: brand.fonts.sizeMedium, color: brand.colors.textPrimary, weight: 'normal', fontFamily: brand.fonts.family },
    muted: { size: brand.fonts.sizeBase, color: brand.colors.textMuted, weight: 'normal', fontFamily: brand.fonts.family },
    small: { size: brand.fonts.sizeSmall, color: brand.colors.textLight, weight: 'normal', fontFamily: brand.fonts.family },
    heading: { size: brand.fonts.sizeLarge, color: brand.colors.textPrimary, weight: '600', fontFamily: brand.fonts.headingFamily },
  };

  const v = variants[variant] || variants.body;
  return `<p style="margin: 0 0 14px; font-family: ${v.fontFamily}; font-size: ${v.size}; font-weight: ${v.weight}; color: ${v.color}; text-align: ${align}; line-height: 1.6;">${text}</p>`;
};

/**
 * Greeting component
 */
const greetingComponent = (name) => {
  return `<p style="margin: 0 0 14px; font-family: ${brand.fonts.family}; font-size: ${brand.fonts.sizeMedium}; color: ${brand.colors.textPrimary}; line-height: 1.6;">Hi <strong>${name}</strong>,</p>`;
};

/**
 * Stats row component (for digest/summary emails)
 */
const statsRowComponent = (stats) => {
  const statsHtml = stats.map(stat => `
    <td align="center" class="stack-mobile" style="padding: 14px; background-color: ${brand.colors.card}; border: 1px solid ${brand.colors.border}; border-radius: ${brand.borderRadius.md}; width: ${100 / stats.length}%;">
      <p style="margin: 0 0 4px; font-size: ${brand.fonts.sizeSmall}; text-transform: uppercase; letter-spacing: 0.5px; color: ${brand.colors.textMuted};">${stat.label}</p>
      <p style="margin: 0; font-size: ${brand.fonts.sizeXL}; font-weight: 600; color: ${stat.valueColor || brand.colors.textPrimary}; font-variant-numeric: tabular-nums;">${stat.value}</p>
    </td>
  `).join('<td style="width: 10px;"></td>');

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="stats-table" style="margin: 14px 0;">
    <tr>${statsHtml}</tr>
  </table>
  `;
};

/**
 * Badge/tag component
 */
const badgeComponent = (text, options = {}) => {
  const { variant = 'default' } = options;

  const variants = {
    default: { bg: brand.colors.borderLight, text: brand.colors.textPrimary },
    primary: { bg: brand.colors.accentLight, text: brand.colors.success },
    success: { bg: brand.colors.successLight, text: brand.colors.successDark },
    warning: { bg: brand.colors.warningLight, text: brand.colors.warningDark },
    danger: { bg: brand.colors.dangerLight, text: brand.colors.dangerDark },
  };

  const v = variants[variant] || variants.default;
  return `<span style="display: inline-block; background-color: ${v.bg}; color: ${v.text}; padding: 4px 10px; border-radius: ${brand.borderRadius.sm}; font-size: ${brand.fonts.sizeSmall}; font-weight: 500;">${text}</span>`;
};

// ============================================
// FULL EMAIL BUILDERS
// ============================================

/**
 * Build a complete email from components
 */
const buildEmail = (headerOptions, contentHtml, footerOptions = {}) => {
  return emailWrapper(
    emailHeader(headerOptions) +
    emailContent(contentHtml) +
    emailFooter(footerOptions)
  );
};

// ============================================
// EXPORTS
// ============================================

export {
  // Configuration
  brand,

  // Helpers
  formatCurrency,
  formatDate,
  getCurrentYear,

  // Core components
  emailWrapper,
  emailHeader,
  emailContent,
  emailFooter,

  // UI components
  buttonComponent,
  cardComponent,
  alertComponent,
  infoRowComponent,
  tableComponent,
  amountDisplayComponent,
  progressBarComponent,
  dividerComponent,
  textComponent,
  greetingComponent,
  statsRowComponent,
  badgeComponent,

  // Full email builder
  buildEmail,
};

export default {
  brand,
  formatCurrency,
  formatDate,
  buildEmail,
  buttonComponent,
  cardComponent,
  alertComponent,
  tableComponent,
  amountDisplayComponent,
  progressBarComponent,
  dividerComponent,
  textComponent,
  greetingComponent,
  statsRowComponent,
};
