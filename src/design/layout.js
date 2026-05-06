'use strict';

// src/design/layout.js
// Named layout token sets for the design token system.
// Each density profile defines spacing, container, grid, card, and shadow tokens.
//
// Density profiles: airy | balanced | compact | visual

const LAYOUT = {

  // Spacious, editorial — healthcare, professional services
  airy: {
    containerMaxWidth: '1200px',
    sectionPaddingDesktop: '96px',
    sectionPaddingMobile: '64px',
    gridGap: '32px',
    cardPadding: '32px',
    cardRadius: '16px',
    cardShadow: '0 4px 24px 0 rgba(0,0,0,0.07)',
    cardShadowHover: '0 12px 40px 0 rgba(0,0,0,0.13)',
    cardBorder: '1px solid rgba(0,0,0,0.06)',
    innerSpacing: '24px'
  },

  // Balanced — B2B SaaS, agencies
  balanced: {
    containerMaxWidth: '1152px',
    sectionPaddingDesktop: '80px',
    sectionPaddingMobile: '56px',
    gridGap: '24px',
    cardPadding: '28px',
    cardRadius: '12px',
    cardShadow: '0 2px 16px 0 rgba(0,0,0,0.08)',
    cardShadowHover: '0 8px 32px 0 rgba(0,0,0,0.14)',
    cardBorder: '1px solid rgba(0,0,0,0.08)',
    innerSpacing: '20px'
  },

  // Compact — home service, trades
  compact: {
    containerMaxWidth: '1100px',
    sectionPaddingDesktop: '64px',
    sectionPaddingMobile: '40px',
    gridGap: '20px',
    cardPadding: '20px',
    cardRadius: '8px',
    cardShadow: '0 2px 8px 0 rgba(0,0,0,0.08)',
    cardShadowHover: '0 6px 20px 0 rgba(0,0,0,0.14)',
    cardBorder: '1px solid rgba(0,0,0,0.1)',
    innerSpacing: '16px'
  },

  // Visual / immersive — restaurant, ecommerce
  visual: {
    containerMaxWidth: '1280px',
    sectionPaddingDesktop: '88px',
    sectionPaddingMobile: '56px',
    gridGap: '28px',
    cardPadding: '24px',
    cardRadius: '20px',
    cardShadow: '0 4px 20px 0 rgba(0,0,0,0.1)',
    cardShadowHover: '0 16px 48px 0 rgba(0,0,0,0.18)',
    cardBorder: '1px solid rgba(0,0,0,0.06)',
    innerSpacing: '20px'
  }
};

module.exports = LAYOUT;
