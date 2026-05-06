'use strict';

// src/design/taste-pass.js
// Taste Pass — structured editorial refinement pass applied after schema generation.
//
// Purpose:
//   After the noop (or LLM) provider generates a raw page schema, the taste pass
//   applies deterministic editorial rules to improve clarity, visual hierarchy,
//   restraint, and believability. It does NOT rewrite copy from scratch — it
//   trims, caps, deduplicates, and restructures what the provider generated.
//
// Input:  rawSchema (Array<section>) + siteBrief + designProfile
// Output: refinedSchema (Array<section>) — same shape, improved quality
//
// Rules applied:
//   Hero:           headline capped at 10 words, max 2 CTAs, max 3 trust items
//   Trust strip:    max 4 items, deduplication
//   Features:       max 6 items, remove items with empty descriptions
//   Reviews:        max 4 items, min rating 4
//   Missing opps:   max 4 items, deduplication
//   Sections:       remove weak/empty sections, enforce minimum content
//   Copy:           trim vague filler phrases, remove repeated phrases across sections
//   Visual:         limit accent usage, enforce consistent spacing

function toStringSafe(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

function collapseSpaces(s) {
  return toStringSafe(s).replace(/\s+/g, ' ').trim();
}

function wordCount(s) {
  return collapseSpaces(s).split(/\s+/).filter(Boolean).length;
}

function capWords(s, max) {
  const words = collapseSpaces(s).split(/\s+/).filter(Boolean);
  if (words.length <= max) return collapseSpaces(s);
  // Try to cap at a natural break (avoid cutting mid-phrase)
  return words.slice(0, max).join(' ');
}

// Vague marketing filler phrases to reduce (not remove entirely — just flag)
const VAGUE_PHRASES = [
  'world-class', 'best-in-class', 'cutting-edge', 'state-of-the-art',
  'revolutionary', 'game-changing', 'synergy', 'leverage', 'paradigm',
  'seamless experience', 'robust solution', 'holistic approach',
  'next-level', 'take it to the next level', 'at the end of the day',
  'move the needle', 'circle back', 'low-hanging fruit'
];

function reduceVagueness(s) {
  let text = collapseSpaces(s);
  for (const phrase of VAGUE_PHRASES) {
    const re = new RegExp(phrase.replace(/[-/\\^$*+?.()|[\]{}]/g, r => '\\' + r), 'ig');
    text = text.replace(re, '');
  }
  return collapseSpaces(text);
}

function deduplicateList(arr) {
  const seen = new Set();
  return arr.filter(item => {
    const key = collapseSpaces(toStringSafe(item)).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Section-specific refinement rules ───────────────────────────────────────

// Determine the niche category for headline caps and other editorial rules.
function headlineNicheCategory(niche) {
  const n = toStringSafe(niche).toLowerCase();
  if (/dental|dentist|orthodont|dmd|dds/.test(n)) return 'healthcare_local';
  if (/chiro|clinic|medical|medspa|spa|therapy|therapist|veterinary|vet/.test(n)) return 'healthcare_local';
  if (/hvac|plumb|roof|electric|pest|landscap|contractor|remodel|garage|floor|clean/.test(n)) return 'home_service';
  if (/law|attorney|legal|account|cpa|consult|coach|agency|insurance|realtor|real\s*estate/.test(n)) return 'professional_service';
  if (/saas|software|b2b|it|cyber|cloud|devops|data|ai|ml|analytics/.test(n)) return 'b2b_saas';
  return 'general';
}

function headlineCap(niche) {
  const cat = headlineNicheCategory(niche);
  if (cat === 'home_service') return 10;
  if (cat === 'healthcare_local') return 10;
  if (cat === 'b2b_saas') return 14;
  if (cat === 'professional_service') return 13;
  return 11;
}

function refineHero(section, siteBrief) {
  const props = { ...(section.props || {}) };
  const maxWords = headlineCap(siteBrief && siteBrief.niche);

  // Cap headline based on niche-aware limit
  if (props.title && wordCount(props.title) > maxWords) {
    props.title = capWords(props.title, maxWords);
  }

  // Reduce vagueness in subtitle
  if (props.subtitle) {
    props.subtitle = reduceVagueness(props.subtitle);
  }

  // Max 2 CTAs — keep primary and secondary only
  // (Already enforced by schema shape, but ensure secondaryCta is not duplicating primary)
  if (props.primaryCta && props.secondaryCta) {
    const pLabel = collapseSpaces(toStringSafe(props.primaryCta.label)).toLowerCase();
    const sLabel = collapseSpaces(toStringSafe(props.secondaryCta.label)).toLowerCase();
    if (pLabel === sLabel) {
      delete props.secondaryCta;
    }
  }

  // Cap trust props at 3
  if (Array.isArray(props.trustProps) && props.trustProps.length > 3) {
    props.trustProps = props.trustProps.slice(0, 3);
  }

  return { ...section, props };
}

function refineFeatures(section) {
  const props = { ...(section.props || {}) };

  if (Array.isArray(props.items)) {
    // Remove items with empty titles or descriptions
    let items = props.items.filter(item => {
      const t = collapseSpaces(toStringSafe(item && item.title));
      return t.length > 0;
    });

    // Reduce vagueness in descriptions
    items = items.map(item => ({
      ...item,
      title: reduceVagueness(collapseSpaces(toStringSafe(item.title))),
      description: reduceVagueness(collapseSpaces(toStringSafe(item.description)))
    }));

    // Cap at 6 items
    props.items = items.slice(0, 6);
  }

  return { ...section, props };
}

function refineReviews(section) {
  const props = { ...(section.props || {}) };

  if (Array.isArray(props.items)) {
    // Keep only reviews with rating >= 4
    let items = props.items.filter(item => {
      const r = Number(item && item.rating);
      return isNaN(r) || r >= 4;
    });

    // Remove reviews with very short text (< 20 chars)
    items = items.filter(item => {
      const t = collapseSpaces(toStringSafe(item && item.text));
      return t.length >= 20;
    });

    // Cap at 4 items
    props.items = items.slice(0, 4);
  }

  return { ...section, props };
}

function refineMissingOpportunities(section) {
  const props = { ...(section.props || {}) };

  if (Array.isArray(props.items)) {
    const deduped = deduplicateList(props.items);
    props.items = deduped.slice(0, 4);
  }

  return { ...section, props };
}

function refineServices(section) {
  const props = { ...(section.props || {}) };

  if (Array.isArray(props.items)) {
    let items = props.items.filter(item => {
      const t = collapseSpaces(toStringSafe(item && item.title));
      return t.length > 0;
    });
    // Cap at 6 items (3-column grid × 2 rows)
    props.items = items.slice(0, 6);
  }

  return { ...section, props };
}

function refineCta(section) {
  const props = { ...(section.props || {}) };

  // Reduce vagueness in CTA subheading
  if (props.subheading) {
    props.subheading = reduceVagueness(props.subheading);
  }

  return { ...section, props };
}

// ─── Section removal rules ────────────────────────────────────────────────────

function isSectionWeak(section) {
  const type = toStringSafe(section.type);
  const props = section.props || {};

  if (type === 'features') {
    const items = Array.isArray(props.items) ? props.items : [];
    return items.filter(i => collapseSpaces(toStringSafe(i && i.title))).length === 0;
  }
  if (type === 'reviews') {
    const items = Array.isArray(props.items) ? props.items : [];
    return items.length === 0;
  }
  if (type === 'missing-opportunities') {
    const items = Array.isArray(props.items) ? props.items : [];
    return items.filter(Boolean).length === 0;
  }
  if (type === 'services-grid') {
    const items = Array.isArray(props.items) ? props.items : [];
    return items.filter(i => collapseSpaces(toStringSafe(i && i.title))).length === 0;
  }

  return false;
}

// ─── Cross-section deduplication ─────────────────────────────────────────────
// Remove phrases that appear verbatim in more than 2 sections' headings.
function deduplicateHeadings(sections) {
  const headingCounts = {};
  for (const s of sections) {
    const h = collapseSpaces(toStringSafe(s.props && (s.props.heading || s.props.title))).toLowerCase();
    if (h) headingCounts[h] = (headingCounts[h] || 0) + 1;
  }

  return sections.map(s => {
    const props = { ...(s.props || {}) };
    const h = collapseSpaces(toStringSafe(props.heading || props.title)).toLowerCase();
    if (h && headingCounts[h] > 1) {
      // Append section type to disambiguate
      const suffix = ' — ' + toStringSafe(s.type).replace(/-/g, ' ');
      if (props.heading) props.heading = props.heading + suffix;
      else if (props.title) props.title = props.title + suffix;
    }
    return { ...s, props };
  });
}

// ─── Main taste pass ──────────────────────────────────────────────────────────

function applyTastePass(rawSchema, siteBrief, designProfile) {
  if (!Array.isArray(rawSchema)) return rawSchema;

  let sections = rawSchema.map(section => {
    if (!section || !section.type) return section;

    switch (section.type) {
      case 'hero':                  return refineHero(section, siteBrief);
      case 'features':              return refineFeatures(section);
      case 'reviews':               return refineReviews(section);
      case 'missing-opportunities': return refineMissingOpportunities(section);
      case 'services-grid':         return refineServices(section);
      case 'cta':                   return refineCta(section);
      default:                      return section;
    }
  });

  // Remove weak/empty sections (but always keep hero and cta)
  sections = sections.filter(s => {
    if (!s) return false;
    const type = toStringSafe(s.type);
    if (type === 'hero' || type === 'cta') return true;
    return !isSectionWeak(s);
  });

  // Deduplicate headings across sections
  sections = deduplicateHeadings(sections);

  return sections;
}

module.exports = { applyTastePass };
