// src/data/site-brief-builder.js
// Deterministic Site Brief Builder (no AI).
// Input: normalized lead from core/lead-normalizer.js
// Output: site brief consumed by schema/page generation.
//
// Strategy / presentation boundary:
// - Internal fields (offer_angle, weaknesses, opportunities) are used for
//   structural decisions but are NEVER surfaced verbatim in public-facing copy.
// - All visible copy comes from sanitized presentation fields (headline,
//   subheadline, elevator_pitch, value_props).

'use strict';

const { resolveNichePack } = require('../niches');
const { loadDesignSystem } = require('../design-systems/parser');

/**
 * Deterministic pick from a list. If `indexOverride` is a number we use it
 * directly (round-robin) — used by the multi-variant CLI to force v0/v1/v2
 * to pick different layouts. Otherwise we hash the slug so each client gets
 * a different but reproducible variant.
 */
function pickFromSlug(slug, list, indexOverride) {
  if (!Array.isArray(list) || list.length === 0) return null;
  if (typeof indexOverride === 'number' && Number.isFinite(indexOverride)) {
    return list[((indexOverride % list.length) + list.length) % list.length];
  }
  const s = String(slug || '');
  if (!s) return list[0];
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash) ^ s.charCodeAt(i);
  return list[Math.abs(hash) % list.length];
}

function toStringSafe(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

function collapseSpaces(s) {
  return toStringSafe(s).replace(/\s+/g, ' ').trim();
}

function titleCase(s) {
  const str = collapseSpaces(s).toLowerCase();
  if (!str) return '';
  return str
    .split(/([\s\-\/]+)/)
    .map(part => {
      if (/[\s\-\/]+/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

// ─── Public copy guard ────────────────────────────────────────────────────────
// Prevent internal tokens (snake_case, strategy phrases) from leaking into UI.
function sanitizePublicText(s) {
  let txt = collapseSpaces(String(s || ''));
  if (!txt) return '';
  // Remove snake_case tokens
  txt = txt
    .split(/\s+/)
    .filter(tok => !/[a-z0-9]+_[a-z0-9_]+/i.test(tok))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Block internal strategy / SaaS-tool phrasing from patient/customer-facing copy
  const banned = [
    'lead capture', 'missed patient opportunities', 'help the practice',
    'website chat', 'conversion', 'capture', 'marketing', 'saas',
    'offer_angle', 'after_hours_patient_capture'
  ];
  for (const phrase of banned) {
    const re = new RegExp(phrase.replace(/[-/\\^$*+?.()|[\]{}]/g, r => '\\' + r), 'ig');
    txt = txt.replace(re, '');
  }
  return collapseSpaces(txt);
}

function sanitizeList(arr, limit) {
  const a = Array.isArray(arr) ? arr : [];
  const clean = a.map(x => collapseSpaces(x)).filter(Boolean);
  if (typeof limit === 'number' && limit >= 0) return clean.slice(0, limit);
  return clean;
}

// ─── Niche classification ─────────────────────────────────────────────────────
function nicheCategory(niche) {
  const n = toStringSafe(niche).toLowerCase();
  if (/dental|dentist|orthodont|dmd|dds/.test(n)) return 'healthcare_local';
  if (/chiro|clinic|medical|medspa|spa|therapy|therapist|veterinary|vet/.test(n)) return 'healthcare_local';
  if (/hvac|plumb|roof|electric|pest|landscap|contractor|remodel|garage|floor|clean/.test(n)) return 'home_service';
  if (/law|attorney|legal|account|cpa|consult|coach|agency|insurance|realtor|real\s*estate/.test(n)) return 'professional_service';
  if (/saas|software|b2b|it|cyber|cloud|devops|data|ai|ml|analytics/.test(n)) return 'b2b_saas';
  if (/e-?com|shop|store|retail|boutique/.test(n)) return 'ecommerce';
  if (/restaurant|cafe|coffee|bar|pizza|food|catering|bakery/.test(n)) return 'restaurant';
  return 'general';
}

// ─── Primary goal ─────────────────────────────────────────────────────────────
function choosePrimaryGoal(lead) {
  const angle = toStringSafe(lead.offer_angle).toLowerCase();
  const cat = nicheCategory(lead.niche);
  const opps = (lead.opportunities || []).map(o => toStringSafe(o).toLowerCase());

  if (/(missed|recapture).*(calls|leads|patients|appointments|messages)/.test(angle)) return 'capture_missed_opportunities';
  if (/(book|appointment|schedule)/.test(angle)) return 'book_appointments';
  if (/(quote|estimate|price)/.test(angle)) return 'generate_leads';

  if (cat === 'healthcare_local') return 'book_appointments';
  if (cat === 'home_service') return 'generate_leads';
  if (cat === 'professional_service') return 'schedule_consultation';
  if (cat === 'b2b_saas') return 'request_demo';
  if (cat === 'ecommerce') return 'shop_now';
  if (cat === 'restaurant') return 'make_reservation';

  if (opps.some(x => /booking|calendar|appointment/.test(x))) return 'book_appointments';
  if (opps.some(x => /chat|lead|form|quote|call/.test(x))) return 'generate_leads';

  return 'get_in_touch';
}

// ─── CTAs ─────────────────────────────────────────────────────────────────────
function goalToPrimaryCta(goal) {
  switch (goal) {
    case 'book_appointments':           return { label: 'Book Appointment', href: '#book' };
    case 'capture_missed_opportunities':return { label: 'Start Capturing Missed Leads', href: '#cta' };
    case 'generate_leads':              return { label: 'Get a Free Quote', href: '#contact' };
    case 'schedule_consultation':       return { label: 'Book Free Consultation', href: '#contact' };
    case 'request_demo':                return { label: 'Request a Demo', href: '#contact' };
    case 'shop_now':                    return { label: 'Order Now', href: '#order' };
    case 'make_reservation':            return { label: 'Reserve a Table', href: '#reservations' };
    default:                            return { label: 'Contact Us', href: '#contact' };
  }
}

function defaultSecondaryCta(sectionsHint, cat, phone) {
  if (phone) return { label: 'Call Us', href: `tel:${phone}` };
  if ((sectionsHint || []).includes('pricing')) return { label: 'See Pricing', href: '#pricing' };
  if (cat === 'healthcare_local') return { label: 'Learn More', href: '#services' };
  return { label: 'Learn More', href: '#features' };
}

// ─── Sections hint ────────────────────────────────────────────────────────────
function deriveSectionsHint(lead) {
  const base = ['hero', 'features'];
  const cat = nicheCategory(lead.niche);
  const opps = (lead.opportunities || []).map(s => s.toLowerCase());
  const weaks = (lead.weaknesses || []).map(s => s.toLowerCase());

  if (cat === 'b2b_saas' || cat === 'professional_service') base.push('pricing');
  if (cat === 'healthcare_local') base.push('faq');

  if (opps.some(x => /review|testimonial|rating/.test(x)) || weaks.some(x => /no\s*reviews|few\s*reviews/.test(x))) {
    base.push('testimonials');
  }
  if (opps.some(x => /chat|booking|online\s*booking|calendar/.test(x))) {
    base.push('how-it-works');
    base.push('cta');
  }

  const seen = new Set();
  const ordered = [];
  for (const s of base) {
    if (!seen.has(s)) { seen.add(s); ordered.push(s); }
  }
  return ordered;
}

// ─── Value props ──────────────────────────────────────────────────────────────
function defaultValuePropsByCategory(cat) {
  switch (cat) {
    case 'healthcare_local':    return ['Easy Online Booking', 'Friendly Local Care', 'Insurance-Friendly Options'];
    case 'home_service':        return ['Fast Response Times', 'Upfront Transparent Pricing', 'Licensed & Insured Pros'];
    case 'professional_service':return ['Expert Guidance', 'Tailored Solutions', 'Results You Can Measure'];
    case 'b2b_saas':            return ['Deploy in Minutes', 'Proven ROI', 'Secure & Scalable'];
    case 'ecommerce':           return ['Curated Quality', 'Free & Fast Shipping', 'Hassle-Free Returns'];
    case 'restaurant':          return ['Fresh Ingredients', 'Online Ordering', 'Fast Pickup & Delivery'];
    default:                    return ['Trusted Local Service', 'Clear Pricing', 'Satisfaction Guaranteed'];
  }
}

function titleFromPhrase(p) {
  const t = titleCase(p.replace(/[.;:,]+$/g, ''));
  return t.length > 60 ? t.slice(0, 57) + '...' : t;
}

function featureFromOpportunity(opp, lead) {
  const title = titleFromPhrase(opp);
  const cat = nicheCategory(lead.niche);
  let benefit;
  switch (cat) {
    case 'healthcare_local':    benefit = 'Make it effortless for patients to connect and book.'; break;
    case 'home_service':        benefit = 'Turn website visitors into calls and booked jobs.'; break;
    case 'professional_service':benefit = 'Reduce friction and convert more consultations.'; break;
    case 'b2b_saas':            benefit = 'Shorten time-to-value and demo-to-close.'; break;
    default:                    benefit = 'Improve conversions and reduce drop-off.';
  }
  return { title, description: benefit };
}

function defaultOpportunitiesByNiche(niche) {
  const n = toStringSafe(niche).toLowerCase();
  if (/(dental|dentist|orthodont|clinic|medical|medspa|spa|therapy|therapist|veterinary|vet)/.test(n)) {
    return ['Online booking or request form', 'Insurance information and coverage', 'After-hours contact options'];
  }
  if (/(hvac|plumb|roof|electric|pest|landscap|contractor|remodel|garage|floor|clean)/.test(n)) {
    return ['Click-to-call CTA', 'Service areas and hours', 'Upfront pricing or estimates'];
  }
  if (/(law|attorney|legal|account|cpa|consult|coach|agency|insurance|realtor|real\s*estate)/.test(n)) {
    return ['Clear consultation CTA', 'Proof (reviews/case studies)', 'Service scope and fees'];
  }
  if (/(saas|software|b2b|it|cyber|cloud|devops|data|ai|ml|analytics)/.test(n)) {
    return ['Request a demo CTA', 'Value proposition above the fold', 'Customer proof or case studies'];
  }
  if (/(e-?com|shop|store|retail|boutique)/.test(n)) {
    return ['Trust badges and reviews', 'Clear shipping and returns', 'Featured bestsellers'];
  }
  if (/(restaurant|cafe|coffee|bar|pizza|food|catering|bakery)/.test(n)) {
    return ['Menu or ordering link', 'Hours and location', 'Online ordering or booking'];
  }
  return ['Clear primary call-to-action', 'Trust signals (reviews/badges)', 'Mobile-friendly, fast above-the-fold'];
}

function cleanOpportunityText(s) {
  return collapseSpaces(toStringSafe(s)).replace(/[.;:,]+$/g, '');
}

function deriveOpportunities(lead) {
  const fromLead = sanitizeList(lead.opportunities, 3).map(cleanOpportunityText).filter(Boolean);
  if (fromLead.length) return fromLead.slice(0, 3);
  return defaultOpportunitiesByNiche(lead.niche).slice(0, 3);
}

// ─── Messaging ────────────────────────────────────────────────────────────────
function deriveMessaging(lead, goal) {
  const name = collapseSpaces(lead.business_name) || 'Your Business';
  let location = collapseSpaces(lead.location);
  const niche = collapseSpaces(lead.niche);
  if (!location) {
    const city = collapseSpaces(lead.city);
    const state = collapseSpaces(lead.state);
    location = [city, state].filter(Boolean).join(', ');
  }

  // Patient/customer-facing headline: brand name only, sanitized
  const headline = sanitizePublicText(name);

  // Subheadline: category + location, no internal tags
  const cat = nicheCategory(niche);
  let subheadline;
  if (cat === 'healthcare_local') {
    const base = /(dental|dentist|orthodont|dmd|dds|tooth|teeth)/i.test(niche)
      ? 'Family & Cosmetic Dentistry'
      : 'Compassionate Local Care';
    subheadline = location ? `${base} in ${location}` : base;
  } else {
    subheadline = location
      ? `${titleCase(niche || 'Local Service')} in ${location}`
      : titleCase(niche || 'Local Service');
  }
  subheadline = sanitizePublicText(subheadline);

  const weaknesses = sanitizeList(lead.weaknesses, 5);
  const opportunities = sanitizeList(lead.opportunities, 5);

  // Value props: from opportunities first, then category defaults
  const oppAsProps = opportunities.slice(0, 3).map(o => titleFromPhrase(o));
  const defaults = defaultValuePropsByCategory(cat).filter(p => !oppAsProps.includes(p));
  const value_props = [...oppAsProps, ...defaults].slice(0, 3).map(sanitizePublicText);

  // Elevator pitch: patient/customer-friendly, no internal strategy strings
  const epTail = (cat === 'healthcare_local')
    ? (/(dental|dentist|orthodont|dmd|dds|tooth|teeth)/i.test(niche) ? 'Friendly local dental care.' : 'Compassionate local care.')
    : (cat === 'home_service' ? 'Reliable local service.' : 'Friendly local service.');
  const elevator_pitch = sanitizePublicText(
    `${name}${location ? ' — ' + location : ''}. ${epTail}`
  );

  // problem and solution are intentionally null — internal strategy only
  return { headline, subheadline, elevator_pitch, value_props, problem: null, solution: null };
}

// ─── Design tokens ────────────────────────────────────────────────────────────
// Deterministic from niche + goal. No random values.
function deriveTheme(cat, goal, options) {
  // Palette: deterministic from niche category
  const paletteMap = {
    healthcare_local:    'blue',
    home_service:        'orange',
    professional_service:'slate',
    b2b_saas:            'purple',
    ecommerce:           'teal',
    restaurant:          'orange',
    general:             'blue'
  };
  const palette = options.defaultPalette || paletteMap[cat] || 'blue';

  // Tone: deterministic from niche category
  const toneMap = {
    healthcare_local:    'trustworthy',
    home_service:        'reliable',
    professional_service:'professional',
    b2b_saas:            'innovative',
    ecommerce:           'friendly',
    restaurant:          'warm',
    general:             'trustworthy'
  };
  const tone = options.defaultTone || toneMap[cat] || 'trustworthy';

  // heroStyle: keys MUST match VARIANT_MAP in src/ui/hero.js
  //   split_premium | centered | media_background | service_quote_split | centered_product | product_demo
  const heroStyleMap = {
    healthcare_local:    'split_premium',
    home_service:        'service_quote_split',
    professional_service:'centered',
    b2b_saas:            'product_demo',
    ecommerce:           'media_background',
    restaurant:          'media_background',
    general:             'split_premium'
  };
  // The niche pack can supply a `heroVariants` array — different leads in the
  // same niche pick deterministically by slug so they don't all look identical.
  const heroStyle = options.heroStyle ||
                    pickFromSlug(options.slug, options.heroVariantPool, options.variantIndex) ||
                    heroStyleMap[cat] ||
                    'split_premium';

  // motionProfile: calm for healthcare, expressive for restaurant/ecommerce
  const motionMap = {
    healthcare_local:    'calm_interactive',
    home_service:        'calm_interactive',
    professional_service:'static',
    b2b_saas:            'calm_interactive',
    ecommerce:           'expressive',
    restaurant:          'expressive',
    general:             'calm_interactive'
  };
  const motionProfile = options.motionProfile || motionMap[cat] || 'calm_interactive';

  // backgroundEffect: soft gradient for most, none for professional
  const bgMap = {
    professional_service:'none',
    b2b_saas:            'mesh_gradient',
    general:             'soft_gradient'
  };
  const backgroundEffect = options.backgroundEffect ||
                           pickFromSlug(options.slug, options.backgroundEffectPool, options.variantIndex) ||
                           bgMap[cat] ||
                           'soft_gradient';

  return { palette, tone, heroStyle, motionProfile, backgroundEffect };
}

// ─── Main builder ─────────────────────────────────────────────────────────────
function buildSiteBrief(normalizedLead, options = {}) {
  const lead = Object(normalizedLead || {});

  const primary_goal = choosePrimaryGoal(lead);
  const sectionsHint = deriveSectionsHint(lead);
  const messaging = deriveMessaging(lead, primary_goal);
  const featuresFromOpps = sanitizeList(lead.opportunities, 6).map(o => featureFromOpportunity(o, lead));
  const briefOpps = deriveOpportunities(lead);
  const cat = nicheCategory(lead.niche);

  function sanitizePhone(p) {
    const raw = toStringSafe(p);
    const digits = raw.replace(/[^0-9+]/g, '');
    const count = digits.replace(/\D/g, '').length;
    return count >= 7 ? digits : '';
  }
  // Sources for real data, in priority order:
  //   1. brief.siteIdentity.jsonLd (schema.org structured data — free, scraped)
  //   2. options.placesData (Google Places — free under quota, requires API key)
  //   3. body-regex / lead-provided / empty
  const jsonLd = options && options.siteIdentity && options.siteIdentity.jsonLd;
  const placesData = options && options.placesData;

  const scrapedPhone  = sanitizePhone(options && options.siteIdentity && options.siteIdentity.phone);
  const jsonLdPhone   = sanitizePhone(jsonLd && jsonLd.telephone);
  const placesPhone   = sanitizePhone(placesData && placesData.phone);
  const sanitizedPhone = sanitizePhone(lead.phone) || jsonLdPhone || placesPhone || scrapedPhone;

  let locationOut = collapseSpaces(lead.location) || '';
  if (!locationOut) {
    const city = collapseSpaces(lead.city);
    const state = collapseSpaces(lead.state);
    locationOut = [city, state].filter(Boolean).join(', ');
  }

  // CTAs: healthcare_local gets patient-facing CTAs; others get goal-driven CTAs
  const primaryCtaResolved = (cat === 'healthcare_local')
    ? { label: 'Book Appointment', href: '#book' }
    : goalToPrimaryCta(primary_goal);

  const secondaryCtaResolved = (cat === 'healthcare_local')
    ? (sanitizedPhone ? { label: 'Call Office', href: `tel:${sanitizedPhone}` } : { label: 'Contact Us', href: '#contact' })
    : defaultSecondaryCta(sectionsHint, cat, sanitizedPhone);

  // Resolve the niche pack first — its config carries the variation pools
  // (heroVariants, accentStyles, sectionOrderVariants etc.) that the design
  // resolver needs to pick deterministically per slug.
  const nichePack = resolveNichePack(lead.niche);
  const packConfig = (nichePack && nichePack.config) || {};
  const slugForPick = collapseSpaces(lead.slug || lead.business_name || lead.practice_name || '');

  // Filter the hero-variant pool by what assets we actually have. A client with
  // a strong scraped hero image should bias toward image-led hero variants; a
  // client with no usable photo should bias toward text-led ones. This makes
  // variation content-aware so we don't bury a great photo behind a form card.
  const IMAGE_VARIANTS = new Set(['media_background']);
  const TEXT_VARIANTS  = new Set(['centered', 'split_premium', 'centered_product', 'product_demo']);
  const scrapedHeroImg = options && options.siteIdentity && options.siteIdentity.ogImage;
  const filterHeroPool = (pool) => {
    if (!Array.isArray(pool) || pool.length === 0) return pool;
    if (scrapedHeroImg) {
      // Weight image-using variants higher so a great scraped photo actually
      // gets used. Duplicating in the pool gives image variants ~2x odds while
      // still allowing a text variant to be picked for some slugs (variation).
      const imageVariants = pool.filter(v => IMAGE_VARIANTS.has(v));
      const otherImageFriendly = pool.filter(v => v === 'split_premium');
      const weighted = [...imageVariants, ...imageVariants, ...otherImageFriendly];
      return weighted.length ? weighted : pool;
    }
    const textFriendly = pool.filter(v => TEXT_VARIANTS.has(v));
    return textFriendly.length ? textFriendly : pool;
  };

  // Derive design tokens deterministically from niche + goal + slug
  // (variantIndex override forces a specific position in each pool — used by
  // the multi-variant CLI so v0/v1/v2 pick visually different layouts.)
  const variantIndex = (options && typeof options.variantIndex === 'number') ? options.variantIndex : undefined;
  const themeOptions = Object.assign({}, options, {
    slug: slugForPick,
    variantIndex,
    heroVariantPool:    filterHeroPool(packConfig.heroVariants),
    accentStylePool:    packConfig.accentStyles,
    backgroundEffectPool: packConfig.backgroundEffects
  });
  const theme = deriveTheme(cat, primary_goal, themeOptions);
  theme.sectionOrder = pickFromSlug(slugForPick, packConfig.sectionOrderVariants, variantIndex) || null;
  theme.accentStyle  = pickFromSlug(slugForPick, packConfig.accentStyles, variantIndex) || 'none';
  theme.cardStyle    = pickFromSlug(slugForPick, packConfig.cardStyles, variantIndex)   || 'soft_elevated';

  // Pick an opt-in design system aesthetic from the niche pack's pool. Used by
  // the renderer as a palette fallback when no scraped brand colors exist, and
  // by the LLM-rewrite path so generated copy matches the visual voice.
  const designSystemName = options.designSystemPreset ||
                           pickFromSlug(slugForPick, packConfig.designSystemPool, variantIndex);
  const designSystem = designSystemName ? loadDesignSystem(designSystemName) : null;

  const brief = {
    lead_id: lead.lead_id || null,
    slug: lead.slug || null,
    // Brand name prefers practice_name over business_name. Falls back to generic.
    // logoUrl is the scraped brand mark (image URL) when site-analyzer found one.
    brand: {
      name: collapseSpaces(lead.practice_name) || collapseSpaces(lead.business_name) || 'Your Business',
      heroImageUrl: null,
      logoUrl: (options && options.siteIdentity && options.siteIdentity.logoUrl) || null
    },
    niche: collapseSpaces(lead.niche) || 'general',
    location: locationOut,
    website_url: toStringSafe(lead.website_url) || null,

    // Internal strategy field — used for structural decisions, NOT for visible copy
    offer_angle: collapseSpaces(lead.offer_angle) || '',
    primary_goal,

    ctas: {
      primary: primaryCtaResolved,
      secondary: secondaryCtaResolved
    },

    messaging,
    sectionsHint,

    features: featuresFromOpps.length
      ? featuresFromOpps
      : defaultValuePropsByCategory(cat).map(p => ({ title: p, description: 'Benefit that drives conversions.' })),

    // Clean, concise opportunities for missing-opportunities section
    opportunities: briefOpps,

    notes: {
      weaknesses: sanitizeList(lead.weaknesses, 8),
      opportunities: sanitizeList(lead.opportunities, 8)
    },

    // Contact and trust details derived from canonical lead
    contact: {
      phone: sanitizedPhone || '',
      address: {
        street: (jsonLd && jsonLd.address && collapseSpaces(jsonLd.address.street)) ||
                collapseSpaces(lead.address) ||
                (placesData && collapseSpaces(placesData.address)) ||
                '',
        city:   (jsonLd && jsonLd.address && collapseSpaces(jsonLd.address.city)) ||
                collapseSpaces(lead.city) ||
                '',
        state:  (jsonLd && jsonLd.address && collapseSpaces(jsonLd.address.state)) ||
                collapseSpaces(lead.state) ||
                ''
      },
      google_maps_url: toStringSafe(lead.google_maps_url) ||
                       (options && options.placesData && toStringSafe(options.placesData.google_maps_url)) ||
                       null,
      website_url: toStringSafe(lead.website_url) || null
    },
    trust: {
      // Real rating: JSON-LD > Places > lead-provided.
      rating: (jsonLd && typeof jsonLd.rating === 'number') ? jsonLd.rating
            : (placesData && typeof placesData.rating === 'number') ? placesData.rating
            : (lead.rating != null ? Number(lead.rating) : null),
      review_count: (jsonLd && typeof jsonLd.reviewCount === 'number') ? jsonLd.reviewCount
                  : (placesData && typeof placesData.review_count === 'number') ? placesData.review_count
                  : (lead.review_count != null ? Number(lead.review_count) : null)
    },
    // Real reviews: JSON-LD > Places > empty. Upgrade provider prefers these
    // over niche-pack templates when non-empty. Kept under the `placesReviews`
    // field name for back-compat with the upgrade provider's check.
    placesReviews: (jsonLd && Array.isArray(jsonLd.reviews) && jsonLd.reviews.length)
      ? jsonLd.reviews
      : (placesData && Array.isArray(placesData.reviews) && placesData.reviews.length
          ? placesData.reviews
          : []),
    // Hours: JSON-LD > Places > empty.
    hoursWeekday: (jsonLd && Array.isArray(jsonLd.hours) && jsonLd.hours.length)
      ? jsonLd.hours
      : (placesData && Array.isArray(placesData.hoursWeekday) && placesData.hoursWeekday.length
          ? placesData.hoursWeekday
          : []),
    // Presence flags for embedded review/reservation widgets on the live site.
    widgets: (options && options.siteIdentity && options.siteIdentity.widgets) || null,
    // Price range hint from JSON-LD ($, $$, $$$ etc.) when available.
    priceRange: (jsonLd && jsonLd.priceRange) || '',
    audit: {
      website_status: toStringSafe(lead.website_status) || null,
      website_quality: toStringSafe(lead.website_quality) || null,
      website_weaknesses: sanitizeList(lead.website_weaknesses, 5)
    },

    // Design tokens: fully deterministic from niche + goal
    theme,

    // Schema versioning
    version: 'brief-2',

    // Site analysis results (Steps 1 & 2 of the upgrade model)
    // Populated by site-analyzer.js when a website URL is available
    siteIdentity:     (options && options.siteIdentity)     || null,
    siteOpportunities:(options && options.siteOpportunities)|| sanitizeList(lead.opportunities, 8),

    // Niche pack: resolved copy/proof/intents/variants for the lead's niche.
    // Generators read pack.copy.sectionHeadings, pack.copy.ctaLabels, pack.proof.reviewTemplates,
    // pack.copy.services etc. instead of hardcoding per-niche English.
    nichePack,

    // Active design-system preset, slug-picked from the niche pack's pool.
    // Carries:
    //   - name        (slug, e.g. 'claude' or 'warm-editorial')
    //   - title       (human title from the DESIGN.md H1)
    //   - palette     ({ bg, primary, accent, text }) — used by the renderer
    //                 as a fallback when no scraped brand colors exist
    //   - fonts       ({ heading, body })
    //   - body        (full DESIGN.md prose, fed to llm-rewrite when active)
    // null when the niche pack doesn't define a designSystemPool.
    designSystem
  };

  // Determine hero image URL. Priority:
  //   1. The live site's Open Graph / Twitter image (real brand imagery wins).
  //   2. A niche-specific Unsplash candidate (deterministic by slug).
  //   3. nothing.
  (function assignHeroImage() {
    try {
      let url = null;

      const scrapedOg = options && options.siteIdentity && options.siteIdentity.ogImage;
      const og = scrapedOg || lead.ogImageUrl || lead.og_image_url || null;
      if (og && typeof og === 'string' && og.startsWith('http')) {
        url = og;
      }

      if (!url) {
        const crypto = require('crypto');
        const nicheKey = collapseSpaces(lead.niche).toLowerCase() || '';
        const configPath = '../niches/' + nicheKey + '/config.js';
        const nicheConfig = require(configPath);
        const candidates = Array.isArray(nicheConfig.heroImageCandidates) ? nicheConfig.heroImageCandidates : [];
        if (candidates.length) {
          const slug = toStringSafe(lead.slug || lead.practice_name || lead.business_name || '');
          const hash = crypto.createHash('md5').update(slug).digest('hex');
          const intVal = parseInt(hash.slice(0, 8), 16);
          const idx = intVal % candidates.length;
          const photoId = candidates[idx];
          url = 'https://images.unsplash.com/' + photoId + '?w=1200&h=900&fit=crop&q=80&auto=format';
        }
      }

      if (url) {
        brief.brand.heroImageUrl = url;
      }
    } catch (e) {
      // ignore errors (e.g., config missing)
    }
  })();

  return brief;
}

module.exports = buildSiteBrief;
