'use strict';

// Restaurant niche pack — config.js
// Core identity and design profile for restaurants, cafes, bars, and eateries.

module.exports = {
  id: 'restaurant',
  label: 'Restaurant',
  primaryGoal: 'make_reservation',
  tone: 'warm_appetite',
  palette: 'restaurant_warm',
  motionProfile: 'expressive',
  radiusProfile: 'medium',
  shadowProfile: 'soft',
  ctaStyle: 'reservation_and_order',
  conversionMechanism: 'reservation_widget',
  trustSignalPriority: ['rating', 'review_count', 'years_open', 'awards', 'location'],
  navItems: ['Menu', 'Reservations', 'Order Take-Out', 'About', 'Private Events', 'Contact'],
  footerHighlights: ['hours', 'location', 'phone', 'social'],

  // Variation pool: the design resolver picks deterministically from these
  // arrays by hashing the lead's slug, so two different restaurants will get
  // visibly different layouts even when they share the same pack.
  heroVariants:     ['media_background', 'split_premium', 'centered'],
  accentStyles:     ['gold_trim', 'brand_trim', 'none'],
  cardStyles:       ['image_top', 'soft_elevated'],
  backgroundEffects:['soft_gradient', 'none'],
  sectionOrderVariants: [
    ['hero', 'trust-signals', 'services-grid', 'about-story', 'reviews', 'hours-location', 'faq', 'cta'],
    ['hero', 'services-grid', 'about-story', 'trust-signals', 'reviews', 'hours-location', 'faq', 'cta'],
    ['hero', 'trust-signals', 'about-story', 'reviews', 'services-grid', 'hours-location', 'faq', 'cta']
  ],

  heroImageCandidates: [
    'photo-1414235077428-338989a2e8c0',
    'photo-1559339352-11d035aa65de',
    'photo-1517248135467-4c7edcad34c4',
    'photo-1467003909585-2f8a72700288',
    'photo-1555396273-367ea4eb4db5'
  ],

  // Opt-in design-system aesthetics. When a lead's site doesn't expose a brand
  // palette (no usable scraped colors), the design resolver picks one of these
  // deterministically by slug. Vendored from open-design (Apache-2.0).
  designSystemPool: [
    'warm-editorial',
    'editorial',
    'claude',
    'cafe',
    'starbucks',
    'vintage',
    'elegant',
    'premium',
    'bento'
  ]
};
