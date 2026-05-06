'use strict';

module.exports = {
  id: 'lawyer',
  label: 'Law Firm / Attorney',
  primaryGoal: 'schedule_consultation',
  tone: 'authoritative_empathetic',
  palette: 'professional_authority',
  heroVariant: 'split_consultation_hero',
  motionProfile: 'refined',
  radiusProfile: 'sharp',
  shadowProfile: 'subtle',
  ctaStyle: 'consultation_form',
  conversionMechanism: 'consultation_form',
  trustSignalPriority: ['bar_membership', 'years_experience', 'case_results', 'rating'],
  navItems: ['Practice Areas', 'About', 'Results', 'FAQ', 'Contact'],
  footerHighlights: ['bar_number', 'disclaimer', 'location', 'phone']
  ,
  // Unsplash photo IDs for law firm hero images
  heroImageCandidates: [
    'photo-1555374018-13a8994d09ac',
    'photo-1555374018-8835c0264340',
    'photo-1591448205203-bd824e0b8c72'
  ]
};
