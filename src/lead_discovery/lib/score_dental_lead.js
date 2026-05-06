'use strict';
/**
 * score_dental_lead.js  (v3)
 * ──────────────────────────────────────────────────────────────────────────────
 * Scoring model for discovered dental leads.
 *
 * v3 adds:
 *   - google_ads_detected signal (+12 pts)
 *   - website_quality signal (weak +10, average +4)
 *   - appointment_booking_present=false (+6)
 *   - chat_present=false (+2)
 *   - clear_primary_cta_present=false (+3)
 *   - paid traffic + weak website COMBO BONUS (+10)
 *   - lead_angle classification
 *
 * All v2 rules are preserved unchanged so v2 output remains identical when
 * the new fields are absent.
 *
 * ── Tier assignment ───────────────────────────────────────────────────────────
 *   tier_A  ≥ 18  — highest priority
 *   tier_B  ≥ 10  — medium priority
 *   tier_C  <  10 — low priority
 *
 * ── Priority threshold (--out-priority CSV) ──────────────────────────────────
 *   score ≥ 18 AND (no website OR rating ≥ 4.0) AND review_count ≥ 10
 *   AND business_status is not CLOSED_PERMANENTLY
 *
 * ── lead_angle values ─────────────────────────────────────────────────────────
 *   no_website              — no website at all (best cold outreach angle)
 *   ads_plus_weak_website   — running ads but site is weak (highest LTV angle)
 *   strong_reputation_no_site — high reviews/rating, no website
 *   average_site_upgrade    — has a site, average quality, good reputation
 *   low_priority            — chain, closed, or low score
 */

// ── Chain / corporate signal classifier ──────────────────────────────────────

const CHAIN_SIGNALS = [
  'aspen dental',
  'heartland dental',
  'affordable dentures',
  'dentalworks',
  'great expressions',
  'western dental',
  'pacific dental',
  'bright now dental',
  'smile brands',
  'gentle dental',
  'coast dental',
  'smiledirectclub',
  'smile direct',
  'dental care alliance',
  'dental associates',
  'dental express',
  'dental depot',
  'dental one',
  'dental works',
  'dental365',
  'clear choice',
  'clearchoice',
  'kool smiles',
  'perfect teeth',
  'midwest dental',
  'small smiles',
  'family dental care',
  'family dentistry of',
];

const CHAIN_PATTERNS = [
  /\bdsm\b/i,
  /\bdso\b/i,
  /\bgroup\s+dental/i,
  /dental\s+group\s+of/i,
  /\bsmile\s+more\b/i,
];

/**
 * classifyOwnership(businessName)
 * Returns: "possible_chain" | "independent" | "unknown"
 */
function classifyOwnership(businessName) {
  if (!businessName) return 'unknown';
  const lower = businessName.toLowerCase();

  for (const signal of CHAIN_SIGNALS) {
    if (lower.includes(signal)) return 'possible_chain';
  }
  for (const pattern of CHAIN_PATTERNS) {
    if (pattern.test(businessName)) return 'possible_chain';
  }

  const independentPatterns = [
    /dr\.?\s+[a-z]+/i,
    /[a-z]+\s+(family|cosmetic|holistic|pediatric|general)\s+dent/i,
    /[a-z]+\s+dental\s+(studio|boutique|spa|loft|arts|care)/i,
  ];
  for (const p of independentPatterns) {
    if (p.test(businessName)) return 'independent';
  }

  return 'unknown';
}

// ── Scoring rules ─────────────────────────────────────────────────────────────
//
// Each rule has: name, points, reason, test(lead).
// Rules are evaluated in order; the score is the sum of all matching rules.
// The `lead` object may include any of these fields:
//   business_name, website_url, rating, review_count, hours_summary, phone,
//   ownership_signal, business_status,
//   google_ads_detected, website_quality,
//   appointment_booking_present, chat_present, clear_primary_cta_present

const SCORING_RULES = [
  // ── v2 rules (unchanged) ──────────────────────────────────────────────────
  {
    name:   'no_website',
    points: 15,
    reason: 'No website — highest outreach opportunity',
    test:   (lead) => !lead.website_url || lead.website_url.trim() === '',
  },
  {
    name:   'rating_exceptional',
    points: 6,
    reason: 'Rating ≥ 4.7 — exceptional reputation, easy social proof angle',
    test:   (lead) => parseFloat(lead.rating) >= 4.7,
  },
  {
    name:   'rating_strong',
    points: 3,
    reason: 'Rating ≥ 4.4 — strong reputation',
    test:   (lead) => parseFloat(lead.rating) >= 4.4 && parseFloat(lead.rating) < 4.7,
  },
  {
    name:   'reviews_high',
    points: 10,
    reason: 'Review count ≥ 100 — established practice with strong social proof',
    test:   (lead) => parseInt(lead.review_count, 10) >= 100,
  },
  {
    name:   'reviews_moderate',
    points: 5,
    reason: 'Review count ≥ 30 — decent review volume',
    test:   (lead) => parseInt(lead.review_count, 10) >= 30 && parseInt(lead.review_count, 10) < 100,
  },
  {
    name:   'reviews_minimal',
    points: 2,
    reason: 'Review count ≥ 10 — some social proof',
    test:   (lead) => parseInt(lead.review_count, 10) >= 10 && parseInt(lead.review_count, 10) < 30,
  },
  {
    name:   'missing_hours',
    points: 2,
    reason: 'No hours listed — incomplete online presence',
    test:   (lead) => !lead.hours_summary || lead.hours_summary.trim() === '' || lead.hours_summary === 'not listed',
  },
  {
    name:   'missing_phone',
    points: 2,
    reason: 'No phone number — incomplete online presence',
    test:   (lead) => !lead.phone || lead.phone.trim() === '',
  },
  {
    name:   'family_dentistry_keyword',
    points: 3,
    reason: '"Family dentistry" in name — strong niche fit for outreach',
    test:   (lead) => /family\s+dent/i.test(lead.business_name || ''),
  },
  {
    name:   'cosmetic_keyword',
    points: 3,
    reason: '"Cosmetic" in name — premium niche, higher LTV angle',
    test:   (lead) => /cosmetic/i.test(lead.business_name || ''),
  },
  {
    name:   'holistic_keyword',
    points: 2,
    reason: '"Holistic" or "natural" in name — differentiated niche',
    test:   (lead) => /holistic|natural|biological|biologic/i.test(lead.business_name || ''),
  },
  {
    name:   'pediatric_keyword',
    points: 2,
    reason: '"Pediatric" or "kids" in name — specialised niche',
    test:   (lead) => /pediatric|paediatric|kids|children/i.test(lead.business_name || ''),
  },
  {
    name:   'chain_penalty',
    points: -8,
    reason: 'Likely chain/DSO — lower outreach value',
    test:   (lead) => lead.ownership_signal === 'possible_chain',
  },
  {
    name:   'business_status_closed',
    points: -20,
    reason: 'Business reported as permanently closed',
    test:   (lead) => (lead.business_status || '').toUpperCase() === 'CLOSED_PERMANENTLY',
  },

  // ── v3 rules — ads + site quality ────────────────────────────────────────
  {
    name:   'google_ads_detected',
    points: 12,
    reason: 'Google Ads detected — practice is paying for traffic; strong upgrade pitch',
    test:   (lead) => lead.google_ads_detected === 'yes',
  },
  {
    name:   'website_quality_weak',
    points: 10,
    reason: 'Website quality = weak — poor conversion readiness, strong landing page pitch',
    test:   (lead) => lead.website_quality === 'weak',
  },
  {
    name:   'website_quality_average',
    points: 4,
    reason: 'Website quality = average — moderate conversion readiness, upgrade opportunity',
    test:   (lead) => lead.website_quality === 'average',
  },
  {
    name:   'no_appointment_booking',
    points: 6,
    reason: 'No appointment booking on site — major conversion gap',
    // Only fires when we have audit data (website_quality is set) and booking is absent
    test:   (lead) => lead.website_quality != null &&
                      lead.website_quality !== '' &&
                      lead.appointment_booking_present === false,
  },
  {
    name:   'no_chat',
    points: 2,
    reason: 'No live chat on site — engagement gap',
    test:   (lead) => lead.website_quality != null &&
                      lead.website_quality !== '' &&
                      lead.chat_present === false,
  },
  {
    name:   'no_clear_cta',
    points: 3,
    reason: 'No clear primary CTA on site — conversion gap',
    test:   (lead) => lead.website_quality != null &&
                      lead.website_quality !== '' &&
                      lead.clear_primary_cta_present === false,
  },
  {
    name:   'ads_plus_weak_website_combo',
    points: 10,
    reason: 'COMBO: Running ads AND weak website — highest-value upgrade pitch (paying for traffic, losing conversions)',
    test:   (lead) => lead.google_ads_detected === 'yes' && lead.website_quality === 'weak',
  },
];

// ── Lead angle classifier ─────────────────────────────────────────────────────

/**
 * classifyLeadAngle(lead, scoring)
 * Returns a human-readable angle string for the outreach pitch.
 *
 * Values:
 *   no_website              — no website at all
 *   ads_plus_weak_website   — running ads, weak site (highest LTV)
 *   strong_reputation_no_site — high reviews/rating, no website
 *   average_site_upgrade    — has site, average quality
 *   low_priority            — chain, closed, or low score
 */
function classifyLeadAngle(lead, scoring) {
  const hasNoWebsite  = !lead.website_url || lead.website_url.trim() === '';
  const hasAds        = lead.google_ads_detected === 'yes';
  const siteWeak      = lead.website_quality === 'weak';
  const siteAverage   = lead.website_quality === 'average';
  const isChain       = lead.ownership_signal === 'possible_chain';
  const isClosed      = (lead.business_status || '').toUpperCase() === 'CLOSED_PERMANENTLY';
  const highRep       = parseFloat(lead.rating) >= 4.5 && parseInt(lead.review_count, 10) >= 30;

  if (isClosed || isChain || scoring.score < 5) return 'low_priority';
  if (hasAds && siteWeak)                        return 'ads_plus_weak_website';
  if (hasNoWebsite && highRep)                   return 'strong_reputation_no_site';
  if (hasNoWebsite)                              return 'no_website';
  if (siteAverage)                               return 'average_site_upgrade';
  return 'low_priority';
}

// ── Main scoring function ─────────────────────────────────────────────────────

/**
 * scoreDentalLead(lead)
 *
 * @param {object} lead — raw lead object. v2 fields always work; v3 adds:
 *   google_ads_detected, website_quality, appointment_booking_present,
 *   chat_present, clear_primary_cta_present
 * @returns {{
 *   score:         number,
 *   tier:          string,
 *   lead_angle:    string,
 *   rules_matched: string[],
 *   reasons:       string[],
 * }}
 */
function scoreDentalLead(lead) {
  const rulesMatched = [];
  const reasons      = [];
  let score          = 0;

  for (const rule of SCORING_RULES) {
    if (rule.test(lead)) {
      score += rule.points;
      rulesMatched.push(rule.name);
      reasons.push(`${rule.points > 0 ? '+' : ''}${rule.points} ${rule.reason}`);
    }
  }

  const tier      = score >= 18 ? 'tier_A' : score >= 10 ? 'tier_B' : 'tier_C';
  const leadAngle = classifyLeadAngle(lead, { score });

  return { score, tier, lead_angle: leadAngle, rules_matched: rulesMatched, reasons };
}

// ── Priority filter ───────────────────────────────────────────────────────────

/**
 * isPriorityLead(lead, scoring)
 * Returns true if the lead should appear in the --out-priority CSV.
 *
 * Conditions (all must be true):
 *   1. score ≥ 18
 *   2. no website OR rating ≥ 4.0
 *   3. review_count ≥ 10
 *   4. business_status is not CLOSED_PERMANENTLY
 */
function isPriorityLead(lead, scoring) {
  if (scoring.score < 18) return false;
  const hasNoWebsite  = !lead.website_url || lead.website_url.trim() === '';
  const hasGoodRating = parseFloat(lead.rating) >= 4.0;
  if (!hasNoWebsite && !hasGoodRating) return false;
  if (parseInt(lead.review_count, 10) < 10) return false;
  if ((lead.business_status || '').toUpperCase() === 'CLOSED_PERMANENTLY') return false;
  return true;
}

module.exports = {
  scoreDentalLead,
  isPriorityLead,
  classifyOwnership,
  classifyLeadAngle,
  SCORING_RULES,
};
