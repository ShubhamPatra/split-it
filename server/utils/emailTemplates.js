/**
 * Split-It Email Template System
 * 
 * Modern, responsive, and accessible email templates
 * Consistent with Split-It brand design system
 * 
 * Brand Colors:
 * - Primary: #33CC99 (teal)
 * - Primary Dark: #2AB57F
 * - Primary Light: #5EDEA8
 * - Success: #22C55E
 * - Warning: #FBBF24
 * - Danger: #EF4444
 * - Background: #F8FAFC
 * - Card: #FFFFFF
 * - Border: #E2E8F0
 * - Text Primary: #1E293B
 * - Text Muted: #64748B
 */

// ============================================
// BRAND CONFIGURATION
// ============================================

const brand = {
  name: 'Split-It',
  logo: '💸', // Emoji fallback for email clients
  // Logo URL - must be publicly accessible. Set LOGO_URL env var to your hosted logo.
  // For production, host the logo on a CDN or your server (e.g., https://yourdomain.com/icon-192.png)
  logoUrl: process.env.LOGO_URL || null,
  logoAlt: 'Split-It Logo',
  logoWidth: 40,
  logoHeight: 40,
  colors: {
    primary: '#33CC99',
    primaryDark: '#2AB57F',
    primaryLight: '#5EDEA8',
    success: '#22C55E',
    successLight: '#DCFCE7',
    successDark: '#16A34A',
    warning: '#FBBF24',
    warningLight: '#FEF3C7',
    warningDark: '#D97706',
    danger: '#EF4444',
    dangerLight: '#FEF2F2',
    dangerDark: '#DC2626',
    info: '#3B82F6',
    infoLight: '#EFF6FF',
    background: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    textPrimary: '#1E293B',
    textSecondary: '#475569',
    textMuted: '#64748B',
    textLight: '#94A3B8',
  },
  fonts: {
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
    sizeSmall: '12px',
    sizeBase: '14px',
    sizeMedium: '16px',
    sizeLarge: '20px',
    sizeXL: '24px',
    size2XL: '32px',
    size3XL: '40px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
    xxxl: '48px',
  },
  borderRadius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
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
  <style>
    /* Reset styles */
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    
    /* Responsive styles */
    @media screen and (max-width: 600px) {
      .wrapper { width: 100% !important; padding: 12px !important; }
      .content { padding: 20px !important; }
      .header { padding: 20px !important; }
      .footer { padding: 20px !important; }
      .button { width: 100% !important; display: block !important; }
      .button-td { padding-left: 0 !important; padding-right: 0 !important; }
      .stats-table td { display: block !important; width: 100% !important; padding: 12px 0 !important; }
      .hide-mobile { display: none !important; }
      .stack-mobile { display: block !important; width: 100% !important; }
      h1 { font-size: 24px !important; }
      h2 { font-size: 20px !important; }
      .amount-large { font-size: 32px !important; }
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
      <td align="center" style="padding: 24px 16px;">
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
    icon = brand.logo,
    variant = 'default', // default, success, warning, danger, gradient
  } = options;

  const variants = {
    default: { bg: brand.colors.primary, text: '#FFFFFF' },
    success: { bg: brand.colors.success, text: '#FFFFFF' },
    warning: { bg: brand.colors.warning, text: '#1E293B' },
    danger: { bg: brand.colors.danger, text: '#FFFFFF' },
    gradient: { bg: `linear-gradient(135deg, ${brand.colors.primary} 0%, ${brand.colors.primaryDark} 100%)`, text: '#FFFFFF' },
  };

  const v = variants[variant] || variants.default;
  const isGradient = variant === 'gradient';
  
  return `
  <!-- Header -->
  <tr>
    <td>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <!-- Top accent bar -->
        <tr>
          <td style="height: 4px; background-color: ${brand.colors.primary}; border-radius: ${brand.borderRadius.lg} ${brand.borderRadius.lg} 0 0;"></td>
        </tr>
        <!-- Logo row -->
        <tr>
          <td align="center" style="background-color: ${brand.colors.card}; padding: 24px 32px; border-left: 1px solid ${brand.colors.border}; border-right: 1px solid ${brand.colors.border};">
            <span style="font-family: ${brand.fonts.family}; font-size: 24px; font-weight: 700; color: ${brand.colors.primary};">
              ${brand.name}
            </span>
          </td>
        </tr>
        <!-- Title section -->
        ${title ? `
        <tr>
          <td align="center" class="header" style="background-color: ${isGradient ? brand.colors.primary : v.bg}; padding: 32px 32px; ${isGradient ? `background: ${v.bg};` : ''}">
            ${icon && icon !== brand.logo ? `<div style="font-size: 36px; margin-bottom: 12px;">${icon}</div>` : ''}
            <h1 style="margin: 0; font-family: ${brand.fonts.family}; font-size: ${brand.fonts.sizeXL}; font-weight: 700; color: ${v.text}; line-height: 1.3;">
              ${title}
            </h1>
            ${subtitle ? `<p style="margin: 8px 0 0; font-size: ${brand.fonts.sizeMedium}; color: ${v.text}; opacity: 0.9;">${subtitle}</p>` : ''}
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
    <td class="content" style="background-color: ${brand.colors.card}; padding: 32px; border-left: 1px solid ${brand.colors.border}; border-right: 1px solid ${brand.colors.border};">
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
    <td style="background-color: ${brand.colors.borderLight}; padding: 24px 32px; border: 1px solid ${brand.colors.border}; border-top: none; border-radius: 0 0 ${brand.borderRadius.lg} ${brand.borderRadius.lg};">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td align="center">
            ${showPreferences ? `
            <p style="margin: 0 0 12px; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textMuted};">
              <a href="${brand.clientUrl}/settings/notifications" style="color: ${brand.colors.primary}; text-decoration: none;">Manage email preferences</a>
            </p>
            ` : ''}
            ${showSupport ? `
            <p style="margin: 0 0 12px; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textMuted};">
              Need help? Contact us at 
              <a href="mailto:${brand.supportEmail}" style="color: ${brand.colors.primary}; text-decoration: none;">${brand.supportEmail}</a>
            </p>
            ` : ''}
            ${showUnsubscribe ? `
            <p style="margin: 0 0 12px; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textLight};">
              <a href="${brand.clientUrl}/unsubscribe" style="color: ${brand.colors.textMuted}; text-decoration: underline;">Unsubscribe</a>
            </p>
            ` : ''}
            <p style="margin: 12px 0 0; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textLight};">
              © ${getCurrentYear()} ${brand.name}. All rights reserved.
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
    primary: { bg: brand.colors.primary, text: '#FFFFFF', border: brand.colors.primary },
    secondary: { bg: brand.colors.textPrimary, text: '#FFFFFF', border: brand.colors.textPrimary },
    success: { bg: brand.colors.success, text: '#FFFFFF', border: brand.colors.success },
    warning: { bg: brand.colors.warning, text: '#1E293B', border: brand.colors.warning },
    danger: { bg: brand.colors.danger, text: '#FFFFFF', border: brand.colors.danger },
    outline: { bg: 'transparent', text: brand.colors.primary, border: brand.colors.primary },
  };

  const sizes = {
    small: { padding: '10px 20px', fontSize: brand.fonts.sizeBase },
    medium: { padding: '14px 28px', fontSize: brand.fonts.sizeMedium },
    large: { padding: '16px 36px', fontSize: brand.fonts.sizeMedium },
  };

  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.medium;

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" ${fullWidth ? 'width="100%"' : ''} style="margin: 0 auto;">
    <tr>
      <td class="button-td" style="border-radius: ${brand.borderRadius.md}; background-color: ${v.bg}; border: 2px solid ${v.border};">
        <a href="${url}" class="button" target="_blank" style="display: inline-block; padding: ${s.padding}; font-family: ${brand.fonts.family}; font-size: ${s.fontSize}; font-weight: 600; color: ${v.text}; text-decoration: none; border-radius: ${brand.borderRadius.md}; ${fullWidth ? 'width: 100%; text-align: center; box-sizing: border-box;' : ''}">
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
    default: { bg: brand.colors.borderLight, border: brand.colors.border },
    success: { bg: brand.colors.successLight, border: '#BBF7D0' },
    warning: { bg: brand.colors.warningLight, border: '#FDE68A' },
    danger: { bg: brand.colors.dangerLight, border: '#FECACA' },
    info: { bg: brand.colors.infoLight, border: '#BFDBFE' },
  };

  const paddings = {
    small: '12px 16px',
    medium: '16px 20px',
    large: '20px 24px',
  };

  const v = variants[variant] || variants.default;
  const p = paddings[padding] || paddings.medium;

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0;">
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
    icon = null,
  } = options;

  const variants = {
    success: { bg: brand.colors.successLight, border: '#BBF7D0', text: '#166534', icon: '✅' },
    warning: { bg: brand.colors.warningLight, border: '#FDE68A', text: '#92400E', icon: '⚠️' },
    danger: { bg: brand.colors.dangerLight, border: '#FECACA', text: '#991B1B', icon: '🚨' },
    info: { bg: brand.colors.infoLight, border: '#BFDBFE', text: '#1E40AF', icon: 'ℹ️' },
  };

  const v = variants[variant] || variants.info;
  const displayIcon = icon || v.icon;

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0;">
    <tr>
      <td style="background-color: ${v.bg}; border: 1px solid ${v.border}; border-radius: ${brand.borderRadius.md}; padding: 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="font-size: 18px; padding-right: 12px; vertical-align: top;">${displayIcon}</td>
            <td style="font-family: ${brand.fonts.family}; font-size: ${brand.fonts.sizeBase}; color: ${v.text}; line-height: 1.5;">
              ${message}
            </td>
          </tr>
        </table>
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
    <td style="padding: 10px 0; font-size: ${brand.fonts.sizeBase}; color: ${brand.colors.textMuted}; border-bottom: 1px solid ${brand.colors.borderLight};">
      ${label}
    </td>
    <td style="padding: 10px 0; font-size: ${brand.fonts.sizeBase}; font-weight: ${highlight ? '700' : '600'}; color: ${highlight ? brand.colors.primary : brand.colors.textPrimary}; text-align: right; border-bottom: 1px solid ${brand.colors.borderLight};">
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
    <th style="padding: 12px 16px; text-align: ${i === 0 ? 'left' : 'right'}; font-size: ${brand.fonts.sizeSmall}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${brand.colors.textMuted}; background-color: ${brand.colors.borderLight}; border-bottom: 2px solid ${brand.colors.border};">
      ${h}
    </th>
  `).join('');

  const rowsHtml = rows.map(row => `
    <tr>
      ${row.map((cell, i) => `
        <td style="padding: 12px 16px; text-align: ${i === 0 ? 'left' : 'right'}; font-size: ${brand.fonts.sizeBase}; color: ${brand.colors.textPrimary}; border-bottom: 1px solid ${brand.colors.borderLight};">
          ${cell}
        </td>
      `).join('')}
    </tr>
  `).join('');

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0; border-collapse: collapse;">
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
    success: brand.colors.success,
    danger: brand.colors.danger,
    primary: brand.colors.primary,
  };

  const color = variants[variant] || variants.default;
  const formattedAmount = formatCurrency(amount, currency);

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0;">
    <tr>
      <td align="center">
        ${label ? `<p style="margin: 0 0 4px; font-size: ${brand.fonts.sizeSmall}; text-transform: uppercase; letter-spacing: 0.5px; color: ${brand.colors.textMuted};">${label}</p>` : ''}
        <p class="amount-large" style="margin: 0; font-size: ${brand.fonts.size2XL}; font-weight: 700; color: ${color};">
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
    primary: brand.colors.primary,
    success: brand.colors.success,
    warning: brand.colors.warning,
    danger: brand.colors.danger,
  };

  const color = variants[variant] || variants.primary;
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 12px 0;">
    <tr>
      <td>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${brand.colors.border}; border-radius: 4px; overflow: hidden;">
          <tr>
            <td style="height: 8px; width: ${clampedPercentage}%; background-color: ${color}; border-radius: 4px;"></td>
            <td style="height: 8px;"></td>
          </tr>
        </table>
        ${showLabel ? `<p style="margin: 6px 0 0; font-size: ${brand.fonts.sizeSmall}; font-weight: 600; color: ${color}; text-align: center;">${percentage}% used</p>` : ''}
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
  const spacings = { small: '12px', medium: '24px', large: '32px' };
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
    body: { size: brand.fonts.sizeMedium, color: brand.colors.textPrimary, weight: 'normal' },
    muted: { size: brand.fonts.sizeBase, color: brand.colors.textMuted, weight: 'normal' },
    small: { size: brand.fonts.sizeSmall, color: brand.colors.textLight, weight: 'normal' },
    heading: { size: brand.fonts.sizeLarge, color: brand.colors.textPrimary, weight: '600' },
  };

  const v = variants[variant] || variants.body;
  return `<p style="margin: 0 0 16px; font-family: ${brand.fonts.family}; font-size: ${v.size}; font-weight: ${v.weight}; color: ${v.color}; text-align: ${align}; line-height: 1.6;">${text}</p>`;
};

/**
 * Greeting component
 */
const greetingComponent = (name) => {
  return `<p style="margin: 0 0 16px; font-family: ${brand.fonts.family}; font-size: ${brand.fonts.sizeMedium}; color: ${brand.colors.textPrimary}; line-height: 1.6;">Hi <strong>${name}</strong>,</p>`;
};

/**
 * Stats row component (for digest/summary emails)
 */
const statsRowComponent = (stats) => {
  const statsHtml = stats.map(stat => `
    <td align="center" class="stack-mobile" style="padding: 16px; background-color: ${stat.bg || brand.colors.borderLight}; border-radius: ${brand.borderRadius.md}; width: ${100 / stats.length}%;">
      <p style="margin: 0 0 4px; font-size: ${brand.fonts.sizeSmall}; text-transform: uppercase; letter-spacing: 0.5px; color: ${stat.labelColor || brand.colors.textMuted};">${stat.label}</p>
      <p style="margin: 0; font-size: ${brand.fonts.sizeXL}; font-weight: 700; color: ${stat.valueColor || brand.colors.textPrimary};">${stat.value}</p>
    </td>
  `).join('<td style="width: 12px;"></td>');

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="stats-table" style="margin: 16px 0;">
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
    primary: { bg: '#E0F7EF', text: brand.colors.primaryDark },
    success: { bg: brand.colors.successLight, text: brand.colors.successDark },
    warning: { bg: brand.colors.warningLight, text: brand.colors.warningDark },
    danger: { bg: brand.colors.dangerLight, text: brand.colors.dangerDark },
  };

  const v = variants[variant] || variants.default;
  return `<span style="display: inline-block; background-color: ${v.bg}; color: ${v.text}; padding: 4px 12px; border-radius: 16px; font-size: ${brand.fonts.sizeSmall}; font-weight: 500;">${text}</span>`;
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
