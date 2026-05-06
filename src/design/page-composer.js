'use strict';

// src/design/page-composer.js
// The Page Composer determines which sections appear on the page and their order.
//
// Input:  siteBrief + designProfile (from design-director.js)
// Output: ordered array of section descriptors, each containing:
//   { type, variant, props, design }
//
// Composition rules consider:
//   - niche category
//   - primary_goal
//   - brief.notes.weaknesses  (structural signal only — not surfaced in copy)
//   - brief.notes.opportunities (structural signal only)
//   - designProfile (variant selection, density)
//
// The composer does NOT write copy. It only decides structure.
// Copy comes from the noop provider (or LLM provider) which reads the brief.

function toStringSafe(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

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

// Check if an opportunity/weakness list mentions a topic
function mentions(list, ...keywords) {
  const joined = (list || []).map(s => toStringSafe(s).toLowerCase()).join(' ');
  return keywords.some(kw => joined.includes(kw));
}

// ─── Composition templates ────────────────────────────────────────────────────

function composeHealthcareLocal(brief, design) {
  const goal = toStringSafe(brief.primary_goal);
  const opps = (brief.notes && brief.notes.opportunities) || [];
  const weaks = (brief.notes && brief.notes.weaknesses) || [];
  const niche = toStringSafe(brief.niche).toLowerCase();
  const isDental = /(dental|dentist|orthodont|dmd|dds|tooth|teeth)/.test(niche);

  const sections = [];

  // Hero — always first
  sections.push({ type: 'hero', variant: design.heroVariant });

  // In upgraded persuasion flow we intentionally omit the missing-opportunities, virtual-front-desk and chat-demo sections
  // from public-facing healthcare pages. These features are now only surfaced internally via the strategy panel. The
  // order follows the visitor journey: hero → services → how it works/first visit → reviews → insurance → CTA.

  // Services — specific services come immediately after the hero
  sections.push({ type: 'services-grid', variant: design.servicesVariant });

  // Process / How it works — reduce anxiety by clarifying the next steps
  sections.push({ type: 'how-it-works', variant: 'default' });

  // Reviews — social proof after visitors understand what they get
  sections.push({ type: 'reviews', variant: design.reviewsVariant });

  // Insurance — dental only
  if (isDental) {
    sections.push({ type: 'insurance-info', variant: 'default' });
  }

  // CTA — always last
  sections.push({ type: 'cta', variant: 'default' });

  return sections;
}

function composeHomeService(brief, design) {
  const goal = toStringSafe(brief.primary_goal);
  const opps = (brief.notes && brief.notes.opportunities) || [];
  const weaks = (brief.notes && brief.notes.weaknesses) || [];

  const sections = [
    { type: 'hero', variant: design.heroVariant }
  ];

  if (brief.opportunities && brief.opportunities.length) {
    sections.push({ type: 'missing-opportunities', variant: 'default' });
  }

  sections.push({ type: 'features', variant: design.servicesVariant });

  // How-it-works — if opportunities mention process / booking
  if (mentions(opps, 'booking', 'process', 'how it works', 'schedule', 'quote')) {
    sections.push({ type: 'how-it-works', variant: 'default' });
  }

  // Reviews — move earlier if weaknesses mention reviews
  const reviewsEarly = mentions(weaks, 'few reviews', 'no reviews', 'low rating');
  if (reviewsEarly) {
    sections.splice(2, 0, { type: 'reviews', variant: design.reviewsVariant });
  } else {
    sections.push({ type: 'reviews', variant: design.reviewsVariant });
  }

  sections.push({ type: 'cta', variant: 'default' });

  return sections;
}

function composeSaas(brief, design) {
  const opps = (brief.notes && brief.notes.opportunities) || [];
  const weaks = (brief.notes && brief.notes.weaknesses) || [];

  const sections = [
    { type: 'hero', variant: design.heroVariant }
  ];

  if (brief.opportunities && brief.opportunities.length) {
    sections.push({ type: 'missing-opportunities', variant: 'default' });
  }

  sections.push({ type: 'features', variant: design.servicesVariant });

  // Pricing — if opportunities mention pricing or if no specific weakness about it
  if (!mentions(weaks, 'no pricing', 'pricing unclear') || mentions(opps, 'pricing', 'plans')) {
    sections.push({ type: 'pricing', variant: 'default' });
  }

  // Reviews — move earlier if weaknesses mention social proof
  const reviewsEarly = mentions(weaks, 'few reviews', 'no reviews', 'no testimonials', 'no proof');
  if (reviewsEarly) {
    sections.splice(2, 0, { type: 'reviews', variant: design.reviewsVariant });
  } else {
    sections.push({ type: 'reviews', variant: design.reviewsVariant });
  }

  sections.push({ type: 'cta', variant: 'default' });

  return sections;
}

function composeProfessionalService(brief, design) {
  const opps = (brief.notes && brief.notes.opportunities) || [];

  const sections = [
    { type: 'hero', variant: design.heroVariant }
  ];

  if (brief.opportunities && brief.opportunities.length) {
    sections.push({ type: 'missing-opportunities', variant: 'default' });
  }

  sections.push({ type: 'features', variant: design.servicesVariant });
  sections.push({ type: 'reviews', variant: design.reviewsVariant });

  // FAQ — if opportunities mention FAQ or questions
  if (mentions(opps, 'faq', 'questions', 'common questions')) {
    sections.push({ type: 'faq', variant: design.faqVariant });
  }

  sections.push({ type: 'cta', variant: 'default' });

  return sections;
}

function composeRestaurant(brief, design) {
  return [
    { type: 'hero', variant: design.heroVariant },
    { type: 'features', variant: design.servicesVariant },
    { type: 'reviews', variant: design.reviewsVariant },
    { type: 'cta', variant: 'default' }
  ];
}

function composeGeneral(brief, design) {
  const sections = [
    { type: 'hero', variant: design.heroVariant }
  ];

  if (brief.opportunities && brief.opportunities.length) {
    sections.push({ type: 'missing-opportunities', variant: 'default' });
  }

  sections.push({ type: 'features', variant: design.servicesVariant });
  sections.push({ type: 'reviews', variant: design.reviewsVariant });
  sections.push({ type: 'cta', variant: 'default' });

  return sections;
}

// ─── Main compose function ────────────────────────────────────────────────────

function composePage(siteBrief, designProfile) {
  const brief = siteBrief || {};
  const design = designProfile || {};
  const cat = nicheCategory(brief.niche);

  let rawSections;
  switch (cat) {
    case 'healthcare_local':    rawSections = composeHealthcareLocal(brief, design); break;
    case 'home_service':        rawSections = composeHomeService(brief, design); break;
    case 'b2b_saas':            rawSections = composeSaas(brief, design); break;
    case 'professional_service':rawSections = composeProfessionalService(brief, design); break;
    case 'restaurant':          rawSections = composeRestaurant(brief, design); break;
    case 'ecommerce':           rawSections = composeGeneral(brief, design); break;
    default:                    rawSections = composeGeneral(brief, design); break;
  }

  // Deduplicate section types (keep first occurrence)
  const seen = new Set();
  const sections = rawSections.filter(s => {
    if (seen.has(s.type)) return false;
    seen.add(s.type);
    return true;
  });

  // Attach design profile to each section descriptor
  return sections.map((s, i) => ({
    id: `${s.type}-${i + 1}`,
    type: s.type,
    variant: s.variant || 'default',
    design
  }));
}

module.exports = { composePage };
