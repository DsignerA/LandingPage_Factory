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
    // Use a real desktop Chrome user-agent: hosted site builders (Wix, Squarespace,
    // Cloudflare-fronted sites) frequently serve stripped pages or block obvious bot UAs.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    let loadOk = false;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      loadOk = true;
    } catch (e) {
      // page failed to load
    }

    if (!loadOk) return null;

    // Many builders (Wix, Squarespace, Webflow) hydrate content after DOMContentLoaded.
    // Wait briefly for the network to settle and/or for visible text to appear, so we
    // capture the real hero copy instead of an empty shell. Both waits are best-effort.
    try {
      await page.waitForLoadState('networkidle', { timeout: 6000 });
    } catch (e) { /* ignore */ }
    try {
      await page.waitForFunction(
        () => {
          const h = document.querySelector('h1, h2');
          return !!(h && (h.innerText || h.textContent || '').trim().length > 4);
        },
        { timeout: 4000 }
      );
    } catch (e) { /* ignore */ }

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

      // Hero headline — prefer h1, then h2 in common hero containers, then meta tags.
      // We also pick the longest h2 on the page as a fallback (many Wix/Squarespace
      // sites style the tagline as h2 rather than h1).
      const longestH2 = (() => {
        const hs = Array.from(document.querySelectorAll('h2'));
        let best = '';
        for (const el of hs) {
          const t = (el.innerText || el.textContent || '').trim();
          if (t.length > best.length && t.length < 240) best = t;
        }
        return best;
      })();
      const h1 = getText('h1') ||
                 getText('header h2') ||
                 getText('.hero h2') ||
                 getText('[class*="hero"] h2') ||
                 longestH2;
      const ogTitle = getAttr('meta[property="og:title"]', 'content');
      const metaDesc = getAttr('meta[name="description"]', 'content');
      const ogDesc = getAttr('meta[property="og:description"]', 'content');
      const heroHeadline = h1 || ogTitle || document.title || '';
      const heroTagline  = (ogDesc || metaDesc || '').trim();

      // Services — look for nav items, service section headings, or list items
      const navItems = getAll('nav a', 'innerText');
      const serviceHeadings = getAll('[class*="service"] h2, [class*="service"] h3, [id*="service"] h2, [id*="service"] h3', 'innerText');
      const services = [...new Set([...serviceHeadings, ...navItems])].slice(0, 8);

      // ── Brand colors ────────────────────────────────────────────────────
      // Pick brand colors from things that are clearly *styled* — button
      // backgrounds, CTA backgrounds, header bg, logo SVG fills — and ignore
      // default browser link colors (#0000ee etc.) which would otherwise win.
      const brandColors = (() => {
        function rgbToHsl(r, g, b) {
          r /= 255; g /= 255; b /= 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const l = (max + min) / 2;
          if (max === min) return [0, 0, l];
          const d = max - min;
          const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          let h;
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4;
          }
          return [h * 60, s, l];
        }
        function parseRgb(s) {
          const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s]+([\d.]+))?/.exec(s || '');
          if (!m) return null;
          const a = m[4] != null ? Number(m[4]) : 1;
          if (a < 0.5) return null;
          return [Number(m[1]), Number(m[2]), Number(m[3])];
        }
        function toHex(rgb) {
          return '#' + rgb.map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
        }
        function distance(a, b) {
          return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
        }
        // Browser-default link / visited / button colors to ignore.
        const DEFAULT_COLORS = [
          [0, 0, 238],     // a:link
          [85, 26, 139],   // a:visited
          [221, 221, 221], // button default
        ];
        function isDefault(rgb) {
          return DEFAULT_COLORS.some(d => distance(rgb, d) < 8);
        }

        const buckets = Object.create(null);
        function bump(rgb, weight) {
          if (!rgb || isDefault(rgb)) return;
          const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
          if (l < 0.06 || l > 0.96) return;       // skip near-white/black
          if (s < 0.18) return;                    // skip greys
          const key = Math.round(h / 18) + ':' + Math.round(l * 4);
          if (!buckets[key]) buckets[key] = { rgb, count: 0, s, l };
          buckets[key].count += weight;
        }

        // Background-colors of buttons/CTAs are the strongest brand signal.
        // Text colors on regular links are weak (default blue dominates).
        const selectors = [
          { sel: 'button',                                            w: 4, props: ['background-color'] },
          { sel: '[class*="btn"], [class*="button"], [class*="cta"]', w: 5, props: ['background-color'] },
          { sel: 'a[href][role="button"]',                            w: 4, props: ['background-color'] },
          { sel: 'header',                                            w: 3, props: ['background-color'] },
          { sel: 'nav',                                               w: 2, props: ['background-color'] },
          { sel: '[class*="hero"]',                                   w: 2, props: ['background-color', 'color'] },
          { sel: 'h1, h2',                                            w: 1, props: ['color'] },
          { sel: 'a[href]:not([role="button"])',                      w: 1, props: ['background-color'] }
        ];
        const seen = new WeakSet();
        for (const { sel, w, props } of selectors) {
          const els = Array.from(document.querySelectorAll(sel)).slice(0, 60);
          for (const el of els) {
            if (seen.has(el)) continue;
            seen.add(el);
            const cs = window.getComputedStyle(el);
            for (const p of props) bump(parseRgb(cs.getPropertyValue(p)), w);
          }
        }

        // Sample SVG path fills — logos often live in inline SVGs and reveal the brand color.
        const svgPaths = Array.from(document.querySelectorAll('svg path[fill], svg [fill]')).slice(0, 50);
        for (const el of svgPaths) {
          const fillAttr = el.getAttribute('fill');
          if (!fillAttr || fillAttr === 'none' || fillAttr === 'currentColor') continue;
          if (/^#?[0-9a-f]{3,8}$/i.test(fillAttr)) {
            const cleaned = fillAttr.replace('#', '');
            const r = parseInt(cleaned.length === 3 ? cleaned[0]+cleaned[0] : cleaned.slice(0,2), 16);
            const g = parseInt(cleaned.length === 3 ? cleaned[1]+cleaned[1] : cleaned.slice(2,4), 16);
            const b = parseInt(cleaned.length === 3 ? cleaned[2]+cleaned[2] : cleaned.slice(4,6), 16);
            if (!Number.isNaN(r)) bump([r, g, b], 3);
          }
        }

        const ranked = Object.values(buckets)
          .sort((a, b) => (b.count * (0.5 + b.s)) - (a.count * (0.5 + a.s)))
          .slice(0, 6);
        const primary   = ranked[0] ? toHex(ranked[0].rgb) : '';
        // Secondary must be visually distinct from primary (different hue bucket).
        const secondary = (() => {
          if (!ranked[0]) return '';
          for (let i = 1; i < ranked.length; i++) {
            const a = ranked[0].rgb, b = ranked[i].rgb;
            if (distance(a, b) > 90) return toHex(b);
          }
          return '';
        })();
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        const bgRgb = parseRgb(bodyBg);
        const background = bgRgb ? toHex(bgRgb) : '';
        return { primary, secondary, background };
      })();

      const primaryColor = brandColors.primary || '';

      // ── Brand typography ────────────────────────────────────────────────
      // Read the actual font-family computed on h1/h2 (heading) and body (paragraph).
      const brandFonts = (() => {
        function firstFamily(stack) {
          if (!stack) return '';
          return String(stack).split(',')[0].replace(/['"]/g, '').trim();
        }
        const headingEl = document.querySelector('h1, h2');
        const bodyEl    = document.body;
        const heading = headingEl ? firstFamily(window.getComputedStyle(headingEl).fontFamily) : '';
        const body    = bodyEl    ? firstFamily(window.getComputedStyle(bodyEl).fontFamily)    : '';
        return { heading, body };
      })();

      // Contact info
      const phoneMatch = document.body.innerText.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/);
      const phone = phoneMatch ? phoneMatch[0] : '';
      const emailMatch = document.body.innerText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      const email = emailMatch ? emailMatch[0] : '';

      // Testimonials / reviews
      const testimonials = getAll('[class*="testimonial"] p, [class*="review"] p, blockquote p', 'innerText').slice(0, 3);

      // ── JSON-LD structured data ──────────────────────────────────────────
      // Public schema.org data is the highest-signal, zero-cost source for
      // rating / reviewCount / reviews / hours / address / telephone. Most
      // modern restaurant/local-business sites emit it. Free, legal, no key.
      const jsonLd = (() => {
        function flatten(parsed) {
          const out = [];
          const visit = (node) => {
            if (!node) return;
            if (Array.isArray(node)) { node.forEach(visit); return; }
            if (typeof node !== 'object') return;
            if (Array.isArray(node['@graph'])) node['@graph'].forEach(visit);
            out.push(node);
          };
          visit(parsed);
          return out;
        }
        const RELEVANT = /^(Restaurant|LocalBusiness|FoodEstablishment|Bar|CafeOrCoffeeShop|Bakery|BarOrPub|FastFoodRestaurant|Organization|Store|ProfessionalService|MedicalBusiness|HomeAndConstructionBusiness|LegalService)$/i;
        function typeMatches(t) {
          if (!t) return false;
          if (Array.isArray(t)) return t.some(x => RELEVANT.test(String(x)));
          return RELEVANT.test(String(t));
        }
        function textOf(v) {
          if (v == null) return '';
          if (typeof v === 'string') return v;
          if (typeof v === 'object') return v.name || v['@value'] || '';
          return String(v);
        }
        function num(v) {
          if (v == null) return null;
          const n = Number(typeof v === 'string' ? v.replace(/[^0-9.]/g, '') : v);
          return Number.isFinite(n) ? n : null;
        }

        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        let chosen = null;
        for (const s of scripts) {
          let parsed;
          try { parsed = JSON.parse(s.textContent || s.innerText || ''); }
          catch (e) { continue; }
          for (const e of flatten(parsed)) {
            if (typeMatches(e['@type'])) { chosen = e; break; }
          }
          if (chosen) break;
        }
        if (!chosen) return null;

        const agg = chosen.aggregateRating || {};
        const rawReviews = Array.isArray(chosen.review) ? chosen.review : (chosen.review ? [chosen.review] : []);
        const reviews = rawReviews
          .map(r => {
            if (!r) return null;
            const author = textOf(r.author) || textOf(r.creator);
            const rating = num(r.reviewRating && r.reviewRating.ratingValue);
            const body   = textOf(r.reviewBody || r.description);
            const date   = textOf(r.datePublished || r.dateCreated);
            return (body && body.length >= 20)
              ? { author: author || 'Customer', rating: rating || 5, text: body.slice(0, 360), time: date }
              : null;
          })
          .filter(Boolean)
          .slice(0, 5);

        const address = (chosen.address && typeof chosen.address === 'object') ? {
          street:  textOf(chosen.address.streetAddress),
          city:    textOf(chosen.address.addressLocality),
          state:   textOf(chosen.address.addressRegion),
          postal:  textOf(chosen.address.postalCode),
          country: textOf(chosen.address.addressCountry)
        } : null;

        const hours = [];
        if (Array.isArray(chosen.openingHours)) {
          hours.push(...chosen.openingHours.filter(Boolean).map(String));
        } else if (typeof chosen.openingHours === 'string' && chosen.openingHours) {
          hours.push(chosen.openingHours);
        }
        if (Array.isArray(chosen.openingHoursSpecification)) {
          for (const spec of chosen.openingHoursSpecification) {
            if (!spec) continue;
            const day = Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek.join('/') : textOf(spec.dayOfWeek);
            const opens = textOf(spec.opens);
            const closes = textOf(spec.closes);
            if (day && (opens || closes)) hours.push(`${day}: ${opens || ''}–${closes || ''}`);
          }
        }

        return {
          name:        textOf(chosen.name),
          telephone:   textOf(chosen.telephone),
          priceRange:  textOf(chosen.priceRange),
          rating:      num(agg.ratingValue),
          reviewCount: num(agg.reviewCount || agg.ratingCount),
          reviews,
          address,
          hours:       hours.slice(0, 7)
        };
      })();

      // ── Embedded review / reservation widgets ─────────────────────────
      // Presence flags only — useful signals for downstream rendering
      // (e.g. "they already have TripAdvisor proof — surface a rating badge").
      const widgets = {
        tripadvisor:   !!document.querySelector('iframe[src*="tripadvisor"], [class*="TA_"], [data-widget*="tripadvisor"], a[href*="tripadvisor.com"]'),
        opentable:     !!document.querySelector('iframe[src*="opentable"], [class*="opentable"], #opentable-widget, a[href*="opentable.com"]'),
        yelp:          !!document.querySelector('iframe[src*="yelp"], [class*="yelp"], a[href*="yelp.com"]'),
        googleReviews: !!document.querySelector('iframe[src*="google.com/maps"], [class*="google-reviews"], a[href*="google.com/maps"]')
      };

      // ── About / story copy ──────────────────────────────────────────────
      // Score-based selection so we don't grab the longest accessibility or
      // parking paragraph by accident. Prefers paragraphs that read like brand
      // history, mention the business name, or sit inside about/story
      // containers. Falls back to og:description (which is usually the brand's
      // own positioning blurb).
      const aboutStory = (() => {
        function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
        const brandWords = (document.title || '')
          .toLowerCase()
          .split(/[^a-z0-9]+/i)
          .filter(w => w.length >= 4 && !/^(the|and|with|for|our|home|menu|location|virginia|richmond)$/.test(w));

        function scoreParagraph(text, container) {
          const t = text.toLowerCase();
          let s = Math.min(text.length, 400) / 100;
          // Story signals
          if (/\b(since|founded|established|tradition|generations?|years?|family[- ]?owned|legacy|history|story|originally|opened)\b/.test(t)) s += 6;
          if (/\b(chef|kitchen|menu|cuisine|hand[- ]?crafted|locally|signature)\b/.test(t)) s += 2;
          // Brand-name match
          for (const w of brandWords) if (t.includes(w)) s += 3;
          // Container hint
          if (container && /about|story|history|our[- ]?story|legacy/i.test(container.className || container.id || '')) s += 4;
          // Penalize logistical / non-narrative paragraphs
          if (/\b(wheelchair|accessib(le|ility)|ada|parking|valet|directions|phone|email|reservation|sign[- ]?up|subscribe|newsletter)\b/.test(t)) s -= 6;
          if (/\b(privacy|terms|copyright|©|all rights reserved)\b/.test(t)) s -= 8;
          return s;
        }

        const allPs = Array.from(document.querySelectorAll('p'))
          .map(p => ({ text: clean(p.innerText || p.textContent), container: p.closest('section,div,article,header,main') }))
          .filter(o => o.text.length >= 80 && o.text.length <= 700);

        const scored = allPs.map(o => ({ ...o, s: scoreParagraph(o.text, o.container) }));
        scored.sort((a, b) => b.s - a.s);
        if (scored.length && scored[0].s > 3) return scored[0].text;

        // Fallback: og:description
        const ogDescEl = document.querySelector('meta[property="og:description"]');
        const ogDesc = ogDescEl ? (ogDescEl.getAttribute('content') || '') : '';
        return clean(ogDesc);
      })();

      // ── Logo ────────────────────────────────────────────────────────────
      // Detect the brand logo. Looks for: img tagged with "logo" class/alt/src,
      // image inside a header anchor pointing at "/", small/medium image at the
      // top of the page, or inline SVG with role/aria-label suggesting a logo.
      // Returns absolute URL (when img) or 'svg:<outerHTML>' marker for inline SVG.
      const logoUrl = (() => {
        function normalize(u) {
          if (!u) return '';
          try { return new URL(u, location.href).href; } catch (e) { return u; }
        }
        const businessName = (document.title || '').toLowerCase();
        // Strategy 1: explicit logo classnames or alt text
        const explicit = Array.from(document.querySelectorAll('img'))
          .filter(img => {
            const alt = (img.alt || '').toLowerCase();
            const cls = (img.className && img.className.baseVal !== undefined ? img.className.baseVal : img.className || '').toString().toLowerCase();
            const src = (img.currentSrc || img.src || '').toLowerCase();
            return /logo|brand/.test(alt) || /logo|brand/.test(cls) || /logo|brand-mark/.test(src);
          })
          .filter(img => (img.currentSrc || img.src) && (img.currentSrc || img.src).startsWith('http'));
        if (explicit.length) return normalize(explicit[0].currentSrc || explicit[0].src);

        // Strategy 2: image inside a header link to root
        const headerLinkImg = document.querySelector('header a[href="/"] img, header a[href$="://"] img, nav a[href="/"] img');
        if (headerLinkImg && (headerLinkImg.currentSrc || headerLinkImg.src)) {
          return normalize(headerLinkImg.currentSrc || headerLinkImg.src);
        }

        // Strategy 3: small-ish image near the top of the page (typically the logo)
        const candidates = Array.from(document.querySelectorAll('header img, nav img, [class*="header"] img, [class*="navbar"] img'))
          .map(img => ({
            img,
            src: img.currentSrc || img.src || '',
            w: img.naturalWidth || img.width || 0,
            h: img.naturalHeight || img.height || 0
          }))
          .filter(o => o.src && o.src.startsWith('http'))
          .filter(o => o.w > 30 && o.w < 400 && o.h > 20 && o.h < 200);
        candidates.sort((a, b) => {
          const ar = a.img.getBoundingClientRect();
          const br = b.img.getBoundingClientRect();
          return ar.top - br.top;
        });
        if (candidates.length) return normalize(candidates[0].src);

        return '';
      })();

      // OG image — also fall back to twitter:image and the first large content image.
      const ogImage = getAttr('meta[property="og:image"]', 'content') ||
                      getAttr('meta[name="twitter:image"]', 'content') ||
                      (() => {
                        const imgs = Array.from(document.querySelectorAll('img'))
                          .map(img => ({
                            src: img.currentSrc || img.src || '',
                            w: img.naturalWidth || img.width || 0
                          }))
                          .filter(o => o.src && o.src.startsWith('http') && o.w >= 600);
                        imgs.sort((a, b) => b.w - a.w);
                        return imgs[0] ? imgs[0].src : '';
                      })();

      // ── Image library with semantic classification ────────────────────
      // Harvest up to ~20 candidate images from <img> + CSS background-images,
      // classify each as food / interior / exterior / map / document / generic
      // using filename + alt + parent-class signals, score them, and return.
      // Downstream slot logic (menu cards, hero, gallery) picks by category.
      const imageLibrary = (() => {
        const found = [];
        function pushImg(src, w, h, alt, ctx) {
          if (!src || typeof src !== 'string') return;
          if (!src.startsWith('http')) return;
          if (/sprite|favicon|emoji|placeholder|blank|spacer|track\.|pixel\./i.test(src)) return;
          found.push({ src, w: w || 0, h: h || 0, alt: alt || '', ctx: ctx || '' });
        }

        Array.from(document.querySelectorAll('img')).forEach(img => {
          const src = img.currentSrc || img.src || '';
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if (w >= 300 && h >= 200) {
            const parent = img.closest('[class*="menu"],[class*="dish"],[class*="gallery"],[class*="card"],[class*="hero"],[class*="interior"],[class*="exterior"],[class*="map"],main,article,section');
            const ctx = parent ? (parent.className || '') : '';
            pushImg(src, w, h, img.alt || '', ctx);
          }
        });

        const bgCandidates = Array.from(document.querySelectorAll(
          'div, section, header, [class*="hero"], [class*="banner"], [class*="card"], [class*="gallery"]'
        )).slice(0, 200);
        for (const el of bgCandidates) {
          const cs = window.getComputedStyle(el);
          const bg = cs.getPropertyValue('background-image') || '';
          const m  = bg.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/);
          if (!m) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 300 || rect.height < 200) continue;
          pushImg(m[1], rect.width, rect.height, '', el.className || '');
        }

        // Dedupe by basename, keeping the largest version.
        function basename(u) {
          try { return new URL(u).pathname.split('/').pop().replace(/\.[a-z]+$/i, ''); }
          catch (e) { return u; }
        }
        const byBase = new Map();
        for (const item of found) {
          const k = basename(item.src);
          const existing = byBase.get(k);
          if (!existing || (item.w * item.h) > (existing.w * existing.h)) byBase.set(k, item);
        }

        // Heuristic classifier: filename + alt + parent-class signals.
        // Categories: food, interior, exterior, map, document, logo, generic.
        function classify(item) {
          const blob = `${item.src} ${item.alt} ${item.ctx}`.toLowerCase();
          if (/\b(map|directions|parking|location)\b|google\.com\/maps/.test(blob)) return 'map';
          if (/\blogo|brand[-_]mark|wordmark\b/.test(blob)) return 'logo';
          if (/menu(\.|-|_)?(jpg|png|webp|pdf)|menu[-_]?page|wine[-_]?list\.pdf/.test(blob)) return 'document';
          if (/\b(food|dish|plate|cuisine|steak|seafood|pasta|pizza|sushi|burger|salad|dessert|drink|cocktail|wine|menu[-_]?item|entree|appetizer)\b/.test(blob)) return 'food';
          if (/\b(interior|dining[-_]?room|bar[-_]?area|seating|booth|table)\b/.test(blob)) return 'interior';
          if (/\b(exterior|storefront|facade|outside|patio)\b/.test(blob)) return 'exterior';
          // Aspect-ratio + size heuristic: very wide → likely interior/banner; squareish big → likely food.
          const ar = item.w && item.h ? item.w / item.h : 0;
          if (item.w >= 1000 && ar >= 1.6) return 'interior';
          if (ar > 0.8 && ar < 1.4) return 'food';  // squareish photos on restaurant sites are usually dishes
          return 'generic';
        }

        // Score: size + category bonus.
        function score(item, cat) {
          let s = Math.sqrt(item.w * item.h);
          if (cat === 'food')     s *= 1.6;
          if (cat === 'interior') s *= 1.3;
          if (cat === 'exterior') s *= 1.2;
          if (cat === 'map')      s *= 0.3;       // demote maps
          if (cat === 'document') s *= 0.2;       // demote menu PDFs/screenshots
          if (cat === 'logo')     s *= 0.1;       // demote logos in the library
          return s;
        }

        const classified = Array.from(byBase.values()).map(item => ({
          ...item, category: classify(item)
        }));
        classified.sort((a, b) => score(b, b.category) - score(a, a.category));
        return classified.slice(0, 12).map(o => ({
          src: o.src, w: o.w, h: o.h, alt: o.alt, ctx: o.ctx, category: o.category
        }));
      })();

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
        heroTagline: heroTagline.slice(0, 240),
        services,
        primaryColor: primaryColor.trim(),
        brandColors,
        brandFonts,
        imageLibrary,
        logoUrl,
        aboutStory,
        jsonLd,
        widgets,
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
    console.warn('[site-analyzer] scrape failed for', url + ':', err && err.message);
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
    heroTagline:  scraped ? collapseSpaces(scraped.site_identity.heroTagline || '') : '',
    services: scraped ? scraped.site_identity.services : [],
    primaryColor: scraped ? scraped.site_identity.primaryColor : '',
    brandColors:  scraped ? (scraped.site_identity.brandColors || null) : null,
    brandFonts:   scraped ? (scraped.site_identity.brandFonts  || null) : null,
    imageLibrary: scraped ? (Array.isArray(scraped.site_identity.imageLibrary) ? scraped.site_identity.imageLibrary : []) : [],
    logoUrl:      scraped ? toStringSafe(scraped.site_identity.logoUrl) : '',
    aboutStory:   scraped ? toStringSafe(scraped.site_identity.aboutStory) : '',
    jsonLd:       scraped ? (scraped.site_identity.jsonLd || null) : null,
    widgets:      scraped ? (scraped.site_identity.widgets || null) : null,
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
