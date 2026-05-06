'use strict';

// src/design/design-director.js
// The Design Director determines the complete visual identity of a generated page.
//
// Input:  siteBrief (from site-brief-builder.js)
// Output: designProfile object consumed by page-composer, render-engine, and components.
//
// All output is deterministic: same brief always produces the same design profile.
// Variation between leads of the same niche is achieved via a lightweight slug hash
// that selects from a small set of approved variant options.
//
// Design profile shape:
// {
//   profile:          string   – named profile ID (e.g. "premium_dental")
//   palette:          string   – key into PALETTES
//   typography:       string   – key into TYPOGRAPHY
//   heroVariant:      string   – hero layout variant
//   cardStyle:        string   – "soft_elevated" | "bordered_flat" | "filled_subtle"
//   sectionDensity:   string   – key into LAYOUT
//   motionProfile:    string   – key into MOTION
//   backgroundEffect: string   – "radial_mesh" | "soft_gradient" | "none"
//   accentStyle:      string   – "gold_trim" | "brand_trim" | "none"
//   servicesVariant:  string   – services section layout variant
//   reviewsVariant:   string   – reviews section layout variant
//   faqVariant:       string   – faq section layout variant
// }

const PALETTES = require('./palettes');
const TYPOGRAPHY = require('./typography');
const LAYOUT = require('./layout');
const MOTION = require('./motion');

function toStringSafe(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
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

// ─── Deterministic slug hash (0–99) ──────────────────────────────────────────
// Used to select approved variants within a niche without randomness.
function slugHash(slug) {
  const s = toStringSafe(slug) || 'default';
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 100;
}

function pickVariant(slug, variants) {
  const h = slugHash(slug);
  return variants[h % variants.length];
}

// ─── Design rules by niche + goal ────────────────────────────────────────────

const NICHE_RULES = {

  healthcare_local: {
    profile: 'premium_healthcare',
    palettes: ['luxury_teal', 'clinical_blue'],
    typography: 'editorial_serif',
    heroVariants: ['split_premium'],
    cardStyle: 'soft_elevated',
    sectionDensity: 'airy',
    motionProfile: 'calm_interactive',
    backgroundEffects: ['radial_mesh', 'soft_gradient'],
    accentStyle: 'gold_trim',
    servicesVariants: ['grid_cards', 'icon_features'],
    reviewsVariants: ['testimonial_cards', 'review_grid'],
    faqVariant: 'accordion'
  },

  home_service: {
    profile: 'service_direct',
    palettes: ['slate_orange', 'bold_orange'],
    typography: 'strong_sans',
    heroVariants: ['service_quote_split'],
    cardStyle: 'bordered_flat',
    sectionDensity: 'compact',
    motionProfile: 'calm_interactive',
    backgroundEffects: ['soft_gradient', 'none'],
    accentStyle: 'brand_trim',
    servicesVariants: ['icon_features', 'list_features'],
    reviewsVariants: ['review_grid', 'testimonial_cards'],
    faqVariant: 'split_layout'
  },

  b2b_saas: {
    profile: 'saas_modern',
    palettes: ['indigo_neutral', 'purple_dark'],
    typography: 'modern_grotesk',
    heroVariants: ['centered_product', 'product_demo'],
    cardStyle: 'soft_elevated',
    sectionDensity: 'balanced',
    motionProfile: 'expressive',
    backgroundEffects: ['radial_mesh', 'soft_gradient'],
    accentStyle: 'brand_trim',
    servicesVariants: ['icon_features', 'grid_cards'],
    reviewsVariants: ['testimonial_cards', 'carousel'],
    faqVariant: 'accordion'
  },

  professional_service: {
    profile: 'professional_refined',
    palettes: ['slate_refined', 'clinical_blue'],
    typography: 'editorial_serif',
    heroVariants: ['centered', 'split_premium'],
    cardStyle: 'bordered_flat',
    sectionDensity: 'airy',
    motionProfile: 'static',
    backgroundEffects: ['none', 'soft_gradient'],
    accentStyle: 'gold_trim',
    servicesVariants: ['list_features', 'grid_cards'],
    reviewsVariants: ['testimonial_cards', 'review_grid'],
    faqVariant: 'split_layout'
  },

  restaurant: {
    profile: 'restaurant_visual',
    palettes: ['warm_amber'],
    typography: 'warm_humanist',
    heroVariants: ['media_background'],
    cardStyle: 'filled_subtle',
    sectionDensity: 'visual',
    motionProfile: 'calm_interactive',
    backgroundEffects: ['radial_mesh', 'soft_gradient'],
    accentStyle: 'brand_trim',
    servicesVariants: ['grid_cards', 'icon_features'],
    reviewsVariants: ['review_grid', 'carousel'],
    faqVariant: 'accordion'
  },

  ecommerce: {
    profile: 'ecommerce_fresh',
    palettes: ['teal_fresh'],
    typography: 'modern_grotesk',
    heroVariants: ['media_background', 'centered'],
    cardStyle: 'soft_elevated',
    sectionDensity: 'visual',
    motionProfile: 'expressive',
    backgroundEffects: ['soft_gradient', 'radial_mesh'],
    accentStyle: 'brand_trim',
    servicesVariants: ['grid_cards'],
    reviewsVariants: ['carousel', 'review_grid'],
    faqVariant: 'accordion'
  },

  general: {
    profile: 'general_clean',
    palettes: ['neutral_blue'],
    typography: 'clean_system',
    heroVariants: ['split_premium', 'centered'],
    cardStyle: 'soft_elevated',
    sectionDensity: 'balanced',
    motionProfile: 'calm_interactive',
    backgroundEffects: ['soft_gradient', 'none'],
    accentStyle: 'none',
    servicesVariants: ['grid_cards', 'icon_features'],
    reviewsVariants: ['testimonial_cards', 'review_grid'],
    faqVariant: 'accordion'
  }
};

// ─── Goal overrides ───────────────────────────────────────────────────────────
// Some goal+niche combinations override specific design decisions.
function applyGoalOverrides(rules, goal, cat) {
  const overrides = {};

  if (goal === 'request_demo' || goal === 'schedule_consultation') {
    overrides.heroVariants = ['product_demo', 'centered_product', 'centered'];
  }
  if (goal === 'shop_now') {
    overrides.heroVariants = ['media_background', 'centered'];
  }
  if (goal === 'generate_leads' && cat === 'home_service') {
    overrides.heroVariants = ['service_quote_split'];
  }
  if (goal === 'book_appointments' && cat === 'healthcare_local') {
    overrides.heroVariants = ['split_premium'];
  }

  return { ...rules, ...overrides };
}

// ─── Main function ────────────────────────────────────────────────────────────

function directDesign(siteBrief) {
  const brief = siteBrief || {};
  const niche = toStringSafe(brief.niche);
  const goal = toStringSafe(brief.primary_goal);
  const slug = toStringSafe(brief.slug) || toStringSafe(brief.lead_id) || 'default';
  const cat = nicheCategory(niche);

  const baseRules = NICHE_RULES[cat] || NICHE_RULES.general;
  const rules = applyGoalOverrides(baseRules, goal, cat);

  // Deterministic selection within approved variants using slug hash
  const palette = pickVariant(slug, rules.palettes);
  const heroVariant = pickVariant(slug + '-hero', rules.heroVariants);
  const backgroundEffect = pickVariant(slug + '-bg', rules.backgroundEffects);
  const servicesVariant = pickVariant(slug + '-svc', rules.servicesVariants);
  const reviewsVariant = pickVariant(slug + '-rev', rules.reviewsVariants);

  // Validate that selected tokens exist in their respective modules
  const resolvedPalette = PALETTES[palette] ? palette : 'neutral_blue';
  const resolvedTypography = TYPOGRAPHY[rules.typography] ? rules.typography : 'clean_system';
  const resolvedDensity = LAYOUT[rules.sectionDensity] ? rules.sectionDensity : 'balanced';
  const resolvedMotion = MOTION[rules.motionProfile] ? rules.motionProfile : 'calm_interactive';

  return {
    profile: rules.profile,
    palette: resolvedPalette,
    paletteTokens: PALETTES[resolvedPalette],
    typography: resolvedTypography,
    typographyTokens: TYPOGRAPHY[resolvedTypography],
    heroVariant,
    cardStyle: rules.cardStyle,
    sectionDensity: resolvedDensity,
    layoutTokens: LAYOUT[resolvedDensity],
    motionProfile: resolvedMotion,
    motionTokens: MOTION[resolvedMotion],
    backgroundEffect,
    accentStyle: rules.accentStyle,
    servicesVariant,
    reviewsVariant,
    faqVariant: rules.faqVariant
  };
}

// Export both directDesign and resolveDesignProfile for backward compatibility.
function resolveDesignProfile(siteBrief, nichePack) {
  // For now, ignore nichePack and forward to directDesign. A future version could
  // incorporate nichePack hints here. Always return the design profile object
  // returned by directDesign.
  return directDesign(siteBrief);
}

module.exports = { directDesign, resolveDesignProfile };
