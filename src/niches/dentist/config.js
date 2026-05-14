'use strict';

// Dentist niche pack — config.js
// Core identity and design profile for dental practices.

module.exports = {
  id: 'dentist',
  label: 'Dental Practice',
  primaryGoal: 'book_appointments',
  tone: 'warm_professional',
  palette: 'healthcare_trust',
  heroVariant: 'split_booking_hero',
  motionProfile: 'gentle',
  radiusProfile: 'soft',
  shadowProfile: 'elevated',
  ctaStyle: 'booking_form',
  conversionMechanism: 'appointment_form',
  trustSignalPriority: ['rating', 'review_count', 'insurance', 'location'],
  navItems: ['Services', 'About', 'Reviews', 'Insurance', 'Contact'],
  footerHighlights: ['insurance_accepted', 'hours', 'location', 'phone']
  ,
  // Unsplash photo IDs for hero image candidates (used to load credible images)
  heroImageCandidates: [
    // Curated dental practice images from Unsplash
    'photo-1532922970315-2da17d93c07e',
    'photo-1588776814546-1d2ca93e8278',
    'photo-1551601651-cb6b5d24d8a0'
  ],

  // Opt-in design-system aesthetics (Apache-2.0 vendored from open-design).
  // Slug-hashed pick when no scraped brand palette is available.
  designSystemPool: [
    'clean',
    'apple',
    'minimal',
    'sleek',
    'modern',
    'friendly',
    'professional',
    'spacious'
  ]
};
