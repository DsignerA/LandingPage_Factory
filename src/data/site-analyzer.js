'use strict';
/**
 * site-analyzer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Step 1 — Analyze Existing Website
 * Step 2 — Detect Weaknesses
 *
 * Visits the business's current website (if available) using a headless browser
 * and extracts:
 *   site_identity  — hero headline, services, brand colors, contact info, layout
 *   site_opportunities — detected weaknesses / missing elements
 *
 * Falls back to deterministic heuristics when no URL is available or the page
 * fails to load.
 */

const { chromium } = require('playwright');

function toStringSafe(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

function collapseSpaces(s) {
  return toStringSafe(s).replace(/\s+/g, ' ').trim();
}

// ─── Default opportunities per niche when we cannot scrape ───────────────────
const DEFAULT_OPPORTUNITIES = {
  healthcare_local: [
    'No online appointment booking',
    'Reviews not highlighted on the homepage',
    'Weak or missing hero headline',
    'No patient FAQ section',
    'No mobile-first layout',
    'No trust signals (ratings, certifications)',
    'No virtual assistant or chat option',
    'Confusing navigation'
  ],
  home_service: [
    'No instant quote or estimate form',
    'Reviews not prominently displayed',
    'No clear service area listed',
    'No trust badges or certifications',
    'No emergency / same-day contact option',
    'No before/after project gallery',
    'Slow or non-mobile-friendly layout'
  ],
  professional_service: [
    'No free consultation CTA',
    'No case studies or success stories',
    'No trust signals or credentials',
    'Weak or generic hero headline',
    'No FAQ section',
    'No clear pricing or service tiers',
    'No live chat or callback option'
  ],
  b2b_saas: [
    'No product demo or trial CTA',
    'No social proof or customer logos',
    'No pricing page',
    'Weak value proposition in hero',
    'No FAQ or objection-handling section',
    'No integration or feature comparison',
    'No live chat support'
  ],
  general: [
    'Weak or missing hero headline',
    'No clear call-to-action',
    'No customer reviews or testimonials',
    'No contact information in the header',
    'No mobile-friendly layout',
    'No trust signals'
  ]
};

function nicheCategory(niche) {
  const n = toStringSafe(niche).toLowerCase();
  if (/dental|dentist|orthodont|dmd|dds|chiro|clinic|medical|medspa|spa|therapy|therapist|veterinary|vet/.test(n)) return 'healthcare_local';
  if (/hvac|plumb|roof|electric|pest|landscap|contractor|remodel|garage|floor|clean/.test(n)) return 'home_service';
  if (/law|attorney|legal|account|cpa|consult|coach|agency|insurance|realtor|real\s*estate/.test(n)) return 'professional_service';
  if (/saas|software|b2b|it|cyber|cloud|devops|data|ai|ml|analytics/.test(n)) return 'b2b_saas';
  return 'general';
}

/**
 * Scrape the website and extract site_identity + site_opportunities.
 * Returns { site_identity, site_opportunities } or null on failure.
 */
async function scrapeWebsite(url, options = {}) {
  const timeout = options.timeout || 15000;
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (compatible; LandingBuilderBot/1.0)'
    });

    let loadOk = false;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      loadOk = true;
    } catch (e) {
      // page failed to load
    }

    if (!loadOk) return null;

    // ── Extract site identity ──────────────────────────────────────────────
    const identity = await page.evaluate(() => {
      function getText(sel) {
        const el = document.querySelector(sel);
        return el ? (el.innerText || el.textContent || '').trim().slice(0, 300) : '';
      }
      function getAttr(sel, attr) {
        const el = document.querySelector(sel);
        return el ? (el.getAttribute(attr) || '').trim() : '';
      }
      function getAll(sel, prop) {
        return Array.from(document.querySelectorAll(sel))
          .map(el => (el[prop] || el.textContent || '').trim())
          .filter(Boolean)
          .slice(0, 10);
      }

      // Hero headline — try h1 first, then og:title
      const h1 = getText('h1') || getText('header h2') || getText('.hero h2') || getText('[class*="hero"] h2');
      const ogTitle = getAttr('meta[property="og:title"]', 'content');
      const heroHeadline = h1 || ogTitle || document.title || '';

      // Services — look for nav items, service section headings, or list items
      const navItems = getAll('nav a', 'innerText');
      const serviceHeadings = getAll('[class*="service"] h2, [class*="service"] h3, [id*="service"] h2, [id*="service"] h3', 'innerText');
      const services = [...new Set([...serviceHeadings, ...navItems])].slice(0, 8);

      // Brand colors — extract from CSS variables or computed styles
      const bodyStyle = window.getComputedStyle(document.body);
      const primaryColor = bodyStyle.getPropertyValue('--primary') ||
                           bodyStyle.getPropertyValue('--color-primary') ||
                           bodyStyle.getPropertyValue('--brand-color') || '';

      // Contact info
      const phoneMatch = document.body.innerText.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/);
      const phone = phoneMatch ? phoneMatch[0] : '';
      const emailMatch = document.body.innerText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      const email = emailMatch ? emailMatch[0] : '';

      // Testimonials / reviews
      const testimonials = getAll('[class*="testimonial"] p, [class*="review"] p, blockquote p', 'innerText').slice(0, 3);

      // OG image
      const ogImage = getAttr('meta[property="og:image"]', 'content');

      // Layout signals
      const hasNav = !!document.querySelector('nav');
      const hasStickyHeader = (() => {
        const header = document.querySelector('header');
        if (!header) return false;
        const s = window.getComputedStyle(header);
        return s.position === 'sticky' || s.position === 'fixed';
      })();

      return {
        heroHeadline: heroHeadline.slice(0, 200),
        services,
        primaryColor: primaryColor.trim(),
        phone,
        email,
        testimonials,
        ogImage,
        hasNav,
        hasStickyHeader,
        pageTitle: document.title.slice(0, 150)
      };
    });

    // ── Detect weaknesses ──────────────────────────────────────────────────
    const weaknesses = await page.evaluate(() => {
      const issues = [];

      // Check for appointment booking
      const bodyText = document.body.innerText.toLowerCase();
      const hasBooking = /book|appointment|schedule|reserve/.test(bodyText) &&
        !!document.querySelector('a[href*="book"], a[href*="appoint"], a[href*="schedule"], button, form');
      if (!hasBooking) issues.push('No online appointment booking');

      // Check for reviews / testimonials
      const hasReviews = /review|testimonial|stars|rating/.test(bodyText) ||
        !!document.querySelector('[class*="review"], [class*="testimonial"], [class*="rating"]');
      if (!hasReviews) issues.push('Reviews not highlighted on the homepage');

      // Check for a strong hero headline
      const h1 = document.querySelector('h1');
      const h1Text = h1 ? (h1.innerText || '').trim() : '';
      if (!h1Text || h1Text.length < 10) issues.push('Weak or missing hero headline');

      // Check for FAQ
      const hasFaq = /faq|frequently asked|questions/.test(bodyText) ||
        !!document.querySelector('[class*="faq"], [id*="faq"]');
      if (!hasFaq) issues.push('No patient FAQ section');

      // Check mobile viewport meta
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      if (!viewportMeta) issues.push('No mobile-friendly layout (missing viewport meta)');

      // Check for chat widget
      const hasChat = /chat|messenger|intercom|drift|crisp|tawk/.test(bodyText) ||
        !!document.querySelector('[id*="chat"], [class*="chat"], [id*="intercom"], [class*="drift"]');
      if (!hasChat) issues.push('No live chat or virtual assistant');

      // Check for trust signals
      const hasTrust = /certified|accredited|award|member|bbb|verified/.test(bodyText) ||
        !!document.querySelector('[class*="trust"], [class*="badge"], [class*="certif"]');
      if (!hasTrust) issues.push('No trust signals or certifications displayed');

      // Check for clear CTA in hero
      const heroCta = document.querySelector('header a, .hero a, [class*="hero"] a, h1 + * a');
      if (!heroCta) issues.push('No clear call-to-action in the hero section');

      // Check for phone in header
      const header = document.querySelector('header');
      const headerText = header ? (header.innerText || '').toLowerCase() : '';
      const hasPhoneInHeader = /\d{3}/.test(headerText);
      if (!hasPhoneInHeader) issues.push('Phone number not visible in the header');

      return issues;
    });

    return {
      site_identity: identity,
      site_opportunities: weaknesses
    };
  } catch (err) {
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

/**
 * Main entry point.
 * Analyzes the business website and returns { site_identity, site_opportunities }.
 * Falls back to deterministic defaults when scraping is not possible.
 */
async function analyzeSite(lead, options = {}) {
  const url = toStringSafe(lead && lead.website_url);
  const niche = toStringSafe(lead && lead.niche);
  const cat = nicheCategory(niche);

  // If we already have weaknesses from the lead data, use them
  const existingWeaknesses = Array.isArray(lead && lead.weaknesses) ? lead.weaknesses : [];
  const existingOpportunities = Array.isArray(lead && lead.opportunities) ? lead.opportunities : [];

  let scraped = null;

  // Only scrape if we have a real URL and scraping is not disabled
  if (url && url.startsWith('http') && !options.skipScrape) {
    try {
      scraped = await scrapeWebsite(url, { timeout: options.timeout || 12000 });
    } catch (e) {
      scraped = null;
    }
  }

  // Build site_identity
  const site_identity = {
    heroHeadline: scraped ? collapseSpaces(scraped.site_identity.heroHeadline) : '',
    services: scraped ? scraped.site_identity.services : [],
    primaryColor: scraped ? scraped.site_identity.primaryColor : '',
    phone: scraped ? scraped.site_identity.phone : toStringSafe(lead && lead.phone),
    email: scraped ? scraped.site_identity.email : '',
    testimonials: scraped ? scraped.site_identity.testimonials : [],
    ogImage: scraped ? scraped.site_identity.ogImage : '',
    hasNav: scraped ? scraped.site_identity.hasNav : true,
    hasStickyHeader: scraped ? scraped.site_identity.hasStickyHeader : false,
    pageTitle: scraped ? scraped.site_identity.pageTitle : '',
    url
  };

  // Build site_opportunities — merge scraped weaknesses with existing data
  let site_opportunities = [];

  if (scraped && scraped.site_opportunities && scraped.site_opportunities.length > 0) {
    site_opportunities = scraped.site_opportunities;
  } else if (existingWeaknesses.length > 0) {
    site_opportunities = existingWeaknesses;
  } else if (existingOpportunities.length > 0) {
    site_opportunities = existingOpportunities;
  } else {
    // Fall back to niche defaults
    site_opportunities = (DEFAULT_OPPORTUNITIES[cat] || DEFAULT_OPPORTUNITIES.general).slice(0, 6);
  }

  // Deduplicate and cap
  site_opportunities = [...new Set(site_opportunities.map(s => collapseSpaces(s)).filter(Boolean))].slice(0, 8);

  return { site_identity, site_opportunities };
}

module.exports = { analyzeSite, scrapeWebsite, nicheCategory };
