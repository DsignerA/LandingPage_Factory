#!/usr/bin/env node
'use strict';
/**
 * google_places_dentists_v3.js
 * ──────────────────────────────────────────────────────────────────────────────
 * High-intent dental lead discovery pipeline.
 *
 * Extends v2 with:
 *   1. Google Ads / sponsored-result detection (Playwright)
 *   2. Website quality auditing (deterministic DOM heuristics)
 *   3. Paid-traffic mismatch scoring (ads + weak site = top priority)
 *   4. Four output CSVs:
 *        --out-all          All discovered leads
 *        --out-priority     Tier A leads (score ≥ 18, no website or good rating)
 *        --out-ads-weak     Leads with Google Ads detected + weak website
 *        --out-no-website   Leads with no website at all
 *
 * All output CSVs are directly compatible with the existing campaign pipeline:
 *   npm run campaign -- ./data/file.csv --out-dir ./campaign-output --verbose
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 *   GOOGLE_MAPS_API_KEY=YOUR_KEY npm run discover:dentists:v3 -- \
 *     --query "dentist in Lynchburg, VA" \
 *     --out-all ./data/lynchburg_all.csv \
 *     --out-priority ./data/lynchburg_priority.csv \
 *     --out-ads-weak ./data/lynchburg_ads_weak.csv \
 *     --out-no-website ./data/lynchburg_no_website.csv
 *
 * ── Options ───────────────────────────────────────────────────────────────────
 *
 *   --query            Text search query                                  [required]
 *   --out-all          Path for all-leads CSV                             [required]
 *   --out-priority     Path for priority-leads CSV                        [required]
 *   --out-ads-weak     Path for ads+weak-site CSV (auto-derived if omitted)
 *   --out-no-website   Path for no-website CSV (auto-derived if omitted)
 *   --limit            Max leads to fetch (default: 60)
 *   --min-reviews      Minimum review count filter (default: 0)
 *   --min-rating       Minimum rating filter (default: 0)
 *   --detect-ads       Run Google Ads detection: true|false (default: true)
 *   --audit-sites      Run website quality audit: true|false (default: true)
 *   --city-label       Override city label used in ad queries (default: parsed from --query)
 *   --max-ad-checks    Max ad queries per lead (default: 2)
 *   --ad-query-mode    "basic" (2 queries) or "expanded" (4 queries) (default: basic)
 *
 * ── Environment ───────────────────────────────────────────────────────────────
 *
 *   GOOGLE_MAPS_API_KEY   Required. Google Maps Platform API key (Places API).
 */

const path = require('path');

const { buildLeadSlug }                                         = require('./lib/slugify');
const { scoreDentalLead, isPriorityLead, classifyOwnership }    = require('./lib/score_dental_lead');
const { writeCsv }                                              = require('./lib/csv');
const { detectGoogleAds }                                       = require('./google_ads_detector');
const { auditWebsite }                                          = require('./website_audit');

// ── Constants ─────────────────────────────────────────────────────────────────

const PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const PLACES_DETAILS_URL     = 'https://maps.googleapis.com/maps/api/place/details/json';

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

// ── CSV column order ──────────────────────────────────────────────────────────
// Campaign-compatible columns first, then discovery/audit/ads columns.

const CSV_HEADERS = [
  // ── Campaign-compatible ──
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
  // ── Discovery metadata ──
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
  'lead_angle',
  // ── Ads detection ──
  'google_ads_detected',
  'ad_queries_checked',
  'ad_queries_matched',
  'ad_evidence',
  'ad_destination_domain',
  'ad_detection_error',
  // ── Website audit ──
  'website_quality',
  'conversion_score',
  'website_weaknesses',
  'ssl_present',
  'mobile_friendly',
  'click_to_call_present',
  'appointment_booking_present',
  'contact_form_present',
  'chat_present',
  'reviews_or_testimonials_present',
  'insurance_info_present',
  'new_patient_info_present',
  'clear_primary_cta_present',
  'modern_layout_signal',
  'page_title_present',
  'meta_description_present',
  'audit_error',
];

// ── CLI argument parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    query:        null,
    outAll:       null,
    outPriority:  null,
    outAdsWeak:   null,
    outNoWebsite: null,
    limit:        60,
    minReviews:   0,
    minRating:    0,
    detectAds:    true,
    auditSites:   true,
    cityLabel:    null,
    maxAdChecks:  2,
    adQueryMode:  'basic',
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if      (a === '--query')          opts.query        = args[++i];
    else if (a === '--out-all')        opts.outAll       = args[++i];
    else if (a === '--out-priority')   opts.outPriority  = args[++i];
    else if (a === '--out-ads-weak')   opts.outAdsWeak   = args[++i];
    else if (a === '--out-no-website') opts.outNoWebsite = args[++i];
    else if (a === '--limit')          opts.limit        = parseInt(args[++i], 10);
    else if (a === '--min-reviews')    opts.minReviews   = parseInt(args[++i], 10);
    else if (a === '--min-rating')     opts.minRating    = parseFloat(args[++i]);
    else if (a === '--detect-ads')     opts.detectAds    = args[++i] !== 'false';
    else if (a === '--audit-sites')    opts.auditSites   = args[++i] !== 'false';
    else if (a === '--city-label')     opts.cityLabel    = args[++i];
    else if (a === '--max-ad-checks')  opts.maxAdChecks  = parseInt(args[++i], 10);
    else if (a === '--ad-query-mode')  opts.adQueryMode  = args[++i];
  }

  return opts;
}

// ── Google Places API helpers ─────────────────────────────────────────────────

async function placesTextSearch(query, apiKey, pageToken) {
  const params = new URLSearchParams({ query, type: 'dentist', key: apiKey });
  if (pageToken) params.set('pagetoken', pageToken);
  const res  = await fetch(`${PLACES_TEXT_SEARCH_URL}?${params}`);
  if (!res.ok) throw new Error(`Places Text Search HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places Text Search API error: ${data.status} — ${data.error_message || ''}`);
  }
  return { results: data.results || [], next_page_token: data.next_page_token || null };
}

async function placeDetails(placeId, apiKey) {
  const params = new URLSearchParams({ place_id: placeId, fields: DETAIL_FIELDS, key: apiKey });
  const res    = await fetch(`${PLACES_DETAILS_URL}?${params}`);
  if (!res.ok) throw new Error(`Place Details HTTP ${res.status}`);
  const data   = await res.json();
  if (data.status !== 'OK') {
    throw new Error(`Place Details API error: ${data.status} — ${data.error_message || ''}`);
  }
  return data.result || {};
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Location parsing ──────────────────────────────────────────────────────────

function parseCityState(query) {
  const m = query.match(/\bin\s+([^,]+),?\s+([A-Z]{2})\s*$/i);
  if (m) return { city: m[1].trim(), state: m[2].toUpperCase() };
  return { city: '', state: '' };
}

function extractCityStateFromAddress(address) {
  if (!address) return { city: '', state: '' };
  const m = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s+\d{5}/);
  if (m) return { city: m[1].trim(), state: m[2].trim() };
  return { city: '', state: '' };
}

// ── Lead builder ──────────────────────────────────────────────────────────────

function buildOfferAngle(businessName, websiteUrl, rating, reviewCount, ownershipSignal, adsDetected, websiteQuality) {
  const parts = [];
  if (!websiteUrl) {
    parts.push('No website — strong candidate for a new patient-converting landing page');
  } else if (adsDetected === 'yes' && websiteQuality === 'weak') {
    parts.push('Running Google Ads with a weak website — conversion-focused upgrade pitch');
  } else if (websiteQuality === 'weak') {
    parts.push('Weak website — conversion-focused redesign opportunity');
  } else if (websiteQuality === 'average') {
    parts.push('Average website — upgrade to convert more traffic');
  } else {
    parts.push('Existing website — candidate for a conversion-focused landing page');
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

function buildLead(place, detail, queryCity, queryState, cityStateQuery) {
  const businessName = (detail.name || place.name || '').trim();
  const addrParsed   = extractCityStateFromAddress(detail.formatted_address || place.formatted_address);
  const city         = addrParsed.city  || queryCity  || '';
  const state        = addrParsed.state || queryState || '';
  const phone        = detail.formatted_phone_number || '';
  const websiteUrl   = detail.website || '';
  const rating       = detail.rating != null ? String(detail.rating) : '';
  const reviewCount  = detail.user_ratings_total != null ? String(detail.user_ratings_total) : '';
  const businessStatus = detail.business_status || place.business_status || '';
  const googleMapsUrl  = detail.url || '';
  const placeId        = detail.place_id || place.place_id || '';
  const address        = detail.formatted_address || place.formatted_address || '';

  let hoursSummary = '';
  if (detail.opening_hours && detail.opening_hours.weekday_text) {
    hoursSummary = detail.opening_hours.weekday_text.slice(0, 3).join('; ');
  } else if (detail.opening_hours) {
    hoursSummary = detail.opening_hours.open_now != null
      ? (detail.opening_hours.open_now ? 'Currently open' : 'Currently closed')
      : 'hours available';
  }

  const websiteStatus   = websiteUrl ? 'active' : 'none';
  const ownershipSignal = classifyOwnership(businessName);
  const slug            = buildLeadSlug(businessName, city, state);
  const leadId          = `gp_${placeId.slice(-8) || slug.slice(-8)}`;

  const opportunityFlags = [];
  if (!websiteUrl)    opportunityFlags.push('no_website');
  if (!phone)         opportunityFlags.push('no_phone');
  if (!hoursSummary)  opportunityFlags.push('no_hours');
  if (ownershipSignal === 'independent')    opportunityFlags.push('independent_practice');
  if (ownershipSignal === 'possible_chain') opportunityFlags.push('possible_chain');

  const notes = [
    `Discovered via Google Places: "${cityStateQuery}"`,
    businessStatus !== 'OPERATIONAL' ? `Status: ${businessStatus}` : '',
    ownershipSignal === 'possible_chain' ? 'Possible chain/DSO — verify before outreach' : '',
  ].filter(Boolean).join('. ');

  return {
    // Campaign-compatible
    lead_id:       leadId,
    business_name: businessName,
    niche:         'dentist',
    city,
    state,
    phone,
    website_url:   websiteUrl,
    rating,
    review_count:  reviewCount,
    offer_angle:   '', // filled in after enrichment
    // Discovery metadata
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
    priority_score:   0,
    tier:             'tier_C',
    lead_angle:       '',
    // Ads detection (filled in after enrichment)
    google_ads_detected:   '',
    ad_queries_checked:    '',
    ad_queries_matched:    '',
    ad_evidence:           '',
    ad_destination_domain: '',
    ad_detection_error:    '',
    // Website audit (filled in after enrichment)
    website_quality:                 '',
    conversion_score:                '',
    website_weaknesses:              '',
    ssl_present:                     '',
    mobile_friendly:                 '',
    click_to_call_present:           '',
    appointment_booking_present:     '',
    contact_form_present:            '',
    chat_present:                    '',
    reviews_or_testimonials_present: '',
    insurance_info_present:          '',
    new_patient_info_present:        '',
    clear_primary_cta_present:       '',
    modern_layout_signal:            '',
    page_title_present:              '',
    meta_description_present:        '',
    audit_error:                     '',
  };
}

// ── Auto-derive output paths ──────────────────────────────────────────────────

function deriveOutputPath(basePath, suffix) {
  const dir  = path.dirname(basePath);
  const base = path.basename(basePath, path.extname(basePath));
  return path.join(dir, `${base}_${suffix}.csv`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);

  // Validate required args
  const missing = [];
  if (!opts.query)      missing.push('--query');
  if (!opts.outAll)     missing.push('--out-all');
  if (!opts.outPriority) missing.push('--out-priority');

  if (missing.length) {
    console.error('Missing required arguments: ' + missing.join(', '));
    console.error('');
    console.error('Usage:');
    console.error('  GOOGLE_MAPS_API_KEY=YOUR_KEY npm run discover:dentists:v3 -- \\');
    console.error('    --query "dentist in Lynchburg, VA" \\');
    console.error('    --out-all ./data/lynchburg_all.csv \\');
    console.error('    --out-priority ./data/lynchburg_priority.csv \\');
    console.error('    --out-ads-weak ./data/lynchburg_ads_weak.csv \\');
    console.error('    --out-no-website ./data/lynchburg_no_website.csv');
    process.exit(1);
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('Error: GOOGLE_MAPS_API_KEY environment variable is not set.');
    process.exit(1);
  }

  // Auto-derive optional output paths
  const outAdsWeak   = opts.outAdsWeak   || deriveOutputPath(opts.outAll, 'ads_weak');
  const outNoWebsite = opts.outNoWebsite || deriveOutputPath(opts.outAll, 'no_website');

  // Parse city/state from query
  const { city: queryCity, state: queryState } = parseCityState(opts.query);
  const cityLabel = opts.cityLabel || (queryCity && queryState ? `${queryCity}, ${queryState}` : queryCity || opts.query);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  GOOGLE PLACES DENTAL LEAD DISCOVERY  v3 (High-Intent)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Query:          ${opts.query}`);
  console.log(`  City label:     ${cityLabel}`);
  console.log(`  Limit:          ${opts.limit} leads`);
  console.log(`  Detect ads:     ${opts.detectAds ? `yes (${opts.adQueryMode} mode, max ${opts.maxAdChecks} queries/lead)` : 'no'}`);
  console.log(`  Audit sites:    ${opts.auditSites ? 'yes' : 'no'}`);
  if (opts.minReviews) console.log(`  Min reviews:    ${opts.minReviews}`);
  if (opts.minRating)  console.log(`  Min rating:     ${opts.minRating}`);
  console.log('');

  // ── Step 1: Fetch all place IDs via text search ────────────────────────────
  console.log('[1/4] Searching Google Places...');

  const allPlaces = [];
  let pageToken   = null;
  let page        = 0;

  do {
    if (page > 0) {
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

  const placesToProcess = allPlaces.slice(0, opts.limit);
  console.log(`\n      Found ${allPlaces.length} places total, processing ${placesToProcess.length}`);

  // ── Step 2: Fetch place details ────────────────────────────────────────────
  console.log('\n[2/4] Fetching place details...');

  const leads = [];
  let detailErrors = 0;

  for (let i = 0; i < placesToProcess.length; i++) {
    const place   = placesToProcess[i];
    const placeId = place.place_id;

    process.stdout.write(`      [${String(i + 1).padStart(3)}/${placesToProcess.length}] ${(place.name || '').slice(0, 48).padEnd(48)} `);

    let detail = {};
    try {
      detail = await placeDetails(placeId, apiKey);
      process.stdout.write('✓\n');
    } catch (err) {
      process.stdout.write(`✗ (${err.message.slice(0, 60)})\n`);
      detailErrors++;
    }

    const lead = buildLead(place, detail, queryCity, queryState, opts.query);

    // Apply filters
    if (parseInt(lead.review_count, 10) < opts.minReviews) continue;
    if (parseFloat(lead.rating)         < opts.minRating)  continue;

    leads.push(lead);
    if (i < placesToProcess.length - 1) await sleep(100);
  }

  if (detailErrors > 0) {
    console.log(`\n      Note: ${detailErrors} place detail requests failed — those leads use text search data only`);
  }

  // ── Step 3: Enrich with ads detection + website audit ─────────────────────
  const totalToEnrich = leads.filter(l => l.website_url || opts.detectAds).length;
  console.log(`\n[3/4] Enriching ${leads.length} leads (ads: ${opts.detectAds}, audit: ${opts.auditSites})...`);

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const hasWebsite = !!(lead.website_url && lead.website_url.trim());

    process.stdout.write(`      [${String(i + 1).padStart(3)}/${leads.length}] ${lead.business_name.slice(0, 45).padEnd(45)} `);

    // ── Website audit ──────────────────────────────────────────────────────
    if (opts.auditSites && hasWebsite) {
      process.stdout.write('[audit] ');
      try {
        const audit = await auditWebsite(lead.website_url, { verbose: false, timeout: 12000 });
        Object.assign(lead, {
          website_quality:                 audit.website_quality,
          conversion_score:                audit.conversion_score,
          website_weaknesses:              audit.website_weaknesses,
          ssl_present:                     audit.ssl_present,
          mobile_friendly:                 audit.mobile_friendly,
          click_to_call_present:           audit.click_to_call_present,
          appointment_booking_present:     audit.appointment_booking_present,
          contact_form_present:            audit.contact_form_present,
          chat_present:                    audit.chat_present,
          reviews_or_testimonials_present: audit.reviews_or_testimonials_present,
          insurance_info_present:          audit.insurance_info_present,
          new_patient_info_present:        audit.new_patient_info_present,
          clear_primary_cta_present:       audit.clear_primary_cta_present,
          modern_layout_signal:            audit.modern_layout_signal,
          page_title_present:              audit.page_title_present,
          meta_description_present:        audit.meta_description_present,
          audit_error:                     audit.audit_error,
        });
        process.stdout.write(`${audit.website_quality.padEnd(7)} `);
      } catch (err) {
        lead.audit_error = err.message.slice(0, 100);
        process.stdout.write('ERR     ');
      }
    } else if (!hasWebsite) {
      process.stdout.write('[no site]        ');
    } else {
      process.stdout.write('[audit skip]     ');
    }

    // ── Ads detection ──────────────────────────────────────────────────────
    if (opts.detectAds) {
      process.stdout.write('[ads] ');
      try {
        const adsResult = await detectGoogleAds(lead, {
          city:      cityLabel,
          mode:      opts.adQueryMode,
          maxChecks: opts.maxAdChecks,
          verbose:   false,
        });
        Object.assign(lead, adsResult);
        process.stdout.write(adsResult.google_ads_detected === 'yes' ? 'ADS✓\n' :
                             adsResult.google_ads_detected === 'unknown' ? 'ERR\n' : 'no\n');
      } catch (err) {
        lead.ad_detection_error = err.message.slice(0, 100);
        process.stdout.write('ERR\n');
      }
    } else {
      process.stdout.write('\n');
    }

    // ── Re-score with enriched data ────────────────────────────────────────
    const rawLead = {
      business_name:               lead.business_name,
      website_url:                 lead.website_url,
      rating:                      lead.rating,
      review_count:                lead.review_count,
      hours_summary:               lead.hours_summary,
      phone:                       lead.phone,
      ownership_signal:            lead.ownership_signal,
      business_status:             lead.business_status,
      google_ads_detected:         lead.google_ads_detected,
      website_quality:             lead.website_quality,
      appointment_booking_present: lead.appointment_booking_present,
      chat_present:                lead.chat_present,
      clear_primary_cta_present:   lead.clear_primary_cta_present,
    };

    const scoring = scoreDentalLead(rawLead);
    lead.priority_score = scoring.score;
    lead.tier           = scoring.tier;
    lead.lead_angle     = scoring.lead_angle;

    // Update offer_angle with enriched context
    lead.offer_angle = buildOfferAngle(
      lead.business_name,
      lead.website_url,
      lead.rating,
      lead.review_count,
      lead.ownership_signal,
      lead.google_ads_detected,
      lead.website_quality,
    );

    // Update opportunity_flags with ads signal
    const flags = lead.opportunity_flags ? lead.opportunity_flags.split('|') : [];
    if (lead.google_ads_detected === 'yes' && !flags.includes('google_ads_detected')) {
      flags.push('google_ads_detected');
    }
    if (lead.website_quality === 'weak' && !flags.includes('weak_website')) {
      flags.push('weak_website');
    }
    lead.opportunity_flags = flags.filter(Boolean).join('|');

    // Small delay between leads to avoid hammering external services
    if (i < leads.length - 1) await sleep(200);
  }

  // ── Step 4: Sort, segment, and write CSVs ─────────────────────────────────
  console.log('\n[4/4] Scoring, segmenting, and writing CSVs...');

  // Sort all leads by priority_score descending
  leads.sort((a, b) => b.priority_score - a.priority_score);

  const priorityLeads = leads.filter(l => {
    const rawLead = {
      website_url:     l.website_url,
      rating:          l.rating,
      review_count:    l.review_count,
      business_status: l.business_status,
    };
    return isPriorityLead(rawLead, { score: l.priority_score });
  });

  const adsWeakLeads   = leads.filter(l => l.google_ads_detected === 'yes' && l.website_quality === 'weak');
  const noWebsiteLeads = leads.filter(l => !l.website_url || l.website_url.trim() === '');
  const adsDetected    = leads.filter(l => l.google_ads_detected === 'yes');

  writeCsv(opts.outAll,    leads,          CSV_HEADERS);
  writeCsv(opts.outPriority, priorityLeads, CSV_HEADERS);
  writeCsv(outAdsWeak,     adsWeakLeads,   CSV_HEADERS);
  writeCsv(outNoWebsite,   noWebsiteLeads, CSV_HEADERS);

  // ── Summary ────────────────────────────────────────────────────────────────
  const tierCounts = leads.reduce((acc, l) => {
    acc[l.tier] = (acc[l.tier] || 0) + 1;
    return acc;
  }, {});

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DISCOVERY COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total discovered:          ${allPlaces.length}`);
  console.log(`  After filters:             ${leads.length}`);
  console.log(`  No-website leads:          ${noWebsiteLeads.length}`);
  console.log(`  Ads detected:              ${adsDetected.length}`);
  console.log(`  Ads + weak website:        ${adsWeakLeads.length}  ← highest-value segment`);
  console.log(`  Tier A (score ≥ 18):       ${tierCounts['tier_A'] || 0}`);
  console.log(`  Tier B (score ≥ 10):       ${tierCounts['tier_B'] || 0}`);
  console.log(`  Tier C (score < 10):       ${tierCounts['tier_C'] || 0}`);
  console.log(`  Priority leads:            ${priorityLeads.length}`);
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  All leads CSV:             ${opts.outAll}`);
  console.log(`  Priority leads CSV:        ${opts.outPriority}`);
  console.log(`  Ads + weak site CSV:       ${outAdsWeak}`);
  console.log(`  No-website CSV:            ${outNoWebsite}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Next steps:');
  console.log(`  # Campaign for ads+weak-site leads (highest LTV):`)
  console.log(`  npm run campaign -- ${outAdsWeak} --out-dir ./campaign-output-ads --verbose`);
  console.log('');
  console.log(`  # Campaign for no-website leads:`);
  console.log(`  npm run campaign -- ${outNoWebsite} --out-dir ./campaign-output-no-site --verbose`);
  console.log('');
}

main().catch(err => {
  console.error('[FATAL]', err.message || err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
