'use strict';

/**
 * strategy-summary.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Generates a concise, sales-facing summary of why the generated preview works.
 * Based on the actual weaknesses/opportunities and selected page strategy —
 * NOT generic filler.
 *
 * Output is used in:
 *   - The strategy explanation panel (in-page overlay)
 *   - The outreach packet (cold email / CRM import)
 *   - The campaign export CSV
 */

// ── Weakness key → strategy bullet mapping ───────────────────────────────────
// Maps weakness keys to concrete, benefit-oriented strategy bullets.
const WEAKNESS_TO_STRATEGY_BULLET = {
  missing_booking_cta: {
    bullet: 'Appointment CTA moved above the fold to capture booking intent immediately',
    impact: 'Potential lift in appointment requests from homepage visitors',
  },
  missing_primary_cta: {
    bullet: 'High-contrast primary CTA button added to the hero section',
    impact: 'Reduced visitor confusion about the next step to take',
  },
  missing_phone_number: {
    bullet: 'Phone number surfaced prominently in the header and hero for instant contact',
    impact: 'Improved click-to-call rate from mobile visitors',
  },
  missing_chat_widget: {
    bullet: 'Virtual front desk / chat widget added for real-time lead capture',
    impact: 'Ability to capture leads who prefer messaging over calling',
  },
  missing_reviews: {
    bullet: 'Patient reviews and star ratings surfaced near the top of the page',
    impact: 'Faster trust-building for first-time visitors who are comparison-shopping',
  },
  missing_insurance_info: {
    bullet: 'Insurance and payment information added near the services section',
    impact: 'Reduced front-desk friction — fewer "do you take my insurance?" calls',
  },
  missing_service_area_proof: {
    bullet: 'Local neighborhood and city mentions added throughout the page',
    impact: 'Stronger local relevance signal for both visitors and search engines',
  },
  missing_sticky_mobile_cta: {
    bullet: 'Persistent mobile CTA bar added — stays visible as visitors scroll',
    impact: 'Improved mobile conversion path for on-the-go patients',
  },
  missing_trust_badges: {
    bullet: 'Trust badges and professional credentials added to the hero section',
    impact: 'Immediate credibility for new visitors who don\'t know the practice',
  },
  missing_faq: {
    bullet: 'FAQ section added to address common objections before they become drop-offs',
    impact: 'Reduced bounce rate from visitors with unanswered questions',
  },
  missing_after_hours_capture: {
    bullet: 'After-hours lead capture flow added to recover missed patients 24/7',
    impact: 'Potential recovery of leads who visit outside business hours',
  },
  outdated_layout: {
    bullet: 'Page layout modernized with responsive design and current visual standards',
    impact: 'Improved first impression and mobile experience for all visitors',
  },
  not_mobile_optimized: {
    bullet: 'Full mobile responsiveness implemented — page adapts to all screen sizes',
    impact: 'Better experience for the majority of local search traffic (mobile-first)',
  },
};

// ── Goal → projected impact mapping ─────────────────────────────────────────
const GOAL_TO_PROJECTED_IMPACT = {
  book_appointments: [
    'Potential lift in appointment requests from homepage visitors',
    'Improved mobile conversion path for on-the-go patients',
    'Reduced lead loss after hours with capture flow',
  ],
  request_quote: [
    'More quote requests from visitors who previously bounced',
    'Faster response loop with visible phone number and chat',
    'Improved trust signals to reduce hesitation before contacting',
  ],
  request_consultation: [
    'More consultation requests from visitors who previously left without acting',
    'Stronger credibility signals to convert comparison-shoppers',
    'Clearer next step reduces decision fatigue',
  ],
  recover_missed_leads: [
    'After-hours lead capture recovers patients who visit outside business hours',
    'Chat and form capture visitors who won\'t call',
    'Persistent mobile CTA reduces drop-off on mobile devices',
  ],
  get_leads: [
    'Clearer CTA path increases form submissions and calls',
    'Trust signals reduce hesitation for first-time visitors',
    'Local proof improves relevance for nearby searchers',
  ],
};

// ── Offer angle → offer angle bullets ───────────────────────────────────────
const OFFER_ANGLE_BULLETS = {
  book_appointments:      'Hero restructured around booking intent — the #1 goal of the page',
  recover_missed_leads:   'Missed-patient recovery flow added — captures leads 24/7',
  build_trust:            'Trust and social proof moved near the top to convert skeptical visitors',
  reduce_friction:        'Insurance and payment clarity added to reduce front-desk friction',
  improve_mobile_conversion: 'Mobile conversion path rebuilt from the ground up',
  modernize_site:         'Visual design modernized to match patient expectations in the current market',
  request_quote:          'Quote request flow made prominent and frictionless',
  request_consultation:   'Consultation CTA made the clear primary action on the page',
};

// ── Main function ────────────────────────────────────────────────────────────

/**
 * generateStrategySummary(options)
 *
 * @param {object} options
 * @param {object}   options.scoringResult   - From weakness-scoring.js
 * @param {object}   options.siteBrief       - From site-brief-builder.js / brief-from-audit.js
 * @param {object}   [options.auditResult]   - From site-auditor.js (optional)
 * @param {string}   [options.offerAngle]    - Override offer angle
 * @returns {StrategySummaryResult}
 */
function generateStrategySummary(options = {}) {
  const { scoringResult, siteBrief, auditResult, offerAngle: offerAngleOverride } = options;

  const scoring   = Object(scoringResult || {});
  const brief     = Object(siteBrief || {});
  const audit     = Object(auditResult || {});
  const auditIntel = brief._auditIntelligence || {};

  const goal       = scoring.conversion_goal || brief.primary_goal || 'get_leads';
  const offerAngle = offerAngleOverride || brief.offer_angle || goal;
  const topWeaknesses = (scoring.weaknesses || []).slice(0, 6);

  // ── Build strategy bullets ───────────────────────────────────────────────
  const summaryBullets = [];

  // Lead with the offer angle bullet
  const offerBullet = OFFER_ANGLE_BULLETS[offerAngle];
  if (offerBullet) summaryBullets.push(offerBullet);

  // Add per-weakness strategy bullets (skip if already covered by offer angle)
  for (const weakness of topWeaknesses) {
    const def = WEAKNESS_TO_STRATEGY_BULLET[weakness.key];
    if (!def) continue;
    if (summaryBullets.includes(def.bullet)) continue;
    summaryBullets.push(def.bullet);
    if (summaryBullets.length >= 5) break;
  }

  // ── Build projected impact ───────────────────────────────────────────────
  const projectedImpact = [];

  // Add goal-specific impacts
  const goalImpacts = GOAL_TO_PROJECTED_IMPACT[goal] || GOAL_TO_PROJECTED_IMPACT.get_leads;
  projectedImpact.push(...goalImpacts.slice(0, 2));

  // Add weakness-specific impacts
  for (const weakness of topWeaknesses.slice(0, 3)) {
    const def = WEAKNESS_TO_STRATEGY_BULLET[weakness.key];
    if (!def || !def.impact) continue;
    if (projectedImpact.includes(def.impact)) continue;
    projectedImpact.push(def.impact);
    if (projectedImpact.length >= 4) break;
  }

  // ── Build offer angles (for outreach) ───────────────────────────────────
  const offerAngles = [];
  const niche = (brief.niche || '').toLowerCase();

  if (topWeaknesses.some(w => w.key === 'missing_booking_cta' || w.key === 'missing_primary_cta')) {
    offerAngles.push('Turn more website visitors into appointment requests');
  }
  if (topWeaknesses.some(w => w.key === 'missing_after_hours_capture' || w.key === 'missing_chat_widget')) {
    offerAngles.push('Recover missed patients who visit your site after hours');
  }
  if (topWeaknesses.some(w => w.key === 'missing_sticky_mobile_cta' || w.key === 'not_mobile_optimized')) {
    offerAngles.push('Capture more mobile visitors — most local searches happen on phones');
  }
  if (topWeaknesses.some(w => w.key === 'missing_reviews' || w.key === 'missing_trust_badges')) {
    offerAngles.push('Build instant trust with new patients who don\'t know your practice yet');
  }
  if (topWeaknesses.some(w => w.key === 'missing_insurance_info')) {
    offerAngles.push('Reduce "do you take my insurance?" calls with clear coverage info');
  }
  if (offerAngles.length === 0) {
    offerAngles.push('Modernize your online presence to match patient expectations');
    offerAngles.push('Convert more website visitors into booked appointments');
  }

  // ── Site score context ───────────────────────────────────────────────────
  const siteScore = scoring.site_score || auditIntel.site_score || 0;
  let siteScoreContext;
  if (siteScore >= 70) {
    siteScoreContext = `Current site scores ${siteScore}/100 — strong foundation with targeted improvements available`;
  } else if (siteScore >= 40) {
    siteScoreContext = `Current site scores ${siteScore}/100 — several key conversion elements are missing`;
  } else {
    siteScoreContext = `Current site scores ${siteScore}/100 — significant conversion opportunities exist`;
  }

  return {
    goal,
    offer_angle: offerAngle,
    site_score: siteScore,
    site_score_context: siteScoreContext,
    summary_bullets: summaryBullets,
    projected_impact: projectedImpact,
    offer_angles: offerAngles.slice(0, 3),
    top_issues: scoring.top_issues || [],
    generated_at: new Date().toISOString(),
  };
}

module.exports = { generateStrategySummary };
