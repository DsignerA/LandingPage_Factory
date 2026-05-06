'use strict';

/**
 * strategy-cache.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Strategy template cache for the scale pipeline.
 *
 * Prevents regenerating strategies from scratch for every lead.
 * Each strategy "family" defines the structural skeleton:
 *   - intent plan
 *   - scene structure
 *   - CTA style
 *   - proof structure
 *
 * AI (or the noop provider) only customizes the messaging layer on top.
 *
 * Strategy families are keyed by: {niche}_{primary_goal}
 *
 * Supported families:
 *   dentist_booking_recovery
 *   dentist_trust_building
 *   hvac_quote_capture
 *   hvac_emergency_service
 *   lawyer_consultation_funnel
 *   lawyer_trust_building
 *   generic_lead_capture
 *   generic_modernize
 */

// ── Scene block structure ────────────────────────────────────────────────────

function scene(name, blocks) {
  return { scene: name, blocks };
}

function block(intent, variant, props = {}) {
  return { intent, variant, ...props };
}

// ── Strategy families ────────────────────────────────────────────────────────

const STRATEGY_FAMILIES = {

  // ── Dentist: Booking Recovery ──────────────────────────────────────────────
  dentist_booking_recovery: {
    family_id:    'dentist_booking_recovery',
    niche:        'dentist',
    primary_goal: 'book_appointments',
    offer_angle:  'book_appointments',
    cta_style:    'booking_form',
    proof_style:  'reviews_and_badges',
    intent_plan: {
      primary_intent: 'drive_appointment_booking',
      secondary_intent: 'build_trust',
      funnel_stage: 'consideration',
      urgency_level: 'medium',
    },
    scenes: [
      scene('hero_scene', [
        block('drive_primary_conversion', 'split_booking_hero', {
          cta_primary: 'Book Appointment',
          cta_secondary: 'Call Us',
          form_fields: ['name', 'phone', 'preferred_day', 'reason'],
        }),
      ]),
      scene('trust_scene', [
        block('build_credibility', 'trust_badge_strip', {
          badge_count: 5,
        }),
      ]),
      scene('services_scene', [
        block('showcase_offerings', 'service_grid_cards', {
          columns: 3,
          show_icons: true,
        }),
      ]),
      scene('proof_scene', [
        block('social_proof', 'testimonial_cards', {
          count: 3,
          show_stars: true,
        }),
      ]),
      scene('insurance_scene', [
        block('reduce_friction', 'insurance_grid', {}),
      ]),
      scene('cta_scene', [
        block('drive_secondary_conversion', 'cta_band', {
          style: 'colored_band',
          show_phone: true,
          show_address: true,
        }),
      ]),
    ],
  },

  // ── Dentist: Trust Building ────────────────────────────────────────────────
  dentist_trust_building: {
    family_id:    'dentist_trust_building',
    niche:        'dentist',
    primary_goal: 'build_trust',
    offer_angle:  'build_trust',
    cta_style:    'soft_cta',
    proof_style:  'reviews_prominent',
    intent_plan: {
      primary_intent: 'build_trust_and_credibility',
      secondary_intent: 'drive_appointment_booking',
      funnel_stage: 'awareness',
      urgency_level: 'low',
    },
    scenes: [
      scene('hero_scene', [
        block('build_first_impression', 'centered', {
          cta_primary: 'Meet Our Team',
          cta_secondary: 'Book Appointment',
        }),
      ]),
      scene('proof_scene', [
        block('social_proof', 'review_grid', {
          count: 6,
          show_stars: true,
          show_platform: true,
        }),
      ]),
      scene('services_scene', [
        block('showcase_offerings', 'icon_features', {
          columns: 2,
        }),
      ]),
      scene('cta_scene', [
        block('drive_conversion', 'cta_band', {
          style: 'soft',
          show_phone: true,
        }),
      ]),
    ],
  },

  // ── HVAC: Quote Capture ────────────────────────────────────────────────────
  hvac_quote_capture: {
    family_id:    'hvac_quote_capture',
    niche:        'hvac',
    primary_goal: 'request_quote',
    offer_angle:  'request_quote',
    cta_style:    'quote_form',
    proof_style:  'reviews_and_certifications',
    intent_plan: {
      primary_intent: 'drive_quote_request',
      secondary_intent: 'build_trust',
      funnel_stage: 'consideration',
      urgency_level: 'high',
    },
    scenes: [
      scene('hero_scene', [
        block('drive_primary_conversion', 'service_quote_split', {
          cta_primary: 'Get Free Quote',
          cta_secondary: 'Call Now',
          form_fields: ['name', 'phone', 'service_type', 'zip'],
          urgency_text: 'Same-Day Service Available',
        }),
      ]),
      scene('trust_scene', [
        block('build_credibility', 'trust_badge_strip', {
          badge_count: 4,
        }),
      ]),
      scene('services_scene', [
        block('showcase_offerings', 'grid_cards', {
          columns: 3,
          show_price_range: true,
        }),
      ]),
      scene('proof_scene', [
        block('social_proof', 'testimonial_cards', {
          count: 3,
        }),
      ]),
      scene('cta_scene', [
        block('drive_secondary_conversion', 'cta_band', {
          style: 'urgent',
          show_phone: true,
          show_hours: true,
        }),
      ]),
    ],
  },

  // ── HVAC: Emergency Service ────────────────────────────────────────────────
  hvac_emergency_service: {
    family_id:    'hvac_emergency_service',
    niche:        'hvac',
    primary_goal: 'book_appointments',
    offer_angle:  'emergency_service',
    cta_style:    'phone_cta',
    proof_style:  'reviews_and_response_time',
    intent_plan: {
      primary_intent: 'drive_emergency_call',
      secondary_intent: 'build_trust',
      funnel_stage: 'decision',
      urgency_level: 'critical',
    },
    scenes: [
      scene('hero_scene', [
        block('drive_primary_conversion', 'centered', {
          cta_primary: 'Call Now — 24/7',
          cta_secondary: 'Get Quote',
          urgency_text: '24/7 Emergency Service',
          show_phone_large: true,
        }),
      ]),
      scene('trust_scene', [
        block('build_credibility', 'trust_badge_strip', {}),
      ]),
      scene('services_scene', [
        block('showcase_offerings', 'list_features', {}),
      ]),
      scene('cta_scene', [
        block('drive_conversion', 'cta_band', {
          style: 'urgent',
          show_phone: true,
        }),
      ]),
    ],
  },

  // ── Lawyer: Consultation Funnel ────────────────────────────────────────────
  lawyer_consultation_funnel: {
    family_id:    'lawyer_consultation_funnel',
    niche:        'lawyer',
    primary_goal: 'request_consultation',
    offer_angle:  'request_consultation',
    cta_style:    'consultation_form',
    proof_style:  'case_results_and_reviews',
    intent_plan: {
      primary_intent: 'drive_consultation_request',
      secondary_intent: 'establish_authority',
      funnel_stage: 'consideration',
      urgency_level: 'medium',
    },
    scenes: [
      scene('hero_scene', [
        block('drive_primary_conversion', 'split_premium', {
          cta_primary: 'Free Consultation',
          cta_secondary: 'Call Now',
          form_fields: ['name', 'phone', 'case_type', 'message'],
          badge_text: 'Free Case Review',
        }),
      ]),
      scene('trust_scene', [
        block('build_authority', 'trust_badge_strip', {
          badge_count: 4,
        }),
      ]),
      scene('services_scene', [
        block('showcase_practice_areas', 'icon_features', {
          columns: 2,
        }),
      ]),
      scene('proof_scene', [
        block('social_proof', 'testimonial_cards', {
          count: 3,
          show_case_type: true,
        }),
      ]),
      scene('faq_scene', [
        block('handle_objections', 'faq_accordion', {
          count: 5,
        }),
      ]),
      scene('cta_scene', [
        block('drive_secondary_conversion', 'cta_band', {
          style: 'professional',
          show_phone: true,
          show_address: true,
        }),
      ]),
    ],
  },

  // ── Lawyer: Trust Building ─────────────────────────────────────────────────
  lawyer_trust_building: {
    family_id:    'lawyer_trust_building',
    niche:        'lawyer',
    primary_goal: 'build_trust',
    offer_angle:  'build_trust',
    cta_style:    'soft_cta',
    proof_style:  'awards_and_reviews',
    intent_plan: {
      primary_intent: 'establish_authority',
      secondary_intent: 'drive_consultation_request',
      funnel_stage: 'awareness',
      urgency_level: 'low',
    },
    scenes: [
      scene('hero_scene', [
        block('build_first_impression', 'centered', {
          cta_primary: 'Learn About Our Firm',
          cta_secondary: 'Free Consultation',
        }),
      ]),
      scene('proof_scene', [
        block('social_proof', 'review_grid', {
          count: 6,
        }),
      ]),
      scene('services_scene', [
        block('showcase_practice_areas', 'grid_cards', {}),
      ]),
      scene('cta_scene', [
        block('drive_conversion', 'cta_band', {
          style: 'professional',
        }),
      ]),
    ],
  },

  // ── Generic: Lead Capture ──────────────────────────────────────────────────
  generic_lead_capture: {
    family_id:    'generic_lead_capture',
    niche:        'generic',
    primary_goal: 'get_leads',
    offer_angle:  'get_leads',
    cta_style:    'contact_form',
    proof_style:  'reviews',
    intent_plan: {
      primary_intent: 'drive_lead_submission',
      secondary_intent: 'build_trust',
      funnel_stage: 'consideration',
      urgency_level: 'medium',
    },
    scenes: [
      scene('hero_scene', [
        block('drive_primary_conversion', 'split_premium', {
          cta_primary: 'Get Started',
          cta_secondary: 'Learn More',
        }),
      ]),
      scene('services_scene', [
        block('showcase_offerings', 'grid_cards', {}),
      ]),
      scene('proof_scene', [
        block('social_proof', 'testimonial_cards', { count: 3 }),
      ]),
      scene('cta_scene', [
        block('drive_secondary_conversion', 'cta_band', {
          show_phone: true,
        }),
      ]),
    ],
  },

  // ── Generic: Modernize ─────────────────────────────────────────────────────
  generic_modernize: {
    family_id:    'generic_modernize',
    niche:        'generic',
    primary_goal: 'modernize_site',
    offer_angle:  'modernize_site',
    cta_style:    'contact_form',
    proof_style:  'reviews',
    intent_plan: {
      primary_intent: 'build_first_impression',
      secondary_intent: 'drive_lead_submission',
      funnel_stage: 'awareness',
      urgency_level: 'low',
    },
    scenes: [
      scene('hero_scene', [
        block('build_first_impression', 'centered', {
          cta_primary: 'Contact Us',
          cta_secondary: 'Learn More',
        }),
      ]),
      scene('services_scene', [
        block('showcase_offerings', 'icon_features', {}),
      ]),
      scene('proof_scene', [
        block('social_proof', 'testimonial_cards', { count: 3 }),
      ]),
      scene('cta_scene', [
        block('drive_conversion', 'cta_band', {}),
      ]),
    ],
  },
};

// ── Resolution logic ─────────────────────────────────────────────────────────

/**
 * resolveStrategyFamily(niche, primaryGoal, offerAngle)
 *
 * Returns the best matching strategy family for the given niche and goal.
 * Falls back to generic families if no niche-specific match is found.
 *
 * @returns {object} The strategy family definition
 */
function resolveStrategyFamily(niche, primaryGoal, offerAngle) {
  const n = String(niche || '').toLowerCase();
  const g = String(primaryGoal || '').toLowerCase();
  const o = String(offerAngle || '').toLowerCase();

  // Explicitly route dental leads to a dentist-specific strategy family when possible.
  // If the niche indicates dentistry or related terms, prefer a dentist family rather than generic fallback.
  if (/(dental|dentist|orthodont|dmd|dds|tooth|teeth)/.test(n)) {
    // Find the first dentist-specific family defined in STRATEGY_FAMILIES.
    const dentistKeys = Object.keys(STRATEGY_FAMILIES).filter(k => k.startsWith('dentist_'));
    if (dentistKeys.length > 0) {
      return STRATEGY_FAMILIES[dentistKeys[0]];
    }
  }

  // Exact match: niche_goal
  const exactKey = `${n}_${g.replace(/[^a-z_]/g, '_')}`;
  if (STRATEGY_FAMILIES[exactKey]) return STRATEGY_FAMILIES[exactKey];

  // Offer angle match
  const offerKey = `${n}_${o.replace(/[^a-z_]/g, '_')}`;
  if (STRATEGY_FAMILIES[offerKey]) return STRATEGY_FAMILIES[offerKey];

  // Niche-specific fallback
  const nicheKeys = Object.keys(STRATEGY_FAMILIES).filter(k => k.startsWith(`${n}_`));
  if (nicheKeys.length > 0) return STRATEGY_FAMILIES[nicheKeys[0]];

  // Generic fallback
  if (g === 'get_leads' || g === 'book_appointments' || g === 'request_quote') {
    return STRATEGY_FAMILIES.generic_lead_capture;
  }
  return STRATEGY_FAMILIES.generic_modernize;
}

/**
 * getStrategyFamily(familyId)
 * Returns a strategy family by its exact ID.
 */
function getStrategyFamily(familyId) {
  return STRATEGY_FAMILIES[familyId] || null;
}

/**
 * listFamilies()
 * Returns all registered strategy family IDs.
 */
function listFamilies() {
  return Object.keys(STRATEGY_FAMILIES);
}

module.exports = {
  STRATEGY_FAMILIES,
  resolveStrategyFamily,
  getStrategyFamily,
  listFamilies,
};
