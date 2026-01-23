/**
 * Split-It Email Template System
 * 
 * Professional fintech-grade, responsive, and accessible email templates
 * Aligned with Split-It brand design system
 * 
 * Brand Colors (Production-Grade Fintech Aesthetic):
 * - Primary: #0b1f32 (dark navy - trust and professionalism)
 * - Accent: #0d9488 (teal - fintech trust and positive actions)
 * - Action: #1a6bff (bright blue - CTAs and interactive elements)
 * - Success: #0d9488 (teal - money received, completed actions)
 * - Success Light: #f0fdf4 (very light green - success backgrounds)
 * - Warning: #FBBF24 (amber - caution, pending states)
 * - Warning Light: #fffbeb (very light amber - warning backgrounds)
 * - Danger: #EF4444 (red - money owed, urgent actions)
 * - Danger Light: #fef2f2 (very light red - danger backgrounds)
 * - Background: #f8f9fa (light gray - email body)
 * - Card: #FFFFFF (white - content areas)
 * - Border: #e5e7eb (light gray - borders and dividers)
 * - Text Primary: #0b1f32 (dark navy - headings)
 * - Text Secondary: #6b7280 (medium gray - body text)
 * - Text Muted: #9ca3af (light gray - metadata)
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
    // Primary brand colors - Dark navy for trust and professionalism
    primary: '#0b1f32',        // Main brand color - used for headers, key elements
    primaryDark: '#081825',    // Darker navy - used for hover states and emphasis
    primaryLight: '#0e2538',   // Lighter navy - used for subtle backgrounds
    
    // Accent colors - Teal for fintech trust and positive actions
    accent: '#0d9488',         // Main accent color - used for highlights and success states
    accentLight: '#ccfbf1',    // Light teal - used for success backgrounds and badges
    
    // Action colors - Clear blue for CTAs and interactive elements
    action: '#1a6bff',         // Bright blue - used for primary CTA buttons
    actionDark: '#1557d6',     // Darker blue - used for button hover states
    
    // Semantic colors - Success (positive financial actions)
    success: '#0d9488',        // Teal - used for money received, completed actions
    successLight: '#f0fdf4',   // Very light green - used for success alert backgrounds
    successDark: '#0f766e',    // Dark teal - used for success text in alerts
    
    // Semantic colors - Warning (caution, approaching limits)
    warning: '#FBBF24',        // Amber - used for warnings, pending states
    warningLight: '#fffbeb',   // Very light amber - used for warning alert backgrounds
    warningDark: '#D97706',    // Dark amber - used for warning text in alerts
    
    // Semantic colors - Danger (urgent actions, money owed)
    danger: '#EF4444',         // Red - used for money owed, urgent actions, errors
    dangerLight: '#fef2f2',    // Very light red - used for danger alert backgrounds
    dangerDark: '#DC2626',     // Dark red - used for danger text in alerts
    
    // Semantic colors - Info (helpful information, tips)
    info: '#3B82F6',           // Blue - used for informational alerts and tips
    infoLight: '#eff6ff',      // Very light blue - used for info alert backgrounds
    
    // Neutral colors - Backgrounds and surfaces
    background: '#f8f9fa',     // Light gray - used for email body background
    card: '#FFFFFF',           // White - used for card backgrounds and content areas
    border: '#e5e7eb',         // Light gray - used for borders and dividers
    borderLight: '#f3f4f6',    // Very light gray - used for subtle borders and table rows
    
    // Text colors - Typography hierarchy
    textPrimary: '#0b1f32',    // Dark navy - used for headings and primary text
    textSecondary: '#6b7280',  // Medium gray - used for body text and descriptions
    textMuted: '#9ca3af',      // Light gray - used for metadata, timestamps, footnotes
    textLight: '#9ca3af',      // Light gray - used for less important text
  },
  fonts: {
    // Font families - Modern, professional typography
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",  // Body text font with system fallbacks
    headingFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",  // Heading font with system fallbacks
    
    // Font size scale - Refined for clear hierarchy
    sizeSmall: '12px',         // Metadata, footnotes, timestamps
    sizeBase: '13px',          // Secondary text, labels
    sizeMedium: '15px',        // Primary body text, descriptions
    sizeLarge: '18px',         // Subheadings, section titles
    sizeXL: '22px',            // Main headings, email titles
    size2XL: '28px',           // Large amounts, key financial numbers
    size3XL: '36px',           // Hero amounts, primary focus numbers
    
    // Letter spacing - Tight spacing for modern, polished look
    letterSpacing: '-0.025em',
  },
  spacing: {
    xs: '4px',    // Minimal spacing - used for tight layouts, icon gaps
    sm: '6px',    // Small spacing - used for compact elements
    md: '10px',   // Medium spacing - used for element padding
    lg: '14px',   // Large spacing - used for component padding
    xl: '20px',   // Extra large - used for section spacing
    xxl: '28px',  // Double extra large - used for major section breaks
    xxxl: '40px', // Triple extra large - used for hero spacing
  },
  borderRadius: {
    sm: '4px',   // Small radius - used for badges, progress bars, small elements
    md: '6px',   // Medium radius - used for buttons, cards, standard components
    lg: '8px',   // Large radius - used for large containers (maximum for production-grade look)
  },
  // Email configuration
  email: process.env.SMTP_FROM || 'notifications.splitit@gmail.com',  // Sender email address
  supportEmail: 'notifications.splitit@gmail.com',  // Support contact email for user inquiries
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',  // Base URL for links in emails
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
 * 
 * Establishes brand identity with logo, brand name, and optional title/subtitle.
 * Features a 2px colored accent bar at the top for visual polish.
 * 
 * @param {Object} options - Header configuration
 * @param {string} options.title - Main heading text (optional)
 * @param {string} options.subtitle - Subheading text (optional)
 * @param {string} options.variant - Color variant: 'default', 'success', 'warning', 'danger'
 * @returns {string} HTML table structure for email header
 * 
 * Visual hierarchy:
 * 1. 2px colored accent bar (matches variant)
 * 2. Logo + brand name on colored background
 * 3. Title (22px, Space Grotesk, bold)
 * 4. Subtitle (15px, Inter, medium gray)
 */
const emailHeader = (options = {}) => {
  const {
    title = '',
    subtitle = '',
    variant = 'default', // default, success, warning, danger
  } = options;

  // Refined variant colors for better contrast and trust
  const variants = {
    default: { bg: brand.colors.primary, text: '#FFFFFF', accent: brand.colors.primary },
    success: { bg: brand.colors.success, text: '#FFFFFF', accent: brand.colors.success },
    warning: { bg: brand.colors.warning, text: brand.colors.primary, accent: brand.colors.warning },
    danger: { bg: brand.colors.danger, text: '#FFFFFF', accent: brand.colors.danger },
  };

  const v = variants[variant] || variants.default;

  return `
  <!-- Header -->
  <tr>
    <td>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <!-- 2px accent bar at top for visual polish -->
        <tr>
          <td style="height: 2px; background-color: ${v.accent}; border-radius: ${brand.borderRadius.lg} ${brand.borderRadius.lg} 0 0;"></td>
        </tr>
        <!-- Logo and brand name bar -->
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
        <!-- Title and subtitle section -->
        ${title ? `
        <tr>
          <td align="center" class="header" style="background-color: ${brand.colors.card}; padding: 24px 28px; border-left: 1px solid ${brand.colors.border}; border-right: 1px solid ${brand.colors.border};">
            <h1 style="margin: 0; font-family: ${brand.fonts.headingFamily}; font-size: ${brand.fonts.sizeXL}; font-weight: 600; color: ${brand.colors.textPrimary}; line-height: 1.3; letter-spacing: ${brand.fonts.letterSpacing};">
              ${title}
            </h1>
            ${subtitle ? `<p style="margin: 6px 0 0; font-size: ${brand.fonts.sizeMedium}; color: ${brand.colors.textSecondary}; line-height: 1.5;">${subtitle}</p>` : ''}
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
 * 
 * Provides consistent footer across all email templates with support contact,
 * preferences link, and copyright information. Establishes trust and provides
 * user control over email communications.
 * 
 * @param {Object} options - Footer configuration
 * @param {boolean} options.showPreferences - Show "Manage email preferences" link (default: true)
 * @param {boolean} options.showSupport - Show support email contact (default: true)
 * @param {boolean} options.showUnsubscribe - Show unsubscribe link (default: false)
 * @returns {string} HTML table structure for email footer
 * 
 * Visual Specifications:
 * - Background: Very light gray (#f3f4f6) for subtle separation
 * - Border: 1px solid light gray on sides and bottom
 * - Border radius: 0 0 8px 8px (rounded bottom corners)
 * - Padding: 24px 28px for balanced spacing
 * - Text: 12px, light gray for metadata appearance
 * - Links: Action blue with no underline (except unsubscribe)
 * 
 * Content Guidelines:
 * - Support email: Always show for trust and accessibility (unless explicitly disabled)
 * - Preferences link: Show by default to give users control
 * - Unsubscribe: Only show for marketing/digest emails, not transactional
 * - Copyright: Always show with current year
 * 
 * Requirements Validated:
 * - 2.4: Professional footer with company information
 * - 6.4: Support contact information for trust
 * - 6.6: Preferences link for user control
 * - 8.2: Consistent footer across all templates
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
    <td style="background-color: ${brand.colors.borderLight}; padding: 24px 28px; border: 1px solid ${brand.colors.border}; border-top: none; border-radius: 0 0 ${brand.borderRadius.lg} ${brand.borderRadius.lg};">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td align="center">
            ${showSupport ? `
            <p style="margin: 0 0 12px; font-family: ${brand.fonts.family}; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textMuted}; line-height: 1.5;">
              Need help? Contact us at 
              <a href="mailto:${brand.supportEmail}" style="color: ${brand.colors.action}; text-decoration: none; font-weight: 500;">${brand.supportEmail}</a>
            </p>
            ` : ''}
            ${showPreferences ? `
            <p style="margin: 0 0 12px; font-family: ${brand.fonts.family}; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textMuted}; line-height: 1.5;">
              <a href="${brand.clientUrl}/settings/notifications" style="color: ${brand.colors.action}; text-decoration: none; font-weight: 500;">Manage email preferences</a>
            </p>
            ` : ''}
            ${showUnsubscribe ? `
            <p style="margin: 0 0 12px; font-family: ${brand.fonts.family}; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textMuted}; line-height: 1.5;">
              <a href="${brand.clientUrl}/unsubscribe" style="color: ${brand.colors.textMuted}; text-decoration: underline;">Unsubscribe</a>
            </p>
            ` : ''}
            <p style="margin: ${showSupport || showPreferences || showUnsubscribe ? '12px' : '0'} 0 0; font-family: ${brand.fonts.family}; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textMuted}; line-height: 1.5;">
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
 * 
 * Primary and secondary CTAs that drive user action.
 * 
 * @param {string} text - Button text (should be action-specific, 2-4 words)
 * @param {string} url - Button link URL
 * @param {Object} options - Button configuration
 * @param {string} options.variant - Button style: 'primary', 'secondary', 'success', 'danger'
 * @param {string} options.size - Button size: 'small', 'medium', 'large'
 * @param {boolean} options.fullWidth - Whether button should be full width
 * @returns {string} HTML table structure for button
 * 
 * Button Text Guidelines:
 * - Use action verbs: "Complete Payment", "View Group", "Download Report"
 * - Be specific: "Add Payment Method" not "Update Profile"
 * - Keep it short: 2-4 words maximum
 * - Avoid generic: Never use "Click Here" or "Learn More"
 * 
 * Visual Specifications:
 * - Border radius: 6px (medium)
 * - Font weight: 500 (medium)
 * - Minimum height: 44px (accessibility)
 * - Padding: 12-14px vertical, 24-32px horizontal
 * 
 * Hover States (for reference, not implemented in email):
 * - Primary: Darken background to #1557d6
 * - Secondary: Darken background to #081825
 * - Success: Darken background to #0f766e
 * - Danger: Darken background to #DC2626
 */
const buttonComponent = (text, url, options = {}) => {
  const {
    variant = 'primary', // primary, secondary, success, danger
    size = 'medium', // small, medium, large
    fullWidth = false,
  } = options;

  // Refined variants with better contrast
  const variants = {
    primary: { 
      bg: brand.colors.action,      // Bright blue (#1a6bff)
      text: '#FFFFFF',
      border: brand.colors.action,
      // Hover: #1557d6 (darker blue)
    },
    secondary: { 
      bg: 'transparent',            // Outline style for secondary actions
      text: brand.colors.action,
      border: brand.colors.action,
      // Hover: Light blue background (#eff6ff)
    },
    success: { 
      bg: brand.colors.success,     // Teal (#0d9488)
      text: '#FFFFFF',
      border: brand.colors.success,
      // Hover: #0f766e (darker teal)
    },
    danger: { 
      bg: brand.colors.danger,      // Red (#EF4444)
      text: '#FFFFFF',
      border: brand.colors.danger,
      // Hover: #DC2626 (darker red)
    },
  };

  // Size scale ensuring minimum 44px touch targets
  // Calculations: padding-top + padding-bottom + line-height
  const sizes = {
    small: { 
      padding: '12px 20px',         // 12 + 12 + ~22px line = ~46px height (meets 44px minimum)
      fontSize: brand.fonts.sizeBase // 13px
    },
    medium: { 
      padding: '12px 24px',         // 12 + 12 + ~22px line = ~46px height (meets 44px minimum)
      fontSize: brand.fonts.sizeMedium // 15px
    },
    large: { 
      padding: '14px 32px',         // 14 + 14 + ~22px line = ~50px height (exceeds 44px minimum)
      fontSize: brand.fonts.sizeMedium // 15px
    },
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
 * 
 * Groups related information with subtle visual separation.
 * Uses minimal styling - no heavy backgrounds, shadows, or gradients.
 * 
 * @param {string} content - HTML content to display inside the card
 * @param {Object} options - Card configuration
 * @param {string} options.variant - Visual variant: 'default', 'info', 'success', 'warning'
 * @param {string} options.padding - Padding size: 'small', 'medium', 'large'
 * @returns {string} HTML table structure for card
 * 
 * Visual Specifications:
 * - Border: 1px solid (subtle)
 * - Border radius: 6px
 * - Shadow: none (rely on border for separation)
 * - Background: white or very light gray only
 * - No gradients or heavy colors
 * 
 * Refined Padding Scale:
 * - Small: 12px 16px
 * - Medium: 16px 20px
 * - Large: 20px 24px
 * 
 * Usage Guidelines:
 * - Use for grouping related information (transaction details, expense breakdown)
 * - Use info variant for helpful tips or explanations
 * - Use colored border variants sparingly for emphasis
 * - Maintain consistent padding within card content
 */
const cardComponent = (content, options = {}) => {
  const {
    variant = 'default', // default, info, success, warning
    padding = 'medium', // small, medium, large
  } = options;

  // Subtle variants - no heavy backgrounds, only white or very light gray
  // Colored borders only for emphasis, not colored backgrounds
  const variants = {
    default: { 
      bg: brand.colors.card,           // White
      border: brand.colors.border      // Light gray
    },
    info: { 
      bg: '#fafafa',                   // Very light gray
      border: brand.colors.border      // Light gray border
    },
    success: { 
      bg: '#fafafa',                   // Neutral background
      border: brand.colors.success     // Colored border only
    },
    warning: { 
      bg: '#fafafa',                   // Neutral background
      border: brand.colors.warning     // Colored border only
    },
  };

  // Refined padding scale for better visual hierarchy
  const paddings = {
    small: '12px 16px',   // Compact cards
    medium: '16px 20px',  // Standard cards (default)
    large: '20px 24px',   // Spacious cards
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
 * 
 * Highlights important information or required actions with semantic color variants.
 * Uses very light backgrounds with colored left border for visual emphasis.
 * 
 * @param {string} message - Alert message text (keep to 1-2 sentences)
 * @param {Object} options - Alert configuration
 * @param {string} options.variant - Semantic variant: 'success', 'warning', 'danger', 'info'
 * @returns {string} HTML table structure for alert box
 * 
 * Visual Specifications:
 * - Left border: 4px solid (colored)
 * - Background: very light tint of variant color
 * - Border radius: 6px
 * - Padding: 14px 16px
 * - Text: 13px, colored to match variant
 * 
 * Variant Colors (Production-Grade):
 * - success: bg #f0fdf4, border success color, text #166534 (dark green)
 * - warning: bg #fffbeb, border warning color, text #92400E (dark amber)
 * - danger: bg #fef2f2, border danger color, text #991B1B (dark red)
 * - info: bg #eff6ff, border action color, text #1E40AF (dark blue)
 * 
 * Content Guidelines:
 * - Keep messages short (1-2 sentences)
 * - Use for actionable information or important context
 * - Success: confirmations, completed actions
 * - Warning: reminders, approaching limits
 * - Danger: urgent actions, errors
 * - Info: helpful tips, explanations
 */
const alertComponent = (message, options = {}) => {
  const {
    variant = 'info', // success, warning, danger, info
  } = options;

  // Refined alert colors - lighter backgrounds with 4px colored left border
  // Text colors are dark variants for better readability on light backgrounds
  const variants = {
    success: { 
      bg: '#f0fdf4',                    // Very light green background
      border: brand.colors.success,     // Green left border (#0d9488)
      text: '#166534'                   // Dark green text for readability
    },
    warning: { 
      bg: '#fffbeb',                    // Very light amber background
      border: brand.colors.warning,     // Amber left border (#FBBF24)
      text: '#92400E'                   // Dark amber text for readability
    },
    danger: { 
      bg: '#fef2f2',                    // Very light red background
      border: brand.colors.danger,      // Red left border (#EF4444)
      text: '#991B1B'                   // Dark red text for readability
    },
    info: { 
      bg: '#eff6ff',                    // Very light blue background
      border: brand.colors.action,      // Blue left border (#1a6bff)
      text: '#1E40AF'                   // Dark blue text for readability
    },
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
 * 
 * Prominently displays financial amounts with proper context and color coding.
 * Optimized for financial information with tabular numbers for alignment.
 * 
 * @param {number} amount - The amount to display
 * @param {Object} options - Display configuration
 * @param {string} options.currency - Currency code (default: 'INR')
 * @param {string} options.variant - Color variant: 'default', 'primary', 'success', 'danger', 'warning'
 * @param {string} options.label - Label text above amount (optional)
 * @param {string} options.sublabel - Context text below amount (optional)
 * @param {string} options.size - Font size: 'large' (28px) or 'xlarge' (36px) - default: 'large'
 * @returns {string} HTML table structure for amount display
 * 
 * Visual Hierarchy:
 * 1. Label (12px, uppercase, gray, letter-spacing 0.5px, medium weight)
 * 2. Amount (28-36px, bold, colored by variant, tabular numbers)
 * 3. Sublabel (13px, gray, context information)
 * 
 * Typography Rules:
 * - Uses font-variant-numeric: tabular-nums for alignment
 * - Always includes currency symbol
 * - Formats with 2 decimal places
 * - Uses locale-appropriate thousand separators
 * 
 * Color Coding for Financial Context:
 * - default: Neutral amounts (dark navy #0b1f32)
 * - success: Money received (teal green #0d9488)
 * - danger: Money owed (red #EF4444)
 * - warning: Pending/due amounts (amber #FBBF24)
 * - primary: Alternative neutral amounts (dark navy via brand.colors.primary)
 * 
 * Context Guidelines:
 * - Label: "Amount Due", "Payment Received", "Total Expenses"
 * - Sublabel: "in group 'Weekend Trip'", "From John Doe", "Across 3 groups"
 */
const amountDisplayComponent = (amount, options = {}) => {
  const {
    currency = 'INR',
    variant = 'default', // default, success, danger, warning
    label = '',
    sublabel = '',
    size = 'large', // large (28px), xlarge (36px)
  } = options;

  // Color coding for financial context
  // Each variant has a specific semantic meaning for financial information
  const variants = {
    default: brand.colors.textPrimary,  // Neutral amounts (dark navy #0b1f32)
    success: brand.colors.success,      // Money received (teal green #0d9488)
    danger: brand.colors.danger,        // Money owed (red #EF4444)
    warning: brand.colors.warning,      // Pending/due amounts (amber #FBBF24)
    primary: brand.colors.primary,      // Alternative neutral (dark navy #0b1f32)
  };

  // Font size options for different emphasis levels
  // Ensures amounts are prominent (28px minimum per requirements 3.2)
  const sizes = {
    large: brand.fonts.size2XL,   // 28px - standard large amounts
    xlarge: brand.fonts.size3XL,  // 36px - hero amounts, primary focus
  };

  const color = variants[variant] || variants.default;
  const fontSize = sizes[size] || sizes.large;
  const formattedAmount = formatCurrency(amount, currency);

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 14px 0;">
    <tr>
      <td align="center">
        ${label ? `<p style="margin: 0 0 6px; font-size: ${brand.fonts.sizeSmall}; text-transform: uppercase; letter-spacing: 0.5px; color: ${brand.colors.textMuted}; font-weight: 500; line-height: 1.4;">${label}</p>` : ''}
        <p class="amount-large" style="margin: 0; font-size: ${fontSize}; font-weight: 700; color: ${color}; font-variant-numeric: tabular-nums; line-height: 1.2; letter-spacing: -0.02em;">
          ${formattedAmount}
        </p>
        ${sublabel ? `<p style="margin: 6px 0 0; font-size: ${brand.fonts.sizeBase}; color: ${brand.colors.textMuted}; line-height: 1.5; font-weight: 400;">${sublabel}</p>` : ''}
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
