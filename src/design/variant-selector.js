'use strict';

// src/design/variant-selector.js
// Variant Selector — maps each strategic intent to the most appropriate presentational variant.
//
// Variant selection considers:
//   - niche (via niche pack)
//   - intent
//   - design tokens (palette, tone, motionProfile)
//   - primary goal
//   - device/conversion context
//
// The niche pack's intentVariantMap is the primary source of truth.
// This module provides fallback logic and cross-niche overrides.

const { resolveNichePack } = require('../niches/index');

// Global fallback variant map (used when niche pack has no mapping for an intent)
const GLOBAL_FALLBACK_MAP = {
  drive_primary_conversion: 'split_premium',
  establish_trust:          'trust_badge_strip',
  highlight_services:       'service_grid_cards',
  show_social_proof:        'review_cards',
  show_local_proof:         'location_proof_strip',
  reduce_objections:        'faq_accordion',
  capture_lead:             'contact_form_cta',
  explain_process:          'numbered_steps',
  reinforce_authority:      'credentials_strip',
  secondary_cta_close:      'sticky_cta_bar'
};

// Goal-based hero variant overrides (applied to drive_primary_conversion)
const GOAL_HERO_VARIANTS = {
  book_appointments:           'split_booking_hero',
  request_demo:                'product_demo_hero',
  generate_leads:              'quote_form_hero',
  schedule_consultation:       'split_consultation_hero',
  capture_lead:                'lead_capture_hero',
  call_now:                    'call_cta_hero',
  get_in_touch:                'split_premium'
};

/**
 * Select the best variant for a given intent, considering niche and design context.
 * @param {string} intent - The marketing intent
 * @param {object} brief - The site brief
 * @param {object} [nichePack] - Optional pre-resolved niche pack
 * @param {object} [design] - Optional design profile from design-director
 * @returns {string} The selected variant name
 */
function selectVariant(intent, brief, nichePack, design) {
  const b = brief || {};
  const pack = nichePack || resolveNichePack(b.niche);
  const goal = String(b.primary_goal || '').toLowerCase();

  // For the primary conversion intent, goal takes precedence
  if (intent === 'drive_primary_conversion') {
    const goalVariant = GOAL_HERO_VARIANTS[goal];
    if (goalVariant) return goalVariant;
  }

  // Use niche pack's intentVariantMap
  const packVariantMap = (pack.variants && pack.variants.intentVariantMap) || {};
  if (packVariantMap[intent]) return packVariantMap[intent];

  // Fall back to global map
  return GLOBAL_FALLBACK_MAP[intent] || 'generic_block';
}

/**
 * Resolve variants for an entire intent plan.
 * @param {string[]} intentPlan - Ordered array of intents
 * @param {object} brief - The site brief
 * @param {object} [nichePack] - Optional pre-resolved niche pack
 * @param {object} [design] - Optional design profile
 * @returns {Array<{intent: string, variant: string}>}
 */
function resolveVariants(intentPlan, brief, nichePack, design) {
  const pack = nichePack || resolveNichePack((brief || {}).niche);
  return (intentPlan || []).map(intent => ({
    intent,
    variant: selectVariant(intent, brief, pack, design)
  }));
}

module.exports = { selectVariant, resolveVariants, GLOBAL_FALLBACK_MAP, GOAL_HERO_VARIANTS };
