'use strict';

// src/design/intent-map.js
// Intent Planner — generates a strategic intent plan from the site brief and niche pack.
//
// The intent plan is an ordered array of marketing intents that form a conversion funnel.
// Intent order is determined by: niche, primary_goal, weaknesses, and opportunities.
//
// Supported intents:
//   drive_primary_conversion  — Hero CTA, primary action
//   establish_trust           — Ratings, badges, credentials
//   highlight_services        — Services/features grid
//   show_social_proof         — Reviews, testimonials
//   show_local_proof          — City/area signals, local trust
//   reduce_objections         — FAQ, insurance, pricing transparency
//   capture_lead              — Final form/CTA
//   explain_process           — How it works, numbered steps
//   reinforce_authority       — Credentials, case results, awards
//   secondary_cta_close       — Sticky bar, secondary conversion nudge

const { resolveNichePack } = require('../niches/index');

const ALL_INTENTS = [
  'drive_primary_conversion',
  'establish_trust',
  'highlight_services',
  'show_social_proof',
  'show_local_proof',
  'reduce_objections',
  'capture_lead',
  'explain_process',
  'reinforce_authority',
  'secondary_cta_close'
];

/**
 * Generate the strategic intent plan for a given brief.
 * @param {object} brief - The site brief from siteBriefBuilder
 * @param {object} [nichePack] - Optional pre-resolved niche pack
 * @returns {string[]} Ordered array of intent strings
 */
function generateIntentPlan(brief, nichePack) {
  const b = brief || {};
  const pack = nichePack || resolveNichePack(b.niche);
  const goal = String(b.primary_goal || '').toLowerCase();
  const weaknesses = Array.isArray(b.notes && b.notes.weaknesses) ? b.notes.weaknesses : [];
  const opportunities = Array.isArray(b.opportunities) ? b.opportunities : [];

  // Start with the niche pack's default intent plan
  let plan = Array.isArray(pack.intents && pack.intents.defaultIntentPlan)
    ? [...pack.intents.defaultIntentPlan]
    : ['drive_primary_conversion', 'establish_trust', 'highlight_services', 'show_social_proof', 'capture_lead'];

  // Apply weakness-based overrides if detected
  const weaknessOverrides = (pack.intents && pack.intents.weaknessOverrides) || {};
  const weaknessStr = weaknesses.join(' ').toLowerCase();

  if (weaknessStr.includes('no booking') || weaknessStr.includes('no online booking')) {
    plan = weaknessOverrides.no_booking || plan;
  } else if (weaknessStr.includes('no review') || weaknessStr.includes('few review')) {
    plan = weaknessOverrides.no_reviews || plan;
  } else if (weaknessStr.includes('insurance') && weaknessOverrides.no_insurance_info) {
    plan = weaknessOverrides.no_insurance_info || plan;
  }

  // Goal-based adjustments
  if (goal === 'request_demo') {
    plan = insertAfter(plan, 'drive_primary_conversion', 'explain_process');
    plan = insertAfter(plan, 'explain_process', 'reinforce_authority');
  }

  if (goal === 'schedule_consultation') {
    plan = insertAfter(plan, 'drive_primary_conversion', 'reinforce_authority');
  }

  // Inject local proof if city data is available
  const brand = b.brand || {};
  if (brand.city && !plan.includes('show_local_proof')) {
    const proofIdx = plan.indexOf('show_social_proof');
    if (proofIdx !== -1) {
      plan.splice(proofIdx + 1, 0, 'show_local_proof');
    }
  }

  // Ensure secondary_cta_close is last if present
  if (plan.includes('secondary_cta_close')) {
    plan = plan.filter(i => i !== 'secondary_cta_close');
    plan.push('secondary_cta_close');
  }

  // Deduplicate while preserving order
  const seen = new Set();
  plan = plan.filter(intent => {
    if (seen.has(intent)) return false;
    seen.add(intent);
    return true;
  });

  return plan;
}

function insertAfter(arr, after, insert) {
  const idx = arr.indexOf(after);
  if (idx === -1 || arr.includes(insert)) return arr;
  const copy = [...arr];
  copy.splice(idx + 1, 0, insert);
  return copy;
}

module.exports = { generateIntentPlan, ALL_INTENTS };
