'use strict';

// src/niches/index.js
// Niche pack resolver — maps a raw niche string to the appropriate niche pack.
//
// Each niche pack exports: config, intents, proof, copy, variants
// The resolver merges these into a single pack object.

const dentistPack = {
  config:   require('./dentist/config'),
  intents:  require('./dentist/intents'),
  proof:    require('./dentist/proof'),
  copy:     require('./dentist/copy'),
  variants: require('./dentist/variants')
};

const hvacPack = {
  config:   require('./hvac/config'),
  intents:  require('./hvac/intents'),
  proof:    require('./hvac/proof'),
  copy:     require('./hvac/copy'),
  variants: require('./hvac/variants')
};

const lawyerPack = {
  config:   require('./lawyer/config'),
  intents:  require('./lawyer/intents'),
  proof:    require('./lawyer/proof'),
  copy:     require('./lawyer/copy'),
  variants: require('./lawyer/variants')
};

// Generic fallback pack for unrecognized niches
const genericPack = {
  config: {
    id: 'general',
    label: 'Local Business',
    primaryGoal: 'get_in_touch',
    tone: 'friendly_professional',
    palette: 'neutral_clean',
    heroVariant: 'split_premium',
    motionProfile: 'gentle',
    radiusProfile: 'medium',
    shadowProfile: 'elevated',
    ctaStyle: 'contact_form',
    conversionMechanism: 'contact_form',
    trustSignalPriority: ['rating', 'review_count', 'location'],
    navItems: ['Services', 'About', 'Reviews', 'Contact'],
    footerHighlights: ['hours', 'location', 'phone']
  },
  intents: {
    defaultIntentPlan: [
      'drive_primary_conversion',
      'establish_trust',
      'highlight_services',
      'show_social_proof',
      'capture_lead'
    ],
    weaknessOverrides: {}
  },
  proof: {
    trustBadges: [
      { icon: '⭐', label: '5-Star Rated' },
      { icon: '✅', label: 'Verified Business' },
      { icon: '📍', label: 'Locally Owned' }
    ],
    reviewTemplates: [
      { author: 'Pat A.', rating: 5, text: 'Great service and easy to work with. Highly recommend.' },
      { author: 'Lee B.', rating: 5, text: 'Exactly what we needed. Professional and responsive.' },
      { author: 'Quinn D.', rating: 5, text: 'Delivered results and kept us informed throughout.' }
    ],
    localProofPatterns: ['Serving {city} and surrounding areas'],
    objectionHandlers: [],
    projectedImpact: [
      { metric: '+25%', label: 'Online inquiries', basis: 'Clear CTA and contact form' },
      { metric: '+30%', label: 'Mobile conversions', basis: 'Mobile-optimized layout' }
    ]
  },
  copy: {
    headlinePatterns: ['{city}\'s Trusted {niche} Service'],
    subheadlinePatterns: ['Professional service you can count on.'],
    ctaLabels: { primary: 'Get In Touch', secondary: 'Learn More', call: 'Call Now' },
    sectionHeadings: { services: 'Our Services', reviews: 'What People Say' },
    valueProps: [
      { title: 'Professional', description: 'Experienced team committed to quality.', icon: '✅' },
      { title: 'Responsive', description: 'Quick turnaround and clear communication.', icon: '⚡' },
      { title: 'Local', description: 'Proudly serving the {city} community.', icon: '📍' }
    ],
    services: []
  },
  variants: {
    intentVariantMap: {
      drive_primary_conversion: 'split_premium',
      establish_trust:          'trust_badge_strip',
      highlight_services:       'service_grid_cards',
      show_social_proof:        'review_cards',
      capture_lead:             'contact_form_cta',
      reduce_objections:        'faq_accordion',
      explain_process:          'numbered_steps',
      reinforce_authority:      'credentials_strip',
      show_local_proof:         'location_proof_strip',
      secondary_cta_close:      'sticky_cta_bar'
    },
    sceneMap: {
      hero_scene: { surface: 'brand-soft', density: 'airy', intents: ['drive_primary_conversion', 'establish_trust'] },
      services_scene: { surface: 'paper', density: 'balanced', intents: ['highlight_services'] },
      proof_scene: { surface: 'warm-light', density: 'balanced', intents: ['show_social_proof'] },
      conversion_scene: { surface: 'brand-strong', density: 'dense', intents: ['capture_lead'] }
    }
  }
};

/**
 * Resolve a niche string to its niche pack.
 * Returns the full pack object: { config, intents, proof, copy, variants }
 */
function resolveNichePack(niche) {
  const n = String(niche || '').toLowerCase();

  if (/dental|dentist|orthodont|dmd|dds|tooth|teeth/.test(n)) return dentistPack;
  if (/hvac|heating|cooling|air\s*condition|furnace|boiler|plumb|roof|electric|pest|landscap|contractor|remodel|garage|floor|clean/.test(n)) return hvacPack;
  if (/law|attorney|legal|counsel/.test(n)) return lawyerPack;
  if (/chiro|clinic|medical|medspa|spa|therapy|therapist|veterinary|vet/.test(n)) return dentistPack; // healthcare fallback
  if (/account|cpa|consult|coach|agency|insurance|realtor|real\s*estate/.test(n)) return lawyerPack; // professional service fallback

  return genericPack;
}

module.exports = {
  resolveNichePack,
  packs: { dentist: dentistPack, hvac: hvacPack, lawyer: lawyerPack, general: genericPack }
};
