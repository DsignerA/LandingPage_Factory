'use strict';

/**
 * brief-from-audit.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Converts a normalized lead + site audit + weakness scoring result into a
 * structured brief that feeds directly into the existing site generation pipeline.
 *
 * This is the bridge between the intelligence layer (audit + scoring) and the
 * existing site-brief-builder / preview-generator pipeline.
 *
 * Usage:
 *   const { buildBriefFromAudit } = require('./brief-from-audit');
 *   const brief = buildBriefFromAudit(normalizedLead, auditResult, scoringResult);
 *   // brief is a normalized lead enriched with audit intelligence,
 *   // ready to pass directly into buildSiteBrief() or preview-generator.
 */

const buildSiteBrief = require('./site-brief-builder');

// ── Weakness key → opportunity text mapping ──────────────────────────────────
// Maps weakness keys to human-readable opportunity strings for the lead object.
const WEAKNESS_TO_OPPORTUNITY = {
  missing_booking_cta:       'Add a prominent booking CTA in the hero section',
  missing_primary_cta:       'Add a clear, high-contrast CTA button above the fold',
  missing_phone_number:      'Display phone number prominently in the header and hero',
  missing_chat_widget:       'Add a chat widget or virtual front desk for instant lead capture',
  missing_reviews:           'Surface patient/client reviews prominently on the homepage',
  missing_insurance_info:    'Add insurance and payment information near the hero or services',
  missing_service_area_proof:'Add city/neighborhood mentions and local service area proof',
  missing_sticky_mobile_cta: 'Add a persistent mobile CTA bar for on-the-go visitors',
  missing_trust_badges:      'Add trust badges and credentials to the hero or header',
  missing_faq:               'Add an FAQ section addressing common objections',
  missing_after_hours_capture:'Add after-hours lead capture to recover missed patients',
  outdated_layout:           'Modernize the page layout with responsive design',
  not_mobile_optimized:      'Ensure the site is fully mobile-responsive',
};

// ── Weakness key → offer angle mapping ──────────────────────────────────────
// Used to derive a compelling offer angle from the top weakness.
const WEAKNESS_TO_OFFER_ANGLE = {
  missing_booking_cta:        'book_appointments',
  missing_after_hours_capture:'recover_missed_leads',
  missing_chat_widget:        'recover_missed_leads',
  missing_reviews:            'build_trust',
  missing_insurance_info:     'reduce_friction',
  missing_sticky_mobile_cta:  'improve_mobile_conversion',
  outdated_layout:            'modernize_site',
  not_mobile_optimized:       'improve_mobile_conversion',
};

// ── Niche → conversion goal mapping ─────────────────────────────────────────
const NICHE_TO_GOAL = {
  dentist:  'book_appointments',
  dental:   'book_appointments',
  hvac:     'request_quote',
  lawyer:   'request_consultation',
  attorney: 'request_consultation',
  plumber:  'request_quote',
  roofer:   'request_quote',
  default:  'get_leads',
};

function resolveGoalFromNiche(niche) {
  const n = String(niche || '').toLowerCase();
  for (const [key, goal] of Object.entries(NICHE_TO_GOAL)) {
    if (n.includes(key)) return goal;
  }
  return NICHE_TO_GOAL.default;
}

// ── Main function ────────────────────────────────────────────────────────────

/**
 * buildBriefFromAudit(normalizedLead, auditResult, scoringResult, options?)
 *
 * @param {object} normalizedLead   - From core/lead-normalizer.js
 * @param {object} auditResult      - From src/audit/site-auditor.js
 * @param {object} scoringResult    - From src/audit/weakness-scoring.js
 * @param {object} [options]
 * @returns {object} enrichedLead   - Normalized lead enriched with audit intelligence
 * @returns {object} siteBrief      - Full site brief ready for preview-generator
 */
function buildBriefFromAudit(normalizedLead, auditResult, scoringResult, options = {}) {
  const lead = Object(normalizedLead || {});
  const audit = Object(auditResult || {});
  const scoring = Object(scoringResult || {});

  // ── Derive opportunities from weaknesses ────────────────────────────────
  const topWeaknesses = (scoring.weaknesses || []).slice(0, 6);
  const opportunities = topWeaknesses
    .map(w => WEAKNESS_TO_OPPORTUNITY[w.key] || w.opportunity || w.label)
    .filter(Boolean);

  // ── Derive offer angle from top weakness ────────────────────────────────
  const topWeaknessKey = topWeaknesses.length > 0 ? topWeaknesses[0].key : null;
  const offerAngle = topWeaknessKey
    ? (WEAKNESS_TO_OFFER_ANGLE[topWeaknessKey] || resolveGoalFromNiche(lead.niche))
    : resolveGoalFromNiche(lead.niche);

  // ── Build enriched lead ──────────────────────────────────────────────────
  // This is the normalized lead enriched with audit intelligence.
  // It's passed to buildSiteBrief() which uses these fields for structural decisions.
  const enrichedLead = Object.assign({}, lead, {
    // Audit-derived fields
    website_url:  audit.website_url || lead.website_url || null,
    offer_angle:  offerAngle,
    opportunities: opportunities.length > 0 ? opportunities : (lead.opportunities || []),
    weaknesses:   topWeaknesses.map(w => w.label),

    // Audit metadata (for strategy panel and outreach packet)
    _audit: {
      fetch_status:   audit.fetch_status || 'unknown',
      observations:   audit.observations || {},
      rawFindings:    audit.rawFindings || [],
      pageMetrics:    audit.pageMetrics || {},
      audited_at:     audit.audited_at || null,
    },
    _scoring: {
      site_score:     scoring.site_score || 0,
      weakness_count: scoring.weakness_count || 0,
      top_issues:     scoring.top_issues || [],
      conversion_goal:scoring.conversion_goal || resolveGoalFromNiche(lead.niche),
    },
  });

  // ── Build the full site brief ────────────────────────────────────────────
  const siteBrief = buildSiteBrief(enrichedLead, options);

  // ── Attach audit intelligence to the brief ───────────────────────────────
  // These fields are used by the strategy panel and outreach packet builder.
  siteBrief._auditIntelligence = {
    site_score:     scoring.site_score || 0,
    weakness_count: scoring.weakness_count || 0,
    top_issues:     scoring.top_issues || [],
    opportunities:  scoring.opportunities || [],
    rawFindings:    audit.rawFindings || [],
    observations:   audit.observations || {},
    fetch_status:   audit.fetch_status || 'unknown',
  };

  return { enrichedLead, siteBrief };
}

/**
 * buildBriefFromAuditOnly(normalizedLead, auditResult, scoringResult, options?)
 * Convenience wrapper that returns just the siteBrief.
 */
function buildBriefFromAuditOnly(normalizedLead, auditResult, scoringResult, options = {}) {
  return buildBriefFromAudit(normalizedLead, auditResult, scoringResult, options).siteBrief;
}

module.exports = { buildBriefFromAudit, buildBriefFromAuditOnly };
