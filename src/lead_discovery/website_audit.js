'use strict';
/**
 * website_audit.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Deterministic website quality auditor for dental practice websites.
 * No AI. No browser. Uses Node.js built-in fetch to retrieve the homepage HTML
 * and applies regex/text heuristics to score conversion readiness.
 *
 * ── What it detects ───────────────────────────────────────────────────────────
 *
 *   Presence signals (each contributes to conversion_score):
 *     ssl_present                  — URL starts with https://
 *     mobile_friendly              — viewport meta tag present
 *     click_to_call_present        — tel: link present
 *     appointment_booking_present  — booking/scheduling keywords or links
 *     contact_form_present         — <form> element with contact-like fields
 *     chat_present                 — live chat widget signals
 *     reviews_or_testimonials_present — review/testimonial section keywords
 *     insurance_info_present       — insurance-related keywords
 *     new_patient_info_present     — new patient keywords
 *     clear_primary_cta_present    — prominent CTA button/link
 *     modern_layout_signal         — CSS framework or viewport meta present
 *     page_title_present           — <title> tag with meaningful content
 *     meta_description_present     — <meta name="description"> present
 *
 *   Weakness signals (reduce score or flag weaknesses):
 *     thin_page                    — very little text content
 *     no_booking                   — no booking/scheduling detected
 *     no_cta                       — no clear CTA detected
 *     outdated_layout              — table-based layout, no viewport meta
 *
 * ── Scoring ───────────────────────────────────────────────────────────────────
 *
 *   booking_present:         +4
 *   click_to_call:           +2
 *   clear_cta:               +2
 *   contact_form:            +2
 *   reviews_testimonials:    +2
 *   insurance_info:          +1
 *   new_patient_info:        +1
 *   ssl:                     +1
 *   mobile_friendly:         +1
 *   page_title:              +1
 *   meta_description:        +1
 *   chat:                    +1
 *   thin_page_penalty:       -5
 *   no_booking_penalty:      -3
 *   no_cta_penalty:          -2
 *   outdated_layout_penalty: -3
 *
 *   Classification:
 *     strong  = score ≥ 10
 *     average = score ≥ 5
 *     weak    = score < 5
 *
 * ── Output fields ─────────────────────────────────────────────────────────────
 *
 *   website_exists, ssl_present, mobile_friendly, click_to_call_present,
 *   appointment_booking_present, contact_form_present, chat_present,
 *   reviews_or_testimonials_present, insurance_info_present,
 *   new_patient_info_present, clear_primary_cta_present, modern_layout_signal,
 *   page_title_present, meta_description_present,
 *   website_quality, website_weaknesses, conversion_score, audit_error
 */

// ── Heuristic patterns ────────────────────────────────────────────────────────

const PATTERNS = {
  // Click-to-call: tel: links
  click_to_call: /href=["']tel:/i,

  // Appointment booking: scheduling/booking keywords or common booking widgets
  appointment_booking: [
    /book\s*(an?\s*)?appointment/i,
    /schedule\s*(an?\s*)?appointment/i,
    /request\s*(an?\s*)?appointment/i,
    /online\s*scheduling/i,
    /book\s*online/i,
    /schedule\s*online/i,
    /new\s*patient\s*(form|appointment|special)/i,
    /zocdoc|healthgrades|patientpop|localmed|nexhealth|doctible|solutionreach/i,
    /calendly|acuityscheduling|setmore/i,
  ],

  // Contact form: <form> with email/name/message/phone fields
  contact_form: [
    /<form[^>]*>/i,
    /type=["']email["']/i,
    /name=["'](email|phone|message|name|contact)['"]/i,
  ],

  // Live chat widgets
  chat: [
    /intercom|drift|livechat|tawk\.to|tidio|zendesk\s*chat|freshchat|hubspot.*chat/i,
    /class=["'][^"']*chat[^"']*["']/i,
    /id=["'][^"']*chat[^"']*["']/i,
    /live\s*chat/i,
  ],

  // Reviews / testimonials
  reviews_testimonials: [
    /testimonial/i,
    /what\s*(our\s*)?patients\s*say/i,
    /patient\s*review/i,
    /google\s*review/i,
    /\breviews?\b/i,
    /\brating\b/i,
    /\bstars?\b/i,
  ],

  // Insurance
  insurance: [
    /insurance/i,
    /we\s*accept\s*(most|all|your)/i,
    /in-network/i,
    /delta\s*dental|cigna|aetna|metlife|guardian|humana|united\s*health/i,
  ],

  // New patient
  new_patient: [
    /new\s*patient/i,
    /first\s*visit/i,
    /welcome\s*(to\s*our\s*practice|new\s*patients)/i,
    /new\s*patient\s*(special|offer|discount|form)/i,
  ],

  // Clear primary CTA: prominent action buttons
  clear_cta: [
    /href=["']tel:/i,
    /<a[^>]*>(call|book|schedule|request|contact|get\s*started|make\s*appointment)/i,
    /<button[^>]*>(call|book|schedule|request|contact|get\s*started)/i,
    /class=["'][^"']*\b(btn|button|cta)\b[^"']*["'][^>]*>(call|book|schedule|request)/i,
  ],

  // Modern layout signals
  modern_layout: [
    /<meta[^>]*name=["']viewport["']/i,
    /bootstrap|tailwind|foundation|bulma|materialize/i,
    /react|vue|angular|next\.js|gatsby/i,
  ],

  // Outdated layout signals
  outdated_layout: [
    /<table[^>]*width=/i,
    /<font\s/i,
    /<center>/i,
    /bgcolor=["']/i,
  ],

  // Mobile-friendly: viewport meta
  mobile_friendly: /<meta[^>]*name=["']viewport["']/i,

  // SSL
  ssl: /^https:\/\//i,

  // Page title
  page_title: /<title[^>]*>[^<]{3,}<\/title>/i,

  // Meta description
  meta_description: /<meta[^>]*name=["']description["'][^>]*content=["'][^"']{10,}/i,
};

// ── Helper: test multiple patterns ───────────────────────────────────────────

function testAny(html, patterns) {
  if (!Array.isArray(patterns)) return patterns.test(html);
  return patterns.some(p => p.test(html));
}

// ── Helper: count visible text words ─────────────────────────────────────────

function countTextWords(html) {
  // Strip tags and count words
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.split(' ').filter(w => w.length > 2).length;
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * auditWebsite(websiteUrl, opts)
 *
 * @param {string} websiteUrl — the practice website URL
 * @param {object} opts
 *   @param {boolean} [opts.verbose]  — log progress
 *   @param {number}  [opts.timeout]  — fetch timeout in ms (default: 12000)
 *
 * @returns {Promise<{
 *   website_exists:                  boolean,
 *   ssl_present:                     boolean,
 *   mobile_friendly:                 boolean,
 *   click_to_call_present:           boolean,
 *   appointment_booking_present:     boolean,
 *   contact_form_present:            boolean,
 *   chat_present:                    boolean,
 *   reviews_or_testimonials_present: boolean,
 *   insurance_info_present:          boolean,
 *   new_patient_info_present:        boolean,
 *   clear_primary_cta_present:       boolean,
 *   modern_layout_signal:            boolean,
 *   page_title_present:              boolean,
 *   meta_description_present:        boolean,
 *   website_quality:                 "strong"|"average"|"weak",
 *   website_weaknesses:              string,
 *   conversion_score:                number,
 *   audit_error:                     string,
 * }>}
 */
async function auditWebsite(websiteUrl, opts = {}) {
  const { verbose = false, timeout = 12000 } = opts;

  const EMPTY_AUDIT = {
    website_exists:                  false,
    ssl_present:                     false,
    mobile_friendly:                 false,
    click_to_call_present:           false,
    appointment_booking_present:     false,
    contact_form_present:            false,
    chat_present:                    false,
    reviews_or_testimonials_present: false,
    insurance_info_present:          false,
    new_patient_info_present:        false,
    clear_primary_cta_present:       false,
    modern_layout_signal:            false,
    page_title_present:              false,
    meta_description_present:        false,
    website_quality:                 'weak',
    website_weaknesses:              '',
    conversion_score:                0,
    audit_error:                     '',
  };

  if (!websiteUrl || !websiteUrl.trim()) {
    return { ...EMPTY_AUDIT, audit_error: 'no_url' };
  }

  // Normalise URL
  let url = websiteUrl.trim();
  if (!url.startsWith('http')) url = `https://${url}`;

  if (verbose) process.stdout.write(`      [audit] Fetching ${url.slice(0, 60)}... `);

  let html = '';
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(url, {
      signal:  controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LandingBuilderBot/1.0; +https://github.com/landing-builder)',
        'Accept':     'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      if (verbose) console.log(`HTTP ${res.status}`);
      return {
        ...EMPTY_AUDIT,
        website_exists: res.status < 500, // 4xx = exists but error; 5xx = server down
        audit_error:    `http_${res.status}`,
      };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      if (verbose) console.log(`non-HTML (${contentType.split(';')[0]})`);
      return {
        ...EMPTY_AUDIT,
        website_exists: true,
        ssl_present:    url.startsWith('https://'),
        audit_error:    `non_html_content_type`,
      };
    }

    html = await res.text();
    if (verbose) console.log(`OK (${Math.round(html.length / 1024)}KB)`);

  } catch (err) {
    const errMsg = err.name === 'AbortError' ? 'timeout' : err.message.slice(0, 100);
    if (verbose) console.log(`FAIL: ${errMsg}`);
    return { ...EMPTY_AUDIT, audit_error: errMsg };
  }

  // ── Run all heuristic checks ────────────────────────────────────────────────

  const ssl                    = PATTERNS.ssl.test(url);
  const mobileFriendly         = PATTERNS.mobile_friendly.test(html);
  const clickToCall            = PATTERNS.click_to_call.test(html);
  const appointmentBooking     = testAny(html, PATTERNS.appointment_booking);
  const contactForm            = testAny(html, PATTERNS.contact_form);
  const chat                   = testAny(html, PATTERNS.chat);
  const reviewsTestimonials    = testAny(html, PATTERNS.reviews_testimonials);
  const insuranceInfo          = testAny(html, PATTERNS.insurance);
  const newPatientInfo         = testAny(html, PATTERNS.new_patient);
  const clearCta               = testAny(html, PATTERNS.clear_cta);
  const modernLayout           = testAny(html, PATTERNS.modern_layout);
  const pageTitle              = PATTERNS.page_title.test(html);
  const metaDescription        = PATTERNS.meta_description.test(html);
  const outdatedLayout         = testAny(html, PATTERNS.outdated_layout);
  const wordCount              = countTextWords(html);
  const thinPage               = wordCount < 80;

  // ── Compute conversion score ────────────────────────────────────────────────

  let score = 0;
  if (appointmentBooking)   score += 4;
  if (clickToCall)          score += 2;
  if (clearCta)             score += 2;
  if (contactForm)          score += 2;
  if (reviewsTestimonials)  score += 2;
  if (insuranceInfo)        score += 1;
  if (newPatientInfo)       score += 1;
  if (ssl)                  score += 1;
  if (mobileFriendly)       score += 1;
  if (pageTitle)            score += 1;
  if (metaDescription)      score += 1;
  if (chat)                 score += 1;
  if (thinPage)             score -= 5;
  if (!appointmentBooking)  score -= 3;
  if (!clearCta)            score -= 2;
  if (outdatedLayout)       score -= 3;

  // ── Classify quality ────────────────────────────────────────────────────────

  const quality = score >= 10 ? 'strong' : score >= 5 ? 'average' : 'weak';

  // ── Build weaknesses list ───────────────────────────────────────────────────

  const weaknesses = [];
  if (!appointmentBooking)  weaknesses.push('no_booking');
  if (!clearCta)            weaknesses.push('no_clear_cta');
  if (!clickToCall)         weaknesses.push('no_click_to_call');
  if (!contactForm)         weaknesses.push('no_contact_form');
  if (!reviewsTestimonials) weaknesses.push('no_reviews_section');
  if (!insuranceInfo)       weaknesses.push('no_insurance_info');
  if (!newPatientInfo)      weaknesses.push('no_new_patient_info');
  if (!ssl)                 weaknesses.push('no_ssl');
  if (!mobileFriendly)      weaknesses.push('not_mobile_friendly');
  if (!metaDescription)     weaknesses.push('no_meta_description');
  if (thinPage)             weaknesses.push('thin_content');
  if (outdatedLayout)       weaknesses.push('outdated_layout');

  return {
    website_exists:                  true,
    ssl_present:                     ssl,
    mobile_friendly:                 mobileFriendly,
    click_to_call_present:           clickToCall,
    appointment_booking_present:     appointmentBooking,
    contact_form_present:            contactForm,
    chat_present:                    chat,
    reviews_or_testimonials_present: reviewsTestimonials,
    insurance_info_present:          insuranceInfo,
    new_patient_info_present:        newPatientInfo,
    clear_primary_cta_present:       clearCta,
    modern_layout_signal:            modernLayout,
    page_title_present:              pageTitle,
    meta_description_present:        metaDescription,
    website_quality:                 quality,
    website_weaknesses:              weaknesses.join('|'),
    conversion_score:                score,
    audit_error:                     '',
  };
}

module.exports = { auditWebsite };
