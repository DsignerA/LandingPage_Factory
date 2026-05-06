'use strict';

/**
 * weakness-scoring.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Converts a structured site audit into prioritized weaknesses and opportunities.
 * Uses deterministic weighted scoring — no ML required.
 *
 * Scoring logic:
 *  - Base weight per signal type (how important is this for any business)
 *  - Niche multiplier (e.g., booking flow is critical for dentists)
 *  - Absence penalty (missing a high-weight signal → high priority weakness)
 */

// ── Signal weight definitions ────────────────────────────────────────────────
// Each entry: { key, label, baseWeight, nicheWeights, opportunity }
// baseWeight: 0–1, how critical this is for any local service business
// nicheWeights: per-niche multiplier overrides (default 1.0)

const SIGNAL_DEFINITIONS = [
  {
    key: 'missing_booking_cta',
    observationKey: 'hasBookingFlow',
    label: 'No clear appointment or booking CTA above the fold',
    baseWeight: 0.95,
    nicheWeights: { dentist: 1.0, hvac: 0.85, lawyer: 0.90, default: 0.85 },
    opportunity: 'Add a prominent booking CTA in the hero section',
    goalRelevance: ['book_appointments', 'request_consultation', 'request_quote'],
  },
  {
    key: 'missing_primary_cta',
    observationKey: 'hasPrimaryCTA',
    label: 'No prominent primary CTA button visible',
    baseWeight: 0.90,
    nicheWeights: { dentist: 0.95, hvac: 0.95, lawyer: 0.90, default: 0.90 },
    opportunity: 'Add a clear, high-contrast CTA button in the hero',
    goalRelevance: ['book_appointments', 'request_consultation', 'request_quote', 'get_leads'],
  },
  {
    key: 'missing_phone_number',
    observationKey: 'hasPhoneNumber',
    label: 'No visible phone number on the homepage',
    baseWeight: 0.88,
    nicheWeights: { dentist: 0.95, hvac: 1.0, lawyer: 0.90, default: 0.90 },
    opportunity: 'Display phone number prominently in the header and hero',
    goalRelevance: ['book_appointments', 'request_consultation', 'request_quote'],
  },
  {
    key: 'missing_chat_widget',
    observationKey: 'hasChatWidget',
    label: 'No chat widget or live chat for immediate engagement',
    baseWeight: 0.72,
    nicheWeights: { dentist: 0.80, hvac: 0.75, lawyer: 0.70, default: 0.70 },
    opportunity: 'Add a chat widget or virtual front desk for instant lead capture',
    goalRelevance: ['book_appointments', 'get_leads', 'recover_missed_leads'],
  },
  {
    key: 'missing_reviews',
    observationKey: 'hasVisibleReviews',
    label: 'No reviews or testimonials visible on the homepage',
    baseWeight: 0.85,
    nicheWeights: { dentist: 0.90, hvac: 0.85, lawyer: 0.88, default: 0.82 },
    opportunity: 'Surface patient/client reviews prominently above the fold',
    goalRelevance: ['book_appointments', 'request_consultation', 'build_trust'],
  },
  {
    key: 'missing_insurance_info',
    observationKey: 'hasInsuranceInfo',
    label: 'Insurance, payment, or financing information is not visible',
    baseWeight: 0.78,
    nicheWeights: { dentist: 0.95, hvac: 0.70, lawyer: 0.60, default: 0.65 },
    opportunity: 'Add insurance and payment information near the hero or services section',
    goalRelevance: ['book_appointments', 'reduce_friction', 'build_trust'],
  },
  {
    key: 'missing_service_area_proof',
    observationKey: 'hasServiceAreaProof',
    label: 'No local service area proof or city/neighborhood mention',
    baseWeight: 0.70,
    nicheWeights: { dentist: 0.75, hvac: 0.88, lawyer: 0.72, default: 0.72 },
    opportunity: 'Add city/neighborhood mentions and service area proof to build local trust',
    goalRelevance: ['build_trust', 'local_seo', 'book_appointments'],
  },
  {
    key: 'missing_sticky_mobile_cta',
    observationKey: 'hasStickyMobileCTA',
    label: 'No sticky mobile CTA bar for on-the-go visitors',
    baseWeight: 0.76,
    nicheWeights: { dentist: 0.80, hvac: 0.85, lawyer: 0.75, default: 0.78 },
    opportunity: 'Add a persistent mobile CTA bar (call or book) that stays visible while scrolling',
    goalRelevance: ['improve_mobile_conversion', 'book_appointments'],
  },
  {
    key: 'missing_trust_badges',
    observationKey: 'hasTrustBadges',
    label: 'No trust badges, certifications, or credentials visible',
    baseWeight: 0.68,
    nicheWeights: { dentist: 0.78, hvac: 0.72, lawyer: 0.80, default: 0.68 },
    opportunity: 'Add trust badges (ADA, BBB, years in practice, certifications) to the hero or header',
    goalRelevance: ['build_trust', 'book_appointments'],
  },
  {
    key: 'missing_faq',
    observationKey: 'hasFAQ',
    label: 'No FAQ section to address common objections',
    baseWeight: 0.60,
    nicheWeights: { dentist: 0.70, hvac: 0.65, lawyer: 0.75, default: 0.60 },
    opportunity: 'Add an FAQ section addressing insurance, pricing, and process questions',
    goalRelevance: ['reduce_friction', 'build_trust'],
  },
  {
    key: 'missing_after_hours_capture',
    observationKey: 'hasAfterHoursCapture',
    label: 'No after-hours lead capture mechanism',
    baseWeight: 0.74,
    nicheWeights: { dentist: 0.85, hvac: 0.90, lawyer: 0.72, default: 0.74 },
    opportunity: 'Add after-hours contact form or missed-call recovery flow to capture leads 24/7',
    goalRelevance: ['recover_missed_leads', 'book_appointments'],
  },
  {
    key: 'outdated_layout',
    observationKey: 'hasOutdatedLayout',
    label: 'Page uses outdated HTML/CSS layout patterns',
    baseWeight: 0.65,
    nicheWeights: { default: 1.0 },
    opportunity: 'Modernize the page layout with responsive design and current CSS',
    goalRelevance: ['improve_mobile_conversion', 'build_trust'],
    invertLogic: true, // weakness when observation IS true
  },
  {
    key: 'not_mobile_optimized',
    observationKey: 'hasViewportMeta',
    label: 'Page may not be mobile-optimized (no viewport meta tag)',
    baseWeight: 0.80,
    nicheWeights: { default: 1.0 },
    opportunity: 'Ensure the site is fully mobile-responsive — most local searches are on mobile',
    goalRelevance: ['improve_mobile_conversion'],
    usePageMetrics: true,
  },
];

// ── Niche → primary goal mapping ─────────────────────────────────────────────

const NICHE_DEFAULT_GOAL = {
  dentist: 'book_appointments',
  hvac:    'request_quote',
  lawyer:  'request_consultation',
  default: 'get_leads',
};

// ── Scoring function ─────────────────────────────────────────────────────────

/**
 * scoreWeaknesses(auditResult, options?)
 *
 * @param {object} auditResult - Output from site-auditor.js
 * @param {object} [options]
 * @param {string} [options.niche='default'] - e.g. 'dentist', 'hvac', 'lawyer'
 * @param {string} [options.primaryGoal] - Override primary goal
 * @param {string[]} [options.leadNotes] - Any notes from the lead data
 * @returns {WeaknessScoringResult}
 */
function scoreWeaknesses(auditResult, options = {}) {
  const niche = (options.niche || 'default').toLowerCase();
  const primaryGoal = options.primaryGoal || NICHE_DEFAULT_GOAL[niche] || NICHE_DEFAULT_GOAL.default;
  const observations = (auditResult && auditResult.observations) || {};
  const pageMetrics  = (auditResult && auditResult.pageMetrics)  || {};

  const weaknesses = [];
  const opportunities = [];

  for (const def of SIGNAL_DEFINITIONS) {
    // Determine if this is a weakness
    let observedValue;
    if (def.usePageMetrics) {
      observedValue = !!pageMetrics[def.observationKey];
    } else {
      observedValue = !!observations[def.observationKey];
    }

    const isWeakness = def.invertLogic ? observedValue : !observedValue;
    if (!isWeakness) continue;

    // Compute priority score
    const nicheMultiplier = (def.nicheWeights && (def.nicheWeights[niche] || def.nicheWeights.default)) || 1.0;
    let priority = def.baseWeight * nicheMultiplier;

    // Boost if this weakness is directly relevant to the primary goal
    if (def.goalRelevance && def.goalRelevance.includes(primaryGoal)) {
      priority = Math.min(1.0, priority * 1.08);
    }

    // Round to 2 decimal places
    priority = Math.round(priority * 100) / 100;

    weaknesses.push({
      key: def.key,
      label: def.label,
      priority,
      opportunity: def.opportunity,
    });

    if (def.opportunity) {
      opportunities.push(def.opportunity);
    }
  }

  // Sort weaknesses by priority descending
  weaknesses.sort((a, b) => b.priority - a.priority);

  // Deduplicate opportunities (preserve order)
  const seen = new Set();
  const uniqueOpportunities = opportunities.filter(o => {
    if (seen.has(o)) return false;
    seen.add(o);
    return true;
  });

  // Compute an overall site score (0–100, higher = better existing site)
  const totalSignals = SIGNAL_DEFINITIONS.filter(d => !d.invertLogic).length;
  const presentSignals = SIGNAL_DEFINITIONS.filter(d => {
    if (d.invertLogic) return false;
    const val = d.usePageMetrics ? !!pageMetrics[d.observationKey] : !!observations[d.observationKey];
    return val;
  }).length;
  const siteScore = Math.round((presentSignals / totalSignals) * 100);

  return {
    niche,
    conversion_goal: primaryGoal,
    site_score: siteScore,
    weakness_count: weaknesses.length,
    weaknesses,
    opportunities: uniqueOpportunities,
    top_issues: weaknesses.slice(0, 5).map(w => w.label),
  };
}

module.exports = { scoreWeaknesses, NICHE_DEFAULT_GOAL };
