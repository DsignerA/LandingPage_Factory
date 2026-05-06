'use strict';

/**
 * lead-ranker.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Assigns a processing tier to each lead before expensive pipeline stages.
 *
 * Tier A (High value):
 *   - Full preview generation
 *   - Full page screenshot
 *   - Side-by-side comparison image
 *   - Outreach packet with personalized email copy
 *
 * Tier B (Medium value):
 *   - Preview generation
 *   - Hero screenshot only
 *   - Basic outreach packet
 *
 * Tier C (Low value):
 *   - Audit only (no preview, no screenshots)
 *
 * Scoring factors:
 *   - Niche priority (dentist/hvac/lawyer = high; generic = low)
 *   - City population tier (major metro = high; small town = low)
 *   - Review count (more reviews = more established = higher value)
 *   - Rating (higher rating = more trustworthy lead)
 *   - Has website (no website = lower value for preview generation)
 *   - Weakness score (more weaknesses = more opportunity = higher value)
 *   - Has ads running (indicates budget)
 */

// ── Niche priority weights ────────────────────────────────────────────────────

const NICHE_PRIORITY = {
  dentist:      10,
  dental:       10,
  orthodontist: 9,
  hvac:         9,
  plumber:      8,
  plumbing:     8,
  lawyer:       9,
  attorney:     9,
  chiropractor: 7,
  optometrist:  7,
  veterinarian: 7,
  vet:          7,
  roofing:      7,
  electrician:  7,
  landscaping:  5,
  cleaning:     5,
  salon:        5,
  restaurant:   4,
  generic:      3,
};

// ── City population tier ──────────────────────────────────────────────────────
// Major US metros get a higher score

const MAJOR_METROS = new Set([
  'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
  'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
  'fort worth', 'columbus', 'charlotte', 'indianapolis', 'san francisco',
  'seattle', 'denver', 'nashville', 'oklahoma city', 'el paso', 'washington',
  'boston', 'las vegas', 'memphis', 'louisville', 'portland', 'baltimore',
  'milwaukee', 'albuquerque', 'tucson', 'fresno', 'sacramento', 'mesa',
  'kansas city', 'atlanta', 'omaha', 'colorado springs', 'raleigh', 'miami',
  'long beach', 'virginia beach', 'minneapolis', 'tampa', 'new orleans',
]);

const MEDIUM_CITIES = new Set([
  'arlington', 'bakersfield', 'honolulu', 'anaheim', 'aurora', 'santa ana',
  'corpus christi', 'riverside', 'lexington', 'stockton', 'st. paul',
  'pittsburgh', 'anchorage', 'greensboro', 'plano', 'lincoln', 'orlando',
  'irvine', 'newark', 'toledo', 'durham', 'chula vista', 'fort wayne',
  'jersey city', 'st. petersburg', 'laredo', 'madison', 'chandler',
  'scottsdale', 'lubbock', 'norfolk', 'winston-salem', 'garland', 'glendale',
  'hialeah', 'reno', 'baton rouge', 'irvine', 'chesapeake', 'gilbert',
]);

function getCityScore(city) {
  const c = String(city || '').toLowerCase().trim();
  if (MAJOR_METROS.has(c))  return 8;
  if (MEDIUM_CITIES.has(c)) return 5;
  return 2;
}

// ── Scoring function ──────────────────────────────────────────────────────────

/**
 * scoreLead(lead, scoringResult)
 *
 * @param {object} lead          - Normalized lead object
 * @param {object} scoringResult - From weakness-scoring.js (optional)
 * @returns {{ score: number, tier: 'A'|'B'|'C', factors: object }}
 */
function scoreLead(lead, scoringResult = {}) {
  const factors = {};
  let score = 0;

  // ── Niche priority ─────────────────────────────────────────────────────────
  const niche = String(lead.niche || '').toLowerCase();
  const nicheScore = NICHE_PRIORITY[niche] || NICHE_PRIORITY.generic;
  factors.niche = nicheScore;
  score += nicheScore;

  // ── City population ────────────────────────────────────────────────────────
  const locationParts = (lead.location || '').split(',').map(s => s.trim());
  const city = lead.city || locationParts[0] || '';
  const cityScore = getCityScore(city);
  factors.city = cityScore;
  score += cityScore;

  // ── Review count ───────────────────────────────────────────────────────────
  const reviewCount = parseInt(lead.review_count || 0, 10);
  let reviewScore = 0;
  if (reviewCount >= 100) reviewScore = 8;
  else if (reviewCount >= 50) reviewScore = 6;
  else if (reviewCount >= 20) reviewScore = 4;
  else if (reviewCount >= 5)  reviewScore = 2;
  else                        reviewScore = 0;
  factors.reviews = reviewScore;
  score += reviewScore;

  // ── Rating ─────────────────────────────────────────────────────────────────
  const rating = parseFloat(lead.rating || 0);
  let ratingScore = 0;
  if (rating >= 4.5) ratingScore = 5;
  else if (rating >= 4.0) ratingScore = 3;
  else if (rating >= 3.5) ratingScore = 1;
  factors.rating = ratingScore;
  score += ratingScore;

  // ── Has website ────────────────────────────────────────────────────────────
  const hasWebsite = !!(lead.website_url || lead.website);
  factors.has_website = hasWebsite ? 3 : 0;
  score += factors.has_website;

  // ── Weakness score (opportunity) ───────────────────────────────────────────
  // More weaknesses = more opportunity to show value
  const siteScore = scoringResult.site_score || 0;
  const weaknessCount = scoringResult.weakness_count || 0;
  let opportunityScore = 0;
  if (siteScore < 40)       opportunityScore = 8; // very weak site = big opportunity
  else if (siteScore < 60)  opportunityScore = 5;
  else if (siteScore < 80)  opportunityScore = 3;
  else                      opportunityScore = 1;
  factors.opportunity = opportunityScore;
  score += opportunityScore;

  // ── Has ads running (if provided) ─────────────────────────────────────────
  if (lead.has_ads || lead.running_ads) {
    factors.ads = 5;
    score += 5;
  } else {
    factors.ads = 0;
  }

  // ── Tier assignment ────────────────────────────────────────────────────────
  // Max possible score: 10 + 8 + 8 + 5 + 3 + 8 + 5 = 47
  let tier;
  if (score >= 28)      tier = 'A';
  else if (score >= 16) tier = 'B';
  else                  tier = 'C';

  return { score, tier, factors, max_score: 47 };
}

/**
 * rankLeads(leads, scoringResults)
 *
 * Ranks an array of leads and returns them sorted by score descending.
 * @param {object[]} leads          - Array of normalized leads
 * @param {object}   scoringResults - Map of lead_id → scoringResult
 * @returns {Array<{ lead, ranking }>}
 */
function rankLeads(leads, scoringResults = {}) {
  const ranked = leads.map(lead => ({
    lead,
    ranking: scoreLead(lead, scoringResults[lead.lead_id] || {}),
  }));

  ranked.sort((a, b) => b.ranking.score - a.ranking.score);
  return ranked;
}

/**
 * getTierConfig(tier)
 * Returns the processing configuration for a given tier.
 */
function getTierConfig(tier) {
  const configs = {
    A: {
      tier: 'A',
      run_audit:      true,
      run_brief:      true,
      run_schema:     true,
      run_preview:    true,
      run_screenshots: true,
      screenshot_mode: 'comparison', // full side-by-side comparison
      run_outreach:   true,
      priority:       9,
    },
    B: {
      tier: 'B',
      run_audit:      true,
      run_brief:      true,
      run_schema:     true,
      run_preview:    true,
      run_screenshots: true,
      screenshot_mode: 'hero', // hero screenshot only
      run_outreach:   true,
      priority:       5,
    },
    C: {
      tier: 'C',
      run_audit:      true,
      run_brief:      false,
      run_schema:     false,
      run_preview:    false,
      run_screenshots: false,
      screenshot_mode: null,
      run_outreach:   false,
      priority:       2,
    },
  };
  return configs[tier] || configs.C;
}

module.exports = { scoreLead, rankLeads, getTierConfig, NICHE_PRIORITY };
