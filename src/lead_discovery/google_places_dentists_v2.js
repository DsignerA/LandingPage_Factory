#!/usr/bin/env node
'use strict';
/**
 * google_places_dentists_v2.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Google Places API lead discovery for dental practices.
 *
 * Searches Google Places for dentists in a target city/region, fetches full
 * place details, scores and tiers each lead, then writes two CSV files that
 * are directly compatible with the existing campaign pipeline:
 *
 *   --out-all       All discovered leads (every result, scored)
 *   --out-priority  Priority leads only  (tier_A, no website or good rating)
 *
 * The generated CSVs work directly with:
 *   npm run campaign -- ./data/lynchburg_priority.csv --out-dir ./campaign-output-lynchburg --verbose
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 *   GOOGLE_MAPS_API_KEY=YOUR_KEY node src/lead_discovery/google_places_dentists_v2.js \
 *     --query "dentist in Lynchburg, VA" \
 *     --out-all ./data/lynchburg_all.csv \
 *     --out-priority ./data/lynchburg_priority.csv
 *
 * ── Options ───────────────────────────────────────────────────────────────────
 *
 *   --query          Text search query (e.g. "dentist in Lynchburg, VA")   [required]
 *   --out-all        Path for all-leads CSV                                 [required]
 *   --out-priority   Path for priority-leads CSV                            [required]
 *   --limit          Max leads to fetch (default: 60)
 *   --min-reviews    Minimum review count to include in output (default: 0)
 *   --min-rating     Minimum rating to include in output (default: 0)
 *
 * ── Environment ───────────────────────────────────────────────────────────────
 *
 *   GOOGLE_MAPS_API_KEY   Required. Google Maps Platform API key with
 *                         Places API enabled.
 *
 * ── API calls made ────────────────────────────────────────────────────────────
 *
 *   1. Text Search  — POST /maps/api/place/textsearch/json
 *      Returns up to 20 results per page; follows next_page_token for more.
 *
 *   2. Place Details — GET /maps/api/place/details/json
 *      One call per place to fetch phone, website, hours, etc.
 *      Fields requested: name, formatted_address, formatted_phone_number,
 *        website, rating, user_ratings_total, opening_hours, business_status,
 *        url, place_id, types
 *
 * ── CSV columns emitted ───────────────────────────────────────────────────────
 *
 *   Columns match the campaign pipeline's csvRowToRawLead() mapper exactly:
 *     lead_id, business_name, niche, city, state, phone, website_url,
 *     rating, review_count, offer_angle
 *
 *   Additional discovery-only columns (ignored by campaign, useful for CRM):
 *     slug, practice_name, city_state_query, address, google_maps_url,
 *     place_id, business_status, hours_summary, website_status,
 *     opportunity_flags, notes, ownership_signal,
 *     priority_score, tier
 */

const { buildLeadSlug }                       = require('./lib/slugify');
const { scoreDentalLead, isPriorityLead, classifyOwnership } = require('./lib/score_dental_lead');
const { writeCsv }                            = require('./lib/csv');

// ── Constants ─────────────────────────────────────────────────────────────────

const PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const PLACES_DETAILS_URL     = 'https://maps.googleapis.com/maps/api/place/details/json';

// Fields to request from Place Details (minimises billing cost)
const DETAIL_FIELDS = [
  'name',
  'formatted_address',
  'formatted_phone_number',
  'website',
  'rating',
  'user_ratings_total',
  'opening_hours',
  'business_status',
  'url',
  'place_id',
  'types',
].join(',');

// CSV column order for the output files
// Campaign-compatible columns come first so the pipeline picks them up correctly.
const CSV_HEADERS = [
  // ── Campaign-compatible columns (read by csvRowToRawLead) ──
  'lead_id',
  'business_name',
  'niche',
  'city',
  'state',
  'phone',
  'website_url',
  'rating',
  'review_count',
  'offer_angle',
  // ── Discovery-only columns (ignored by campaign, useful for CRM) ──
  'slug',
  'practice_name',
  'city_state_query',
  'address',
  'google_maps_url',
  'place_id',
  'business_status',
  'hours_summary',
  'website_status',
  'opportunity_flags',
  'notes',
  'ownership_signal',
  'priority_score',
  'tier',
];

// ── CLI argument parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    query:       null,
    outAll:      null,
    outPriority: null,
    limit:       60,
    minReviews:  0,
    minRating:   0,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if      (a === '--query')        opts.query       = args[++i];
    else if (a === '--out-all')      opts.outAll      = args[++i];
    else if (a === '--out-priority') opts.outPriority = args[++i];
    else if (a === '--limit')        opts.limit       = parseInt(args[++i], 10);
    else if (a === '--min-reviews')  opts.minReviews  = parseInt(args[++i], 10);
    else if (a === '--min-rating')   opts.minRating   = parseFloat(args[++i]);
  }

  return opts;
}

// ── Google Places API helpers ─────────────────────────────────────────────────

/**
 * placesTextSearch(query, apiKey, pageToken?)
 * Calls the Places Text Search API and returns { results, next_page_token }.
 */
async function placesTextSearch(query, apiKey, pageToken) {
  const params = new URLSearchParams({
    query,
    type: 'dentist',
    key:  apiKey,
  });
  if (pageToken) params.set('pagetoken', pageToken);

  const url = `${PLACES_TEXT_SEARCH_URL}?${params}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Places Text Search HTTP ${res.status}: ${await res.text()}`);

  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places Text Search API error: ${data.status} — ${data.error_message || ''}`);
  }

  return {
    results:         data.results || [],
    next_page_token: data.next_page_token || null,
  };
}

/**
 * placeDetails(placeId, apiKey)
 * Fetches full place details for a single place_id.
 */
async function placeDetails(placeId, apiKey) {
  const params = new URLSearchParams({
    place_id: placeId,
    fields:   DETAIL_FIELDS,
    key:      apiKey,
  });

  const url = `${PLACES_DETAILS_URL}?${params}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Place Details HTTP ${res.status}: ${await res.text()}`);

  const data = await res.json();
  if (data.status !== 'OK') {
    throw new Error(`Place Details API error: ${data.status} — ${data.error_message || ''}`);
  }

  return data.result || {};
}

/**
 * sleep(ms) — used between paginated requests to respect the Places API
 * requirement of a short delay before using next_page_token.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Location parsing ──────────────────────────────────────────────────────────

/**
 * parseCityState(query)
 * Extracts city and state from a query like "dentist in Lynchburg, VA".
 * Returns { city, state } — both may be empty strings if not parseable.
 */
function parseCityState(query) {
  // Match "in City, ST" or "in City ST" at the end of the query
  const m = query.match(/\bin\s+([^,]+),?\s+([A-Z]{2})\s*$/i);
  if (m) {
    return {
      city:  m[1].trim(),
      state: m[2].toUpperCase(),
    };
  }
  // Fallback: try to extract from address
  return { city: '', state: '' };
}

/**
 * extractCityStateFromAddress(address)
 * Parses a formatted_address like "123 Main St, Lynchburg, VA 24501, USA"
 * and returns { city, state }.
 */
function extractCityStateFromAddress(address) {
  if (!address) return { city: '', state: '' };
  // US address format: "..., City, ST ZIPCODE, USA"
  const m = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s+\d{5}/);
  if (m) {
    return { city: m[1].trim(), state: m[2].trim() };
  }
  return { city: '', state: '' };
}

// ── Lead builder ──────────────────────────────────────────────────────────────

/**
 * buildLead(place, detail, queryCity, queryState, cityStateQuery)
 * Combines text search result + place detail into a normalised lead object.
 */
function buildLead(place, detail, queryCity, queryState, cityStateQuery) {
  const businessName = (detail.name || place.name || '').trim();

  // City/state: prefer parsed from address, fall back to query
  const addrParsed = extractCityStateFromAddress(detail.formatted_address || place.formatted_address);
  const city  = addrParsed.city  || queryCity  || '';
  const state = addrParsed.state || queryState || '';

  const phone      = detail.formatted_phone_number || '';
  const websiteUrl = detail.website || '';
  const rating     = detail.rating != null ? String(detail.rating) : '';
  const reviewCount = detail.user_ratings_total != null ? String(detail.user_ratings_total) : '';
  const businessStatus = detail.business_status || place.business_status || '';
  const googleMapsUrl  = detail.url || '';
  const placeId        = detail.place_id || place.place_id || '';
  const address        = detail.formatted_address || place.formatted_address || '';

  // Hours summary
  let hoursSummary = '';
  if (detail.opening_hours && detail.opening_hours.weekday_text) {
    hoursSummary = detail.opening_hours.weekday_text.slice(0, 3).join('; ');
  } else if (detail.opening_hours) {
    hoursSummary = detail.opening_hours.open_now != null
      ? (detail.opening_hours.open_now ? 'Currently open' : 'Currently closed')
      : 'hours available';
  }

  // Website status
  const websiteStatus = websiteUrl ? 'active' : 'none';

  // Ownership signal
  const ownershipSignal = classifyOwnership(businessName);

  // Slug (deterministic, stable)
  const slug = buildLeadSlug(businessName, city, state);

  // Lead ID — use place_id hash for stability across re-runs
  const leadId = `gp_${placeId.slice(-8) || slug.slice(-8)}`;

  // Opportunity flags
  const opportunityFlags = [];
  if (!websiteUrl)    opportunityFlags.push('no_website');
  if (!phone)         opportunityFlags.push('no_phone');
  if (!hoursSummary)  opportunityFlags.push('no_hours');
  if (ownershipSignal === 'independent') opportunityFlags.push('independent_practice');
  if (ownershipSignal === 'possible_chain') opportunityFlags.push('possible_chain');

  // Offer angle — a short human-readable pitch hook for the outreach packet
  const offerAngle = buildOfferAngle(businessName, websiteUrl, rating, reviewCount, ownershipSignal);

  // Notes
  const notes = [
    `Discovered via Google Places: "${cityStateQuery}"`,
    businessStatus !== 'OPERATIONAL' ? `Status: ${businessStatus}` : '',
    ownershipSignal === 'possible_chain' ? 'Possible chain/DSO — verify before outreach' : '',
  ].filter(Boolean).join('. ');

  const rawLead = {
    business_name:    businessName,
    website_url:      websiteUrl,
    rating,
    review_count:     reviewCount,
    phone,
    hours_summary:    hoursSummary,
    business_status:  businessStatus,
    ownership_signal: ownershipSignal,
  };

  const scoring = scoreDentalLead(rawLead);

  return {
    // ── Campaign-compatible columns ──
    lead_id:       leadId,
    business_name: businessName,
    niche:         'dentist',
    city,
    state,
    phone,
    website_url:   websiteUrl,
    rating,
    review_count:  reviewCount,
    offer_angle:   offerAngle,
    // ── Discovery-only columns ──
    slug,
    practice_name:    businessName,
    city_state_query: cityStateQuery,
    address,
    google_maps_url:  googleMapsUrl,
    place_id:         placeId,
    business_status:  businessStatus,
    hours_summary:    hoursSummary,
    website_status:   websiteStatus,
    opportunity_flags: opportunityFlags.join('|'),
    notes,
    ownership_signal: ownershipSignal,
    priority_score:   scoring.score,
    tier:             scoring.tier,
    // Internal — used for priority filtering, not written to CSV
    _scoring:         scoring,
    _rawLead:         rawLead,
  };
}

/**
 * buildOfferAngle(businessName, websiteUrl, rating, reviewCount, ownershipSignal)
 * Generates a short, human-readable pitch hook for the outreach packet.
 */
function buildOfferAngle(businessName, websiteUrl, rating, reviewCount, ownershipSignal) {
  const parts = [];
  if (!websiteUrl) {
    parts.push('No website — strong candidate for a new patient-converting landing page');
  } else {
    parts.push('Existing website — candidate for a redesign or conversion-focused landing page');
  }
  const rc = parseInt(reviewCount, 10);
  const rt = parseFloat(rating);
  if (rc >= 50 && rt >= 4.5) {
    parts.push(`${rc} reviews at ${rt}★ — excellent social proof to feature`);
  } else if (rc >= 20) {
    parts.push(`${rc} reviews — solid reputation to highlight`);
  }
  if (ownershipSignal === 'independent') {
    parts.push('Independent practice — personal brand angle available');
  }
  return parts.join('. ');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);

  // ── Validate required args ─────────────────────────────────────────────────
  const missing = [];
  if (!opts.query)       missing.push('--query');
  if (!opts.outAll)      missing.push('--out-all');
  if (!opts.outPriority) missing.push('--out-priority');

  if (missing.length) {
    console.error('Missing required arguments: ' + missing.join(', '));
    console.error('');
    console.error('Usage:');
    console.error('  GOOGLE_MAPS_API_KEY=YOUR_KEY node src/lead_discovery/google_places_dentists_v2.js \\');
    console.error('    --query "dentist in Lynchburg, VA" \\');
    console.error('    --out-all ./data/lynchburg_all.csv \\');
    console.error('    --out-priority ./data/lynchburg_priority.csv');
    process.exit(1);
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('Error: GOOGLE_MAPS_API_KEY environment variable is not set.');
    console.error('Set it before running: GOOGLE_MAPS_API_KEY=YOUR_KEY npm run discover:dentists:v2 -- ...');
    process.exit(1);
  }

  // ── Parse city/state from query ────────────────────────────────────────────
  const { city: queryCity, state: queryState } = parseCityState(opts.query);

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  GOOGLE PLACES DENTAL LEAD DISCOVERY  v2');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Query:        ${opts.query}`);
  console.log(`  City/State:   ${queryCity || '(parsed from addresses)'}, ${queryState || '(parsed from addresses)'}`);
  console.log(`  Limit:        ${opts.limit} leads`);
  if (opts.minReviews) console.log(`  Min reviews:  ${opts.minReviews}`);
  if (opts.minRating)  console.log(`  Min rating:   ${opts.minRating}`);
  console.log('');

  // ── Fetch all place IDs via text search ────────────────────────────────────
  console.log('[1/3] Searching Google Places...');

  const allPlaces = [];
  let pageToken   = null;
  let page        = 0;

  do {
    if (page > 0) {
      // Google requires a short delay before using next_page_token
      process.stdout.write('      Waiting for next page...');
      await sleep(2200);
      process.stdout.write(' done\n');
    }

    const { results, next_page_token } = await placesTextSearch(opts.query, apiKey, pageToken);
    allPlaces.push(...results);
    pageToken = next_page_token;
    page++;

    console.log(`      Page ${page}: ${results.length} results (total so far: ${allPlaces.length})`);
  } while (pageToken && allPlaces.length < opts.limit);

  // Trim to limit
  const placesToProcess = allPlaces.slice(0, opts.limit);
  console.log(`\n      Found ${allPlaces.length} places total, processing ${placesToProcess.length}`);

  // ── Fetch place details ────────────────────────────────────────────────────
  console.log('\n[2/3] Fetching place details...');

  const leads = [];
  let detailErrors = 0;

  for (let i = 0; i < placesToProcess.length; i++) {
    const place = placesToProcess[i];
    const placeId = place.place_id;

    process.stdout.write(`      [${String(i + 1).padStart(3)}/${placesToProcess.length}] ${(place.name || '').slice(0, 50).padEnd(50)} `);

    let detail = {};
    try {
      detail = await placeDetails(placeId, apiKey);
      process.stdout.write('✓\n');
    } catch (err) {
      process.stdout.write(`✗ (${err.message.slice(0, 60)})\n`);
      detailErrors++;
      detail = {}; // use text search data only
    }

    const lead = buildLead(place, detail, queryCity, queryState, opts.query);

    // Apply --min-reviews and --min-rating filters
    if (parseInt(lead.review_count, 10) < opts.minReviews) continue;
    if (parseFloat(lead.rating) < opts.minRating) continue;

    leads.push(lead);

    // Small delay to stay within API rate limits
    if (i < placesToProcess.length - 1) await sleep(100);
  }

  if (detailErrors > 0) {
    console.log(`\n      Note: ${detailErrors} place detail requests failed — those leads use text search data only`);
  }

  // ── Score, tier, and split leads ───────────────────────────────────────────
  console.log('\n[3/3] Scoring and writing CSVs...');

  const priorityLeads = leads.filter(l => isPriorityLead(l._rawLead, l._scoring));
  const noWebsiteLeads = leads.filter(l => !l.website_url || l.website_url.trim() === '');

  // Strip internal fields before writing
  const cleanLeads = leads.map(({ _scoring, _rawLead, ...rest }) => rest);
  const cleanPriority = priorityLeads.map(({ _scoring, _rawLead, ...rest }) => rest);

  // Sort all leads by priority_score descending
  cleanLeads.sort((a, b) => b.priority_score - a.priority_score);
  cleanPriority.sort((a, b) => b.priority_score - a.priority_score);

  writeCsv(opts.outAll,      cleanLeads,    CSV_HEADERS);
  writeCsv(opts.outPriority, cleanPriority, CSV_HEADERS);

  // ── Summary ────────────────────────────────────────────────────────────────
  const tierCounts = leads.reduce((acc, l) => {
    acc[l.tier] = (acc[l.tier] || 0) + 1;
    return acc;
  }, {});

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  DISCOVERY COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total discovered:    ${allPlaces.length}`);
  console.log(`  After filters:       ${leads.length}`);
  console.log(`  No-website leads:    ${noWebsiteLeads.length}`);
  console.log(`  Tier A (score ≥ 18): ${tierCounts['tier_A'] || 0}`);
  console.log(`  Tier B (score ≥ 10): ${tierCounts['tier_B'] || 0}`);
  console.log(`  Tier C (score < 10): ${tierCounts['tier_C'] || 0}`);
  console.log(`  Priority leads:      ${priorityLeads.length}`);
  console.log('─────────────────────────────────────────────────────');
  console.log(`  All leads CSV:       ${opts.outAll}`);
  console.log(`  Priority leads CSV:  ${opts.outPriority}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('Next step — run the campaign on priority leads:');
  console.log(`  npm run campaign -- ${opts.outPriority} --out-dir ./campaign-output --verbose`);
  console.log('');
}

main().catch(err => {
  console.error('[FATAL]', err.message || err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
