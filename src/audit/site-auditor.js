'use strict';

/**
 * site-auditor.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Fetches a business homepage and inspects its HTML for conversion signals.
 * Returns a structured audit object that feeds directly into weakness-scoring.js.
 *
 * Philosophy: pragmatic, not perfect. Homepage-only. Fast. Fail-safe.
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

// ── Signal detection helpers ────────────────────────────────────────────────

const PATTERNS = {
  // Booking / appointment
  bookingFlow: [
    /book\s*(an?\s*)?(appointment|now|online|visit)/i,
    /schedule\s*(an?\s*)?(appointment|visit|call|consult)/i,
    /request\s*(an?\s*)?(appointment|consult|quote)/i,
    /make\s*an?\s*appointment/i,
    /online\s*booking/i,
    /calendly\.com/i,
    /zocdoc\.com/i,
    /acuityscheduling\.com/i,
    /setmore\.com/i,
    /booksy\.com/i,
    /patientpop\.com/i,
    /healthgrades\.com\/appointment/i,
    /type="submit"[^>]*book/i,
    /book-appointment/i,
    /booking-form/i,
  ],
  // Primary CTA (broad)
  primaryCTA: [
    /class="[^"]*\b(btn|button|cta)\b[^"]*"/i,
    /<button[^>]*>/i,
    /href="#(book|contact|appointment|schedule|cta)/i,
    /get\s*started/i,
    /contact\s*us/i,
    /call\s*now/i,
    /free\s*(consult|estimate|quote)/i,
  ],
  // Phone number
  phoneNumber: [
    /\(\d{3}\)\s*\d{3}[-.\s]\d{4}/,
    /\d{3}[-.\s]\d{3}[-.\s]\d{4}/,
    /tel:\d{10}/,
    /tel:\(\d{3}\)/,
  ],
  // Chat widget
  chatWidget: [
    /intercom/i,
    /drift\.com/i,
    /tawk\.to/i,
    /tidio/i,
    /crisp\.chat/i,
    /livechat/i,
    /olark/i,
    /freshchat/i,
    /hubspot.*chat/i,
    /chat-widget/i,
    /live-chat/i,
    /chat-bubble/i,
    /chatbot/i,
  ],
  // Reviews / testimonials
  reviews: [
    /testimonial/i,
    /review/i,
    /\d+\s*star/i,
    /rated\s*[\d.]+/i,
    /google\s*review/i,
    /yelp/i,
    /healthgrades/i,
    /zocdoc/i,
    /\d+\s*patient/i,
    /what\s*(our\s*)?(patients|clients|customers)\s*say/i,
  ],
  // Insurance / payment
  insuranceInfo: [
    /insurance/i,
    /in-network/i,
    /ppo/i,
    /hmo/i,
    /delta\s*dental/i,
    /cigna/i,
    /aetna/i,
    /metlife/i,
    /we\s*accept/i,
    /payment\s*plan/i,
    /financing/i,
    /carecredit/i,
  ],
  // Service area / local proof
  serviceAreaProof: [
    /serving\s+\w+/i,
    /\w+,\s*(tx|ca|fl|ny|il|pa|oh|ga|nc|mi)\b/i,
    /proudly\s*serving/i,
    /local/i,
    /near\s*(you|me)/i,
    /\d{5}/,  // zip code
  ],
  // FAQ
  faqPresence: [
    /\bfaq\b/i,
    /frequently\s*asked/i,
    /common\s*question/i,
    /accordion/i,
  ],
  // Sticky / mobile CTA
  stickyMobileCTA: [
    /position:\s*fixed/i,
    /position:\s*sticky/i,
    /sticky/i,
    /fixed-bottom/i,
    /mobile-cta/i,
    /call-bar/i,
  ],
  // Trust badges
  trustBadges: [
    /bbb/i,
    /accredited/i,
    /certified/i,
    /award/i,
    /years?\s*(of\s*)?(experience|serving)/i,
    /licensed/i,
    /insured/i,
    /badge/i,
    /trust/i,
    /member\s*of/i,
    /ada\b/i,
    /aba\b/i,
  ],
  // After-hours capture
  afterHoursCapture: [
    /after.hours/i,
    /24\/7/i,
    /24\s*hour/i,
    /leave\s*(a\s*)?message/i,
    /we.*call.*back/i,
    /missed\s*call/i,
    /voicemail/i,
    /contact\s*form/i,
    /email\s*us/i,
  ],
  // Quote / estimate form
  quoteForm: [
    /get\s*(a\s*)?(free\s*)?(quote|estimate)/i,
    /request\s*(a\s*)?(quote|estimate)/i,
    /free\s*estimate/i,
    /instant\s*quote/i,
  ],
  // Outdated layout signals
  outdatedLayout: [
    /<table[^>]*layout/i,
    /font\s+face=/i,
    /<center>/i,
    /bgcolor=/i,
    /text\/javascript/i,
    /jquery-1\.[0-4]/i,
    /bootstrap-2\./i,
    /width="[0-9]+"/i,
  ],
};

function testPatterns(html, patterns) {
  return patterns.some(p => p.test(html));
}

// ── HTTP fetch helper ────────────────────────────────────────────────────────

function fetchPage(rawUrl, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch (e) {
      return reject(new Error(`Invalid URL: ${rawUrl}`));
    }

    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LandingBuilderAudit/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: timeoutMs,
    };

    const req = lib.request(options, (res) => {
      // Follow one redirect
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsedUrl.protocol}//${parsedUrl.hostname}${res.headers.location}`;
        return fetchPage(redirectUrl, timeoutMs).then(resolve).catch(reject);
      }

      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; if (body.length > 500000) res.destroy(); });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      res.on('error', reject);
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', reject);
    req.end();
  });
}

// ── Normalize URL ────────────────────────────────────────────────────────────

function normalizeUrl(url) {
  if (!url) return null;
  let u = String(url).trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://' + u;
  try { new URL(u); return u; } catch (e) { return null; }
}

// ── Core audit function ──────────────────────────────────────────────────────

/**
 * auditWebsite(websiteUrl, options?)
 * Returns a structured audit object.
 *
 * @param {string} websiteUrl
 * @param {object} [options]
 * @param {number} [options.timeoutMs=10000]
 * @returns {Promise<AuditResult>}
 */
async function auditWebsite(websiteUrl, options = {}) {
  const { timeoutMs = 10000 } = options;
  const url = normalizeUrl(websiteUrl);

  const result = {
    website_url: url || websiteUrl,
    audited_at: new Date().toISOString(),
    fetch_status: 'ok',
    fetch_error: null,
    observations: {
      hasPrimaryCTA:        false,
      hasBookingFlow:       false,
      hasPhoneNumber:       false,
      hasChatWidget:        false,
      hasVisibleReviews:    false,
      hasInsuranceInfo:     false,
      hasServiceAreaProof:  false,
      hasStickyMobileCTA:   false,
      hasTrustBadges:       false,
      hasFAQ:               false,
      hasAfterHoursCapture: false,
      hasQuoteForm:         false,
      hasOutdatedLayout:    false,
    },
    rawFindings: [],
    pageMetrics: {
      htmlLength: 0,
      hasViewportMeta: false,
      hasStructuredData: false,
      hasOpenGraph: false,
    },
  };

  if (!url) {
    result.fetch_status = 'error';
    result.fetch_error = 'Invalid or missing URL';
    result.rawFindings.push('Could not audit: invalid URL');
    return result;
  }

  let html = '';
  try {
    const { statusCode, body } = await fetchPage(url, timeoutMs);
    html = body || '';
    result.pageMetrics.htmlLength = html.length;
    if (statusCode >= 400) {
      result.fetch_status = 'http_error';
      result.fetch_error = `HTTP ${statusCode}`;
    }
  } catch (err) {
    result.fetch_status = 'error';
    result.fetch_error = err.message || String(err);
    result.rawFindings.push(`Could not fetch homepage: ${result.fetch_error}`);
    return result;
  }

  // ── Run signal detection ─────────────────────────────────────────────────

  const obs = result.observations;

  obs.hasPrimaryCTA        = testPatterns(html, PATTERNS.primaryCTA);
  obs.hasBookingFlow       = testPatterns(html, PATTERNS.bookingFlow);
  obs.hasPhoneNumber       = testPatterns(html, PATTERNS.phoneNumber);
  obs.hasChatWidget        = testPatterns(html, PATTERNS.chatWidget);
  obs.hasVisibleReviews    = testPatterns(html, PATTERNS.reviews);
  obs.hasInsuranceInfo     = testPatterns(html, PATTERNS.insuranceInfo);
  obs.hasServiceAreaProof  = testPatterns(html, PATTERNS.serviceAreaProof);
  obs.hasStickyMobileCTA   = testPatterns(html, PATTERNS.stickyMobileCTA);
  obs.hasTrustBadges       = testPatterns(html, PATTERNS.trustBadges);
  obs.hasFAQ               = testPatterns(html, PATTERNS.faqPresence);
  obs.hasAfterHoursCapture = testPatterns(html, PATTERNS.afterHoursCapture);
  obs.hasQuoteForm         = testPatterns(html, PATTERNS.quoteForm);
  obs.hasOutdatedLayout    = testPatterns(html, PATTERNS.outdatedLayout);

  // ── Page metrics ─────────────────────────────────────────────────────────

  result.pageMetrics.hasViewportMeta    = /<meta[^>]*name=["']viewport["']/i.test(html);
  result.pageMetrics.hasStructuredData  = /application\/ld\+json/i.test(html);
  result.pageMetrics.hasOpenGraph       = /property=["']og:/i.test(html);

  // Extract Open Graph image URL if present
  try {
    const ogRegex = /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i;
    const ogMatch = html.match(ogRegex);
    if (ogMatch && ogMatch[1]) {
      result.pageMetrics.ogImageUrl = ogMatch[1].trim();
    } else {
      // Fallback: check twitter:image meta
      const twRegex = /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i;
      const twMatch = html.match(twRegex);
      if (twMatch && twMatch[1]) {
        result.pageMetrics.ogImageUrl = twMatch[1].trim();
      } else {
        result.pageMetrics.ogImageUrl = null;
      }
    }
  } catch (e) {
    result.pageMetrics.ogImageUrl = null;
  }

  // ── Generate raw findings ────────────────────────────────────────────────

  const findings = [];

  if (!obs.hasBookingFlow)
    findings.push('No clear booking or appointment CTA detected');
  if (!obs.hasPrimaryCTA)
    findings.push('No prominent primary CTA button found above the fold');
  if (!obs.hasPhoneNumber)
    findings.push('No visible phone number detected on homepage');
  if (!obs.hasChatWidget)
    findings.push('No chat widget or live chat detected');
  if (!obs.hasVisibleReviews)
    findings.push('No reviews or testimonials visible on homepage');
  if (!obs.hasInsuranceInfo)
    findings.push('No insurance, payment, or financing information found');
  if (!obs.hasServiceAreaProof)
    findings.push('No local service area proof detected');
  if (!obs.hasStickyMobileCTA)
    findings.push('No sticky mobile CTA bar detected');
  if (!obs.hasTrustBadges)
    findings.push('No trust badges or credentials visible');
  if (!obs.hasFAQ)
    findings.push('No FAQ section detected');
  if (!obs.hasAfterHoursCapture)
    findings.push('No after-hours lead capture mechanism found');
  if (obs.hasOutdatedLayout)
    findings.push('Page uses outdated HTML/CSS layout patterns');
  if (!result.pageMetrics.hasViewportMeta)
    findings.push('No viewport meta tag — page may not be mobile-optimized');
  if (!result.pageMetrics.hasStructuredData)
    findings.push('No structured data (JSON-LD) found — local SEO may be weak');

  // Positive findings
  if (obs.hasBookingFlow)
    findings.push('Booking flow detected — but may not be prominent enough');
  if (obs.hasPhoneNumber)
    findings.push('Phone number is present on the page');
  if (obs.hasVisibleReviews)
    findings.push('Reviews or testimonials are present — placement may be improvable');

  result.rawFindings = findings;

  return result;
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = { auditWebsite, normalizeUrl };
