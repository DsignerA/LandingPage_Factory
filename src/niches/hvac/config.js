'use strict';

// HVAC niche pack — config.js
module.exports = {
  id: 'hvac',
  label: 'HVAC Contractor',
  primaryGoal: 'generate_leads',
  tone: 'confident_direct',
  palette: 'home_service_bold',
  heroVariant: 'quote_form_hero',
  motionProfile: 'snappy',
  radiusProfile: 'medium',
  shadowProfile: 'strong',
  ctaStyle: 'quote_form',
  conversionMechanism: 'quote_form',
  trustSignalPriority: ['license', 'rating', 'response_time', 'location'],
  navItems: ['Services', 'Reviews', 'Service Area', 'About', 'Contact'],
  footerHighlights: ['license_number', 'service_area', 'hours', 'phone']
  ,
  // Unsplash photo IDs for HVAC hero images
  heroImageCandidates: [
    'photo-1611095961170-6ae2bc497acf',
    'photo-1556906781-23f839fa9e3e',
    'photo-1605902711622-cfb43c44367f'
  ],

  // Opt-in design-system aesthetics (Apache-2.0 vendored from open-design).
  designSystemPool: [
    'bold',
    'corporate',
    'professional',
    'enterprise',
    'modern',
    'mission-control',
    'trading-terminal',
    'hud'
  ]
};
