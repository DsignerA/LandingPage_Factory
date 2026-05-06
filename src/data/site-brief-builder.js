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
  if (cat === 'restaurant') return 'shop_now';

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

  // heroStyle: centered for B2B SaaS / professional, split for local/service
  const heroStyleMap = {
    healthcare_local:    'split',
    home_service:        'split',
    professional_service:'centered',
    b2b_saas:            'centered',
    ecommerce:           'media-driven',
    restaurant:          'media-driven',
    general:             'split'
  };
  const heroStyle = options.heroStyle || heroStyleMap[cat] || 'split';

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
  const backgroundEffect = options.backgroundEffect || bgMap[cat] || 'soft_gradient';

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
  const sanitizedPhone = sanitizePhone(lead.phone);

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

  // Derive design tokens deterministically from niche + goal
  const theme = deriveTheme(cat, primary_goal, options);

  const brief = {
    lead_id: lead.lead_id || null,
    slug: lead.slug || null,
    // Brand name prefers practice_name over business_name. Falls back to generic.
    brand: {
      name: collapseSpaces(lead.practice_name) || collapseSpaces(lead.business_name) || 'Your Business',
      heroImageUrl: null
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
        street: collapseSpaces(lead.address) || '',
        city: collapseSpaces(lead.city) || '',
        state: collapseSpaces(lead.state) || ''
      },
      google_maps_url: toStringSafe(lead.google_maps_url) || null,
      website_url: toStringSafe(lead.website_url) || null
    },
    trust: {
      rating: lead.rating != null ? Number(lead.rating) : null,
      review_count: lead.review_count != null ? Number(lead.review_count) : null
    },
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
    siteOpportunities:(options && options.siteOpportunities)|| sanitizeList(lead.opportunities, 8)
  };

  // Determine hero image URL from niche config or existing audit data.
  // Attempt to load hero image candidates from the niche config. Use slug hash to pick one.
  (function assignHeroImage() {
    try {
      const crypto = require('crypto');
      const nicheKey = collapseSpaces(lead.niche).toLowerCase() || '';
      const configPath = '../niches/' + nicheKey + '/config.js';
      const nicheConfig = require(configPath);
      const candidates = Array.isArray(nicheConfig.heroImageCandidates) ? nicheConfig.heroImageCandidates : [];
      let url = null;
      if (candidates.length) {
        const slug = toStringSafe(lead.slug || lead.practice_name || lead.business_name || '');
        // Compute a simple deterministic hash from slug
        const hash = crypto.createHash('md5').update(slug).digest('hex');
        const intVal = parseInt(hash.slice(0, 8), 16);
        const idx = intVal % candidates.length;
        const photoId = candidates[idx];
        url = 'https://images.unsplash.com/' + photoId + '?w=1200&h=900&fit=crop&q=80&auto=format';
      }
      // Fallback: use Open Graph image from audit if available
      if (!url) {
        const og = lead.ogImageUrl || lead.og_image_url || null;
        if (og && typeof og === 'string' && og.startsWith('http')) {
          url = og;
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
