'use strict';
/**
 * google_ads_detector.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Detects whether a dental practice appears to be running Google Ads / sponsored
 * search placements for local-intent queries.
 *
 * Strategy:
 *   1. Launch a headless Chromium browser via Playwright.
 *   2. For each configured query template, navigate to Google Search.
 *   3. Inspect the page for sponsored/ad labels and extract ad destination domains.
 *   4. Match each ad against the lead's business name and/or website domain.
 *   5. Record evidence conservatively — never overclaim.
 *
 * Detection is "best effort":
 *   - If Google returns no ads for a query, output google_ads_detected=no.
 *   - If the browser fails for any reason, output google_ads_detected=unknown
 *     with an error note rather than crashing the caller.
 *
 * ── Ad detection approach ─────────────────────────────────────────────────────
 *
 * Google Search marks sponsored results with visible "Sponsored" text in the
 * result block. The detector looks for:
 *   - Aria labels containing "Ad" or "Sponsored" on result containers
 *   - Visible text nodes matching /^Sponsored$/i or /^Ad$/i
 *   - The data-text-ad attribute on result divs (used in some Google layouts)
 *
 * Domain matching:
 *   - Extracts the display URL from each ad block (the green/grey URL shown
 *     under the ad headline).
 *   - Normalises both the lead domain and the ad domain to their eTLD+1 for
 *     comparison (e.g. "www.smilecare.com" → "smilecare.com").
 *   - Also checks whether the lead's business name appears in the ad headline
 *     text (fuzzy, case-insensitive substring match).
 *
 * ── Output fields ─────────────────────────────────────────────────────────────
 *
 *   google_ads_detected      "yes" | "no" | "unknown"
 *   ad_queries_checked       comma-separated list of queries run
 *   ad_queries_matched       comma-separated list of queries where a match was found
 *   ad_evidence              pipe-delimited evidence strings (ad headline + domain)
 *   ad_destination_domain    domain of the matched ad (first match wins)
 *   ad_detection_error       error message if detection failed technically
 */

// ── Query templates ───────────────────────────────────────────────────────────

/**
 * buildAdQueries(city, mode)
 * Returns an array of search queries to check for sponsored results.
 *
 * @param {string} city  — e.g. "Lynchburg, VA" or "Lynchburg"
 * @param {string} mode  — "basic" (2 queries) or "expanded" (4 queries)
 */
function buildAdQueries(city, mode = 'basic') {
  const c = city || 'near me';
  const basic = [
    `dentist in ${c}`,
    `family dentist in ${c}`,
  ];
  const expanded = [
    ...basic,
    `cosmetic dentist in ${c}`,
    `dentist near me ${c}`,
  ];
  return mode === 'expanded' ? expanded : basic;
}

// ── Domain normalisation ──────────────────────────────────────────────────────

/**
 * normaliseDomain(url)
 * Extracts the eTLD+1 from a URL or domain string.
 * "https://www.smilecare.com/new-patients" → "smilecare.com"
 */
function normaliseDomain(url) {
  if (!url) return '';
  try {
    // Add protocol if missing so URL() can parse it
    const withProto = url.startsWith('http') ? url : `https://${url}`;
    const hostname  = new URL(withProto).hostname.toLowerCase();
    // Strip common subdomains (www, m, app, etc.)
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  } catch {
    return url.toLowerCase().replace(/^www\./, '').split('/')[0];
  }
}

// ── Name matching ─────────────────────────────────────────────────────────────

/**
 * nameMatchesAd(businessName, adText)
 * Returns true if the business name appears (case-insensitive substring) in the
 * ad headline or display URL text.
 */
function nameMatchesAd(businessName, adText) {
  if (!businessName || !adText) return false;
  // Use the first 3 significant words of the business name for matching
  const words = businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 3);
  if (words.length === 0) return false;
  const haystack = adText.toLowerCase();
  // Require at least 2 of the 3 words to match (or all if fewer than 2)
  const threshold = Math.min(2, words.length);
  const matched   = words.filter(w => haystack.includes(w)).length;
  return matched >= threshold;
}

// ── Playwright ad scraper ─────────────────────────────────────────────────────

/**
 * scrapeAdsForQuery(page, query, lead, verbose)
 * Navigates to Google Search for `query` and looks for sponsored results
 * that match the lead.
 *
 * @returns {{ matched: boolean, evidence: string[], allAdDomains: string[] }}
 */
async function scrapeAdsForQuery(page, query, lead, verbose) {
  const leadDomain = normaliseDomain(lead.website_url || '');
  const evidence   = [];
  const allAdDomains = [];

  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=us`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Wait briefly for ads to render
    await page.waitForTimeout(1500);

    // ── Strategy 1: look for elements with aria-label containing "Ad" ────────
    // Google wraps each ad result in a div with data-text-ad="1" or similar
    const adBlocks = await page.$$('[data-text-ad], [data-hveid][data-ved]');

    for (const block of adBlocks) {
      // Check if this block contains a "Sponsored" label
      const blockText = await block.innerText().catch(() => '');
      if (!/sponsored/i.test(blockText) && !/^ad$/im.test(blockText)) continue;

      // Extract display URL (the green/grey URL shown under the headline)
      const displayUrlEl = await block.$('[data-dtld], cite, .UdQCqe, .qzEoUe').catch(() => null);
      const displayUrl   = displayUrlEl
        ? await displayUrlEl.innerText().catch(() => '')
        : '';

      const adDomain = normaliseDomain(displayUrl);
      if (adDomain) allAdDomains.push(adDomain);

      // Extract headline text
      const headlineEl = await block.$('h3, [role="heading"]').catch(() => null);
      const headline   = headlineEl
        ? await headlineEl.innerText().catch(() => '')
        : '';

      // Check for domain match
      const domainMatch = leadDomain && adDomain && (
        adDomain === leadDomain ||
        adDomain.includes(leadDomain) ||
        leadDomain.includes(adDomain)
      );

      // Check for name match in headline or display URL
      const nameMatch = nameMatchesAd(lead.business_name, `${headline} ${displayUrl}`);

      if (domainMatch || nameMatch) {
        const ev = [
          headline ? `headline: "${headline.slice(0, 80)}"` : '',
          adDomain  ? `domain: ${adDomain}` : '',
          domainMatch ? '(domain match)' : '',
          nameMatch   ? '(name match)'   : '',
        ].filter(Boolean).join(' ');
        evidence.push(ev);
        if (verbose) console.log(`      [ads] MATCH on "${query}": ${ev}`);
      }
    }

    // ── Strategy 2: look for visible "Sponsored" text nodes ──────────────────
    // Fallback for Google layout variants where data-text-ad is absent
    if (evidence.length === 0) {
      const sponsoredEls = await page.$$('text=Sponsored').catch(() => []);
      for (const el of sponsoredEls) {
        // Walk up to find the containing result block
        const container = await el.evaluateHandle(node => {
          let p = node.parentElement;
          for (let i = 0; i < 6; i++) {
            if (!p) break;
            if (p.tagName === 'DIV' && p.children.length > 2) return p;
            p = p.parentElement;
          }
          return node.parentElement;
        }).catch(() => null);

        if (!container) continue;

        const containerText = await container.evaluate(el => el.innerText || '').catch(() => '');
        const adDomain = (() => {
          // Try to find a URL-like string in the container text
          const m = containerText.match(/https?:\/\/([^\s/]+)/);
          return m ? normaliseDomain(m[1]) : '';
        })();

        if (adDomain) allAdDomains.push(adDomain);

        const domainMatch = leadDomain && adDomain && (
          adDomain === leadDomain || adDomain.includes(leadDomain) || leadDomain.includes(adDomain)
        );
        const nameMatch = nameMatchesAd(lead.business_name, containerText);

        if (domainMatch || nameMatch) {
          const ev = [
            adDomain  ? `domain: ${adDomain}` : '',
            domainMatch ? '(domain match)' : '',
            nameMatch   ? '(name match)'   : '',
          ].filter(Boolean).join(' ');
          evidence.push(ev);
          if (verbose) console.log(`      [ads] MATCH (strategy 2) on "${query}": ${ev}`);
        }
      }
    }

  } catch (err) {
    if (verbose) console.log(`      [ads] Error on query "${query}": ${err.message.slice(0, 80)}`);
    // Non-fatal — return empty evidence
  }

  return {
    matched:      evidence.length > 0,
    evidence,
    allAdDomains: [...new Set(allAdDomains)],
  };
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * detectGoogleAds(lead, opts)
 *
 * @param {object} lead — must have: business_name, website_url, city, state
 * @param {object} opts
 *   @param {string}  opts.city          — city label for query building (e.g. "Lynchburg, VA")
 *   @param {string}  [opts.mode]        — "basic" (default) or "expanded"
 *   @param {number}  [opts.maxChecks]   — max queries to run (default: 2 for basic, 4 for expanded)
 *   @param {boolean} [opts.verbose]     — log progress
 *
 * @returns {Promise<{
 *   google_ads_detected:   "yes"|"no"|"unknown",
 *   ad_queries_checked:    string,
 *   ad_queries_matched:    string,
 *   ad_evidence:           string,
 *   ad_destination_domain: string,
 *   ad_detection_error:    string,
 * }>}
 */
async function detectGoogleAds(lead, opts = {}) {
  const {
    city       = `${lead.city || ''}, ${lead.state || ''}`.trim().replace(/^,\s*/, ''),
    mode       = 'basic',
    maxChecks  = mode === 'expanded' ? 4 : 2,
    verbose    = false,
  } = opts;

  const EMPTY = {
    google_ads_detected:   'no',
    ad_queries_checked:    '',
    ad_queries_matched:    '',
    ad_evidence:           '',
    ad_destination_domain: '',
    ad_detection_error:    '',
  };

  const queries = buildAdQueries(city, mode).slice(0, maxChecks);

  let browser = null;
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale:    'en-US',
      viewport:  { width: 1280, height: 800 },
    });

    // Block images and fonts to speed up page loads
    await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,eot}', route => route.abort());

    const page = await context.newPage();

    const queriesChecked = [];
    const queriesMatched = [];
    const allEvidence    = [];
    let   firstAdDomain  = '';

    for (const query of queries) {
      if (verbose) process.stdout.write(`      [ads] Checking: "${query}"... `);
      queriesChecked.push(query);

      const result = await scrapeAdsForQuery(page, query, lead, verbose);

      if (result.matched) {
        queriesMatched.push(query);
        allEvidence.push(...result.evidence);
        if (!firstAdDomain && result.allAdDomains.length > 0) {
          firstAdDomain = result.allAdDomains[0];
        }
        if (verbose) console.log('ADS DETECTED');
      } else {
        if (verbose) console.log('no match');
      }

      // Small delay between queries to avoid rate limiting
      if (queries.indexOf(query) < queries.length - 1) {
        await page.waitForTimeout(1200);
      }
    }

    await browser.close();
    browser = null;

    return {
      google_ads_detected:   queriesMatched.length > 0 ? 'yes' : 'no',
      ad_queries_checked:    queriesChecked.join(' | '),
      ad_queries_matched:    queriesMatched.join(' | '),
      ad_evidence:           allEvidence.slice(0, 5).join(' | '),
      ad_destination_domain: firstAdDomain,
      ad_detection_error:    '',
    };

  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    return {
      ...EMPTY,
      google_ads_detected:  'unknown',
      ad_detection_error:   err.message ? err.message.slice(0, 200) : String(err),
    };
  }
}

module.exports = { detectGoogleAds, buildAdQueries, normaliseDomain, nameMatchesAd };
