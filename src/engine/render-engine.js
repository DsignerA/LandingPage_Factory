'use strict';

// render-engine (canonical — design-intelligence upgrade)
// Input:  page schema (array of sections) + options.brief + options.design (designProfile)
// Output: complete HTML string
//
// Design principles:
// - ONE canonical render path. preview-generator.js and all callers use this module.
// - All shell chrome is driven by brief data. No hardcoded niche strings.
// - Full design token system: palette, typography, layout, motion injected as CSS variables.
// - Motion profiles drive IntersectionObserver scroll-reveal and card stagger.
// - Background effects (radial_mesh, soft_gradient) applied to hero section.
// - Schema-driven navigation — nav links derived from sections array.
// - Deterministic: same brief + schema + design always produces the same HTML.

const SUPPORTED_TYPES = new Set([
  'hero', 'missing-opportunities', 'features', 'pricing',
  'services-grid', 'virtual-front-desk', 'chat-demo',
  'reviews', 'insurance-info', 'cta', 'faq', 'how-it-works', 'testimonials',
  // Upgrade model sections
  'trust-signals', 'upgrade-signal',
  // Restaurant-native sections (extract real client data into dedicated cards)
  'about-story', 'hours-location'
]);

// Intent → component type mapping (for scene-based schema)
const INTENT_COMPONENT_MAP = {
  drive_primary_conversion: 'hero',
  establish_trust:          'trust-strip',
  reinforce_authority:      'trust-strip',
  highlight_services:       'features',
  show_social_proof:        'reviews',
  show_local_proof:         'local-proof',
  reduce_objections:        'insurance-info',
  capture_lead:             'cta',
  explain_process:          'how-it-works',
  secondary_cta_close:      'cta'
};

// Variant → component type override (variant name takes precedence)
const VARIANT_COMPONENT_MAP = {
  split_booking_hero:       'hero',
  product_demo_hero:        'hero',
  quote_form_hero:          'hero',
  split_consultation_hero:  'hero',
  lead_capture_hero:        'hero',
  call_cta_hero:            'hero',
  split_premium:            'hero',
  centered_product:         'hero',
  service_grid_cards:       'features',
  service_icon_grid:        'features',
  practice_area_cards:      'features',
  review_cards:             'reviews',
  testimonial_cards:        'reviews',
  insurance_faq_panel:      'insurance-info',
  faq_accordion:            'insurance-info',
  appointment_form_cta:     'cta',
  quote_form_cta:           'cta',
  consultation_form_cta:    'cta',
  contact_form_cta:         'cta',
  numbered_steps:           'how-it-works',
  rating_trust_strip:       'trust-strip',
  trust_badge_strip:        'trust-strip',
  authority_badge_strip:    'trust-strip',
  credentials_strip:        'trust-strip',
  credentials_results_strip:'trust-strip',
  location_proof_strip:     'local-proof',
  service_area_map:         'local-proof',
  sticky_cta_bar:           'cta',
  call_cta_bar:             'cta'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isObject(o) { return o && typeof o === 'object' && !Array.isArray(o); }
function toStringSafe(v) { if (v == null) return ''; return typeof v === 'string' ? v : String(v); }
function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizeSections(input) {
  const arr = Array.isArray(input)
    ? input
    : (isObject(input) && Array.isArray(input.page) ? input.page : []);
  const cleaned = [];
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i] || {};
    const type = toStringSafe(s.type).toLowerCase();
    if (!SUPPORTED_TYPES.has(type)) continue;
    const id = toStringSafe(s.id) || `${type}-${i}`;
    const props = isObject(s.props) ? s.props : {};
    const variant = toStringSafe(s.variant) || 'default';
    cleaned.push({ id, type, variant, props });
  }
  return cleaned;
}

/**
 * Normalize a scene-based schema into the flat sections array the renderer uses.
 * Also attaches _surface and _density metadata to each section for scene-aware rendering.
 * @param {{ scenes: Array }} sceneSchema
 * @param {object} brief
 * @returns {Array} Normalized sections with scene metadata
 */
function normalizeScenesInput(sceneSchema, brief) {
  if (!isObject(sceneSchema) || !Array.isArray(sceneSchema.scenes)) return [];
  const sections = [];
  let idx = 0;
  for (const scene of sceneSchema.scenes) {
    if (!isObject(scene) || !Array.isArray(scene.blocks)) continue;
    for (const block of scene.blocks) {
      if (!isObject(block)) continue;
      const intent = toStringSafe(block.intent);
      const variant = toStringSafe(block.variant);
      // Determine component type: variant map > intent map > fallback
      const type = VARIANT_COMPONENT_MAP[variant] || INTENT_COMPONENT_MAP[intent] || 'features';
      if (!SUPPORTED_TYPES.has(type) && type !== 'trust-strip' && type !== 'local-proof') {
        // Skip unknown types silently
        idx++;
        continue;
      }
      const id = toStringSafe(block.id) || `${type}-${idx}`;
      const props = isObject(block.content) ? block.content : (isObject(block.props) ? block.props : {});
      sections.push({
        id,
        type,
        variant: variant || 'default',
        props,
        _intent: intent,
        _scene: scene.scene,
        _surface: scene.surface,
        _density: scene.density
      });
      idx++;
    }
  }
  return sections;
}

function findTitleFromSchema(sections, brief) {
  try {
    if (brief && brief.brand && brief.brand.name) return toStringSafe(brief.brand.name);
    const hero = sections.find(s => s.type === 'hero');
    const t = hero && hero.props && hero.props.title;
    return toStringSafe(t) || 'Preview';
  } catch { return 'Preview'; }
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

// ─── Design token resolution ──────────────────────────────────────────────────

// Color utilities for live-site palette derivation.
function _hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const h = hex.replace('#', '');
  if (!(h.length === 3 || h.length === 6)) return null;
  const expand = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(expand.slice(0, 2), 16);
  const g = parseInt(expand.slice(2, 4), 16);
  const b = parseInt(expand.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return [r, g, b];
}
function _rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
}
function _mix(rgb, target, amount) {
  return rgb.map((c, i) => c + (target[i] - c) * amount);
}
function _lighten(hex, amount) {
  const rgb = _hexToRgb(hex); if (!rgb) return hex;
  return _rgbToHex(_mix(rgb, [255, 255, 255], amount));
}
function _darken(hex, amount) {
  const rgb = _hexToRgb(hex); if (!rgb) return hex;
  return _rgbToHex(_mix(rgb, [0, 0, 0], amount));
}
function _relativeLuminance([r, g, b]) {
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Build a complete palette token set from a scraped brand color.
 * Used to override the niche fallback when the live site reveals real brand colors.
 */
function deriveCustomPalette(brandColors) {
  if (!brandColors || typeof brandColors !== 'object') return null;
  const primary = brandColors.primary;
  if (!_hexToRgb(primary)) return null;
  const secondary = _hexToRgb(brandColors.secondary) ? brandColors.secondary : _darken(primary, 0.18);
  const accent    = secondary !== primary ? secondary : _lighten(primary, 0.25);
  const lum = _relativeLuminance(_hexToRgb(primary));
  // Choose neutral text on light background; if primary is light, darken text a bit more
  const text       = '#0f172a';
  const textMuted  = '#4a5563';
  const surface    = '#ffffff';
  const bg         = _lighten(primary, 0.94);
  const surfaceAlt = _lighten(primary, 0.88);
  return {
    bg, surface, surfaceAlt,
    primary,
    primaryHover: _darken(primary, 0.12),
    primaryLight: _lighten(primary, 0.82),
    primaryRing:  _lighten(primary, 0.55),
    secondary,
    accent,
    border:       _lighten(primary, 0.75),
    text,
    textMuted,
    textInverse:  lum > 0.55 ? '#0f172a' : '#ffffff'
  };
}

// Fallback palettes (used when design-director is not wired yet)
const FALLBACK_PALETTES = {
  healthcare_local:    { bg:'#faf9f6', surface:'#ffffff', surfaceAlt:'#f4f7f7', primary:'#1a6b6b', primaryHover:'#155858', primaryLight:'#e8f4f4', primaryRing:'#7bbfbf', secondary:'#2d8c8c', accent:'#c4922a', border:'#d8e4e4', text:'#0f1c1c', textMuted:'#4a6464', textInverse:'#ffffff' },
  home_service:        { bg:'#f8f8f7', surface:'#ffffff', surfaceAlt:'#f3f3f1', primary:'#1e293b', primaryHover:'#0f172a', primaryLight:'#e8eaed', primaryRing:'#94a3b8', secondary:'#334155', accent:'#ea580c', border:'#d1d5db', text:'#111827', textMuted:'#6b7280', textInverse:'#ffffff' },
  professional_service:{ bg:'#f8f9fa', surface:'#ffffff', surfaceAlt:'#f1f3f5', primary:'#1e3a5f', primaryHover:'#162d4a', primaryLight:'#dce8f5', primaryRing:'#93b4d8', secondary:'#2d5f8a', accent:'#b8860b', border:'#d0d8e0', text:'#1a2332', textMuted:'#5a6a7a', textInverse:'#ffffff' },
  b2b_saas:            { bg:'#f9fafb', surface:'#ffffff', surfaceAlt:'#f3f4f6', primary:'#4338ca', primaryHover:'#3730a3', primaryLight:'#eef2ff', primaryRing:'#a5b4fc', secondary:'#6366f1', accent:'#0ea5e9', border:'#e0e7ff', text:'#111827', textMuted:'#6b7280', textInverse:'#ffffff' },
  ecommerce:           { bg:'#f0fdfa', surface:'#ffffff', surfaceAlt:'#ccfbf1', primary:'#0d9488', primaryHover:'#0f766e', primaryLight:'#ccfbf1', primaryRing:'#5eead4', secondary:'#14b8a6', accent:'#f97316', border:'#99f6e4', text:'#0f2027', textMuted:'#4a7c7c', textInverse:'#ffffff' },
  restaurant:          { bg:'#fffbf5', surface:'#ffffff', surfaceAlt:'#fef3e2', primary:'#b45309', primaryHover:'#92400e', primaryLight:'#fef3c7', primaryRing:'#fcd34d', secondary:'#d97706', accent:'#dc2626', border:'#fde68a', text:'#1c0a00', textMuted:'#78350f', textInverse:'#ffffff' },
  general:             { bg:'#f8fafc', surface:'#ffffff', surfaceAlt:'#f1f5f9', primary:'#2563eb', primaryHover:'#1d4ed8', primaryLight:'#eff6ff', primaryRing:'#93c5fd', secondary:'#3b82f6', accent:'#f59e0b', border:'#e2e8f0', text:'#0f172a', textMuted:'#64748b', textInverse:'#ffffff' }
};

const FALLBACK_TYPOGRAPHY = {
  fontFamilyHeading: '"Inter", system-ui, sans-serif',
  fontFamilyBody: '"Inter", system-ui, sans-serif',
  Hero:           { size: '3rem',    weight: '700', lineHeight: '1.1',  letterSpacing: '-0.02em' },
  SectionHeading: { size: '1.875rem',weight: '700', lineHeight: '1.2',  letterSpacing: '0' },
  Subheading:     { size: '1.125rem',weight: '500', lineHeight: '1.5',  letterSpacing: '0' },
  Body:           { size: '1rem',    weight: '400', lineHeight: '1.65', letterSpacing: '0' },
  Label:          { size: '0.75rem', weight: '600', lineHeight: '1.4',  letterSpacing: '0.06em', textTransform: 'uppercase' }
};

const FALLBACK_LAYOUT = {
  containerMaxWidth: '1200px', sectionPaddingDesktop: '80px', sectionPaddingMobile: '56px',
  gridGap: '24px', cardPadding: '28px', cardRadius: '12px',
  cardShadow: '0 2px 16px 0 rgba(0,0,0,0.08)', cardShadowHover: '0 8px 32px 0 rgba(0,0,0,0.14)',
  cardBorder: '1px solid rgba(0,0,0,0.08)', innerSpacing: '20px'
};

const FALLBACK_MOTION = {
  enableScrollReveal: true, enableCardStagger: true, enableHoverElevation: true, enableSmoothScroll: true,
  transitionDuration: '200ms', transitionEasing: 'cubic-bezier(0.4,0,0.2,1)',
  revealTranslateY: '20px', revealDuration: '600ms', revealEasing: 'cubic-bezier(0.16,1,0.3,1)',
  // Increase stagger delay for card groups to create a slower cascade
  staggerDelay: '120ms', hoverTranslateY: '-3px', hoverShadowMultiplier: 1.5
};

function resolveDesign(brief, designProfile) {
  const cat = nicheCategory(brief && brief.niche);

  // If a full design profile was passed (from design-director), use it directly
  if (designProfile && designProfile.paletteTokens) {
    return {
      palette: designProfile.paletteTokens,
      typography: designProfile.typographyTokens || FALLBACK_TYPOGRAPHY,
      layout: designProfile.layoutTokens || FALLBACK_LAYOUT,
      motion: designProfile.motionTokens || FALLBACK_MOTION,
      heroVariant: designProfile.heroVariant || 'split_premium',
      backgroundEffect: designProfile.backgroundEffect || 'soft_gradient',
      accentStyle: designProfile.accentStyle || 'none',
      cardStyle: designProfile.cardStyle || 'soft_elevated',
      profile: designProfile.profile || 'general_clean'
    };
  }

  // Fallback: derive from brief.theme or niche
  const theme = (brief && brief.theme) || {};

  // Palette priority:
  //   1. Custom palette derived from the live site's scraped brand colors
  //   2. Vendored design-system preset (e.g. 'claude', 'warm-editorial')
  //   3. Niche-category fallback
  const siteIdentity = brief && brief.siteIdentity;
  const scrapedColors = siteIdentity && siteIdentity.brandColors;
  const customPalette = deriveCustomPalette(scrapedColors);
  const dsColors = brief && brief.designSystem && brief.designSystem.palette;
  const dsPalette = dsColors ? deriveCustomPalette({
    primary: dsColors.primary, secondary: dsColors.accent
  }) : null;
  const palette = customPalette || dsPalette || FALLBACK_PALETTES[cat] || FALLBACK_PALETTES.general;

  // Fonts: scraped real fonts > design-system preset fonts > Inter fallback.
  const fonts = siteIdentity && siteIdentity.brandFonts;
  const dsFonts = brief && brief.designSystem && brief.designSystem.fonts;
  const REAL_FONT = /^[A-Za-z][\w\s\-]+$/;
  const SYSTEM_FONTS = /^(inherit|initial|unset|sans-serif|serif|system-ui|-apple-system|BlinkMacSystemFont|monospace|cursive|fantasy)$/i;
  const fontHeading = (fonts && fonts.heading && REAL_FONT.test(fonts.heading) && !SYSTEM_FONTS.test(fonts.heading)) ? fonts.heading
                    : (dsFonts && dsFonts.heading && REAL_FONT.test(dsFonts.heading)) ? dsFonts.heading
                    : null;
  const fontBody    = (fonts && fonts.body    && REAL_FONT.test(fonts.body)    && !SYSTEM_FONTS.test(fonts.body))    ? fonts.body
                    : (dsFonts && dsFonts.body    && REAL_FONT.test(dsFonts.body))    ? dsFonts.body
                    : null;
  const typography = (fontHeading || fontBody)
    ? Object.assign({}, FALLBACK_TYPOGRAPHY, {
        fontFamilyHeading: fontHeading ? `"${fontHeading}", ${FALLBACK_TYPOGRAPHY.fontFamilyHeading}` : FALLBACK_TYPOGRAPHY.fontFamilyHeading,
        fontFamilyBody:    fontBody    ? `"${fontBody}", ${FALLBACK_TYPOGRAPHY.fontFamilyBody}`       : FALLBACK_TYPOGRAPHY.fontFamilyBody
      })
    : FALLBACK_TYPOGRAPHY;

  return {
    palette,
    typography,
    layout: FALLBACK_LAYOUT,
    motion: FALLBACK_MOTION,
    heroVariant: toStringSafe(theme.heroStyle) || (cat === 'b2b_saas' ? 'centered_product' : 'split_premium'),
    backgroundEffect: toStringSafe(theme.backgroundEffect) || 'soft_gradient',
    accentStyle: 'none',
    cardStyle: 'soft_elevated',
    profile: customPalette ? 'custom_brand'
           : dsPalette ? `ds:${brief.designSystem && brief.designSystem.name || 'unknown'}`
           : 'fallback'
  };
}

// ─── CSS variable injection ───────────────────────────────────────────────────

function buildCssVariables(design) {
  const p = design.palette;
  const t = design.typography;
  const l = design.layout;
  const m = design.motion;

  const typoRoles = ['Hero', 'SectionHeading', 'Subheading', 'Body', 'Label', 'Display', 'BodyLarge', 'Caption'];
  const typoCss = typoRoles.map(role => {
    const tok = t[role];
    if (!tok) return '';
    const base = `--ds-type-${role.toLowerCase()}-size:${tok.size};--ds-type-${role.toLowerCase()}-weight:${tok.weight};--ds-type-${role.toLowerCase()}-lh:${tok.lineHeight};--ds-type-${role.toLowerCase()}-ls:${tok.letterSpacing || '0'};`;
    const transform = tok.textTransform ? `--ds-type-${role.toLowerCase()}-transform:${tok.textTransform};` : '';
    return base + transform;
  }).join('');

  return `
    :root {
      /* Palette */
      --ds-bg: ${p.bg};
      --ds-surface: ${p.surface};
      --ds-surface-alt: ${p.surfaceAlt};
      --ds-primary: ${p.primary};
      --ds-primary-hover: ${p.primaryHover};
      --ds-primary-light: ${p.primaryLight};
      --ds-primary-ring: ${p.primaryRing};
      --ds-secondary: ${p.secondary};
      --ds-accent: ${p.accent};
      --ds-border: ${p.border};
      --ds-text: ${p.text};
      --ds-text-muted: ${p.textMuted};
      --ds-text-inverse: ${p.textInverse};

      /* Typography */
      --ds-font-heading: ${t.fontFamilyHeading};
      --ds-font-body: ${t.fontFamilyBody};
      ${typoCss}

      /* Layout */
      --ds-container: ${l.containerMaxWidth};
      --ds-section-py: ${l.sectionPaddingDesktop};
      --ds-section-py-mobile: ${l.sectionPaddingMobile};
      --ds-grid-gap: ${l.gridGap};
      --ds-card-padding: ${l.cardPadding};
      --ds-card-radius: ${l.cardRadius};
      --ds-card-shadow: ${l.cardShadow};
      --ds-card-shadow-hover: ${l.cardShadowHover};
      --ds-card-border: ${l.cardBorder};
      --ds-inner-spacing: ${l.innerSpacing};

      /* Motion */
      --ds-transition: ${m.transitionDuration} ${m.transitionEasing};
      --ds-reveal-translate: ${m.revealTranslateY};
      --ds-reveal-duration: ${m.revealDuration};
      --ds-stagger-delay: ${m.staggerDelay};
      --ds-hover-translate: ${m.hoverTranslateY};
    }
    body {
      background-color: var(--ds-bg);
      color: var(--ds-text);
      font-family: var(--ds-font-body);
    }
    h1,h2,h3,h4,h5,h6 { font-family: var(--ds-font-heading); }

    /* Sticky header */
    .ds-header { position: sticky; top: 0; z-index: 50; backdrop-filter: saturate(180%) blur(10px); background: rgba(255,255,255,0.88); border-bottom: 1px solid var(--ds-border); }

    /* Cards */
    .ds-card { background: var(--ds-surface); border-radius: var(--ds-card-radius); box-shadow: var(--ds-card-shadow); border: var(--ds-card-border); padding: var(--ds-card-padding); transition: transform var(--ds-transition), box-shadow var(--ds-transition); }
    .ds-card:hover { transform: translateY(var(--ds-hover-translate)); box-shadow: var(--ds-card-shadow-hover); }

    /* Buttons */
    .ds-btn-primary { display: inline-flex; align-items: center; justify-content: center; padding: 0.625rem 1.5rem; border-radius: calc(var(--ds-card-radius) * 0.6); background: var(--ds-primary); color: var(--ds-text-inverse); font-weight: 600; font-size: 0.9375rem; transition: background var(--ds-transition), transform var(--ds-transition); cursor: pointer; border: none; }
    .ds-btn-primary:hover { background: var(--ds-primary-hover); transform: translateY(-1px); }
    .ds-btn-outline { display: inline-flex; align-items: center; justify-content: center; padding: 0.625rem 1.5rem; border-radius: calc(var(--ds-card-radius) * 0.6); background: transparent; color: var(--ds-primary); font-weight: 600; font-size: 0.9375rem; border: 2px solid var(--ds-primary); transition: background var(--ds-transition), color var(--ds-transition); cursor: pointer; }
    .ds-btn-outline:hover { background: var(--ds-primary-light); }
    .ds-btn-ghost { display: inline-flex; align-items: center; justify-content: center; padding: 0.625rem 1.5rem; border-radius: calc(var(--ds-card-radius) * 0.6); background: transparent; color: var(--ds-text); font-weight: 500; font-size: 0.9375rem; border: none; transition: background var(--ds-transition); cursor: pointer; }
    .ds-btn-ghost:hover { background: var(--ds-surface-alt); }

    /* Icon micro-interaction */
    .ds-icon { display:inline-block; transition: transform 0.3s var(--ds-transition), color 0.3s var(--ds-transition); }
    .ds-icon:hover { transform: translateY(-3px); color: var(--ds-accent); }

    /* Section spacing */
    .ds-section { padding-top: var(--ds-section-py); padding-bottom: var(--ds-section-py); }
    @media (max-width: 768px) { .ds-section { padding-top: var(--ds-section-py-mobile); padding-bottom: var(--ds-section-py-mobile); } }
    .ds-container { max-width: var(--ds-container); margin: 0 auto; padding-left: 1.5rem; padding-right: 1.5rem; }

    /* Section headings */
    .ds-section-heading { font-size: var(--ds-type-sectionheading-size); font-weight: var(--ds-type-sectionheading-weight); line-height: var(--ds-type-sectionheading-lh); letter-spacing: var(--ds-type-sectionheading-ls); color: var(--ds-text); }
    .ds-hero-heading { font-size: var(--ds-type-hero-size); font-weight: var(--ds-type-hero-weight); line-height: var(--ds-type-hero-lh); letter-spacing: var(--ds-type-hero-ls); color: var(--ds-text); }
    .ds-subheading { font-size: var(--ds-type-subheading-size); font-weight: var(--ds-type-subheading-weight); line-height: var(--ds-type-subheading-lh); color: var(--ds-text-muted); }
    .ds-label { font-size: var(--ds-type-label-size); font-weight: var(--ds-type-label-weight); letter-spacing: var(--ds-type-label-ls); text-transform: uppercase; color: var(--ds-primary); }

    /* Scroll reveal */
    /* Scroll-reveal is opt-in: only apply opacity:0 once JS is confirmed to
       drive the IntersectionObserver. This keeps the page visible for crawlers,
       no-JS visitors, and full-page screenshots taken before reveals fire. */
    .js-reveal .fade-up { opacity: 0; transform: translateY(var(--ds-reveal-translate)); transition: opacity var(--ds-reveal-duration) cubic-bezier(0.16,1,0.3,1), transform var(--ds-reveal-duration) cubic-bezier(0.16,1,0.3,1); }
    .js-reveal .fade-up.visible { opacity: 1; transform: translateY(0); }

    /* Background effects */
    .bg-radial-mesh { background-image: radial-gradient(ellipse at 20% 50%, color-mix(in srgb, var(--ds-primary) 8%, transparent) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, color-mix(in srgb, var(--ds-accent) 6%, transparent) 0%, transparent 50%); }
    .bg-soft-gradient { background-image: linear-gradient(135deg, color-mix(in srgb, var(--ds-primary) 4%, var(--ds-bg)) 0%, var(--ds-bg) 60%); }

    /* Accent trim */
    .accent-gold-trim .ds-card { border-top: 3px solid var(--ds-accent); }
    .accent-brand-trim .ds-card { border-top: 3px solid var(--ds-primary); }

    /* Floating elements */
    .ds-floating-cta { position: fixed; right: 1.5rem; bottom: 5.5rem; z-index: 40; }
    .ds-mobile-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; background: var(--ds-surface); border-top: 1px solid var(--ds-border); }

    /* Form inputs */
    .ds-input { width: 100%; border-radius: calc(var(--ds-card-radius) * 0.5); border: 1px solid var(--ds-border); padding: 0.625rem 0.875rem; font-size: 0.9375rem; background: var(--ds-surface); color: var(--ds-text); transition: border-color var(--ds-transition), box-shadow var(--ds-transition); }
    .ds-input:focus { outline: none; border-color: var(--ds-primary); box-shadow: 0 0 0 3px var(--ds-primary-ring); }
    .ds-label-text { display: block; font-size: 0.875rem; font-weight: 500; color: var(--ds-text); margin-bottom: 0.25rem; }
  `;
}

// ─── Motion JavaScript ────────────────────────────────────────────────────────

function buildMotionScript(motion) {
  if (!motion.enableScrollReveal) return '';
  return `
    // Motion: scroll-reveal with IntersectionObserver.
    // js-reveal is the gate the CSS uses to actually hide .fade-up elements
    // before they enter the viewport — see the .js-reveal scoping in styles.
    // Without this flag, the page stays visible (good for SSR/screenshots/no-JS).
    document.documentElement.classList.add('js-reveal');
    (function() {
      var staggerDelay = ${parseInt(motion.staggerDelay) || 80};
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            var el = entry.target;
            var delay = parseInt(el.getAttribute('data-stagger') || '0');
            setTimeout(function() { el.classList.add('visible'); }, delay);
            observer.unobserve(el);
          }
        });
      }, { threshold: 0.12 });

      function initReveal() {
        var els = document.querySelectorAll('.fade-up');
        var cardGroups = {};
        els.forEach(function(el) {
          var group = el.getAttribute('data-stagger-group');
          if (group) {
            cardGroups[group] = (cardGroups[group] || 0);
            el.setAttribute('data-stagger', String(cardGroups[group] * staggerDelay));
            cardGroups[group]++;
          }
          observer.observe(el);
        });
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReveal);
      } else {
        setTimeout(initReveal, 100);
      }
    })();

    // Hero entrance sequence on load
    (function() {
      function revealHero() {
        var els = document.querySelectorAll('[data-hero-reveal]');
        if (!els || !els.length) return;
        els.forEach(function(el) {
          // initialize hidden state
          el.style.opacity = '0';
          el.style.transform = 'translateY(20px)';
        });
        els.forEach(function(el) {
          var order = parseInt(el.getAttribute('data-hero-reveal')) || 0;
          setTimeout(function() {
            el.style.transition = 'opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          }, 120 * order);
        });
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', revealHero);
      } else {
        revealHero();
      }
    })();

    // Section rhythm: alternate backgrounds and adjust density
    (function() {
      function applySectionRhythm() {
        var sections = document.querySelectorAll('.ds-section');
        var idx = 0;
        for (var i = 0; i < sections.length; i++) {
          var s = sections[i];
          var sid = s.getAttribute('id') || '';
          var type = sid.split('-')[0];
          // Skip hero and cta sections
          if (/^hero/.test(sid) || /cta/.test(sid)) continue;
          // Apply alternating background colors on body sections
          if (idx % 2 === 1) {
            s.style.background = 'var(--ds-surface-alt)';
          } else {
            s.style.background = 'var(--ds-surface)';
          }
          idx++;
        }
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applySectionRhythm);
      } else {
        applySectionRhythm();
      }
    })();
  `;
}

// ─── Background effect helper ─────────────────────────────────────────────────

function bgEffectClass(effect) {
  if (effect === 'radial_mesh') return 'bg-radial-mesh';
  if (effect === 'soft_gradient') return 'bg-soft-gradient';
  return '';
}

// ─── Trust strip ─────────────────────────────────────────────────────────────

function buildTrustStrip(brief) {
  // Build a trust strip using the richest available signals from the brief. Prioritize:
  //   1. Star rating + review count
  //   2. Phone call CTA
  //   3. Niche-specific insurance or years in business (not available by default)
  //   4. Fallback generics (based on niche)
  const trust = (brief && brief.trust) || {};
  const contact = (brief && brief.contact) || {};
  const cat = nicheCategory(brief && brief.niche);
  let items = [];
  const rating = typeof trust.rating === 'number' && trust.rating > 0 ? trust.rating : null;
  const reviewCount = typeof trust.review_count === 'number' && trust.review_count > 0 ? trust.review_count : null;
  if (rating && reviewCount) {
    const r = Number(rating).toFixed(1);
    items.push(`⭐ ${r} stars (${reviewCount} reviews)`);
  }
  const phone = contact && contact.phone ? String(contact.phone).trim() : '';
  if (phone) {
    items.push(`Call ${phone}`);
  }
  // Future: add insurance acceptance or years in business when available
  // Fallback to niche-specific generic messages when fewer than 3 items
  if (items.length < 3) {
    const defaults = {
      healthcare_local:    ['Easy Online Booking', 'Most Insurance Accepted', 'Evening Appointments Available'],
      home_service:        ['Fast Response Times', 'Upfront Transparent Pricing', 'Licensed & Insured'],
      professional_service:['Expert Guidance', 'Tailored Solutions', 'Results You Can Measure'],
      b2b_saas:            ['Deploy in Minutes', 'Proven ROI', 'Secure & Scalable'],
      ecommerce:           ['Free & Fast Shipping', 'Easy Returns', 'Curated Quality'],
      restaurant:          ['Fresh Ingredients', 'Online Ordering', 'Fast Pickup & Delivery'],
      general:             ['Trusted Local Service', 'Clear Pricing', 'Satisfaction Guaranteed']
    };
    const fallback = defaults[cat] || defaults.general;
    const needed = fallback.filter(d => !items.includes(d));
    items = [...items, ...needed].slice(0, 3);
  }
  const strips = items.map(item =>
    `<div class="flex items-center gap-2 text-sm"><span style="color:var(--ds-primary)">✓</span><span>${htmlEscape(item)}</span></div>`
  ).join('\n      ');

  return `
  <div style="border-bottom:1px solid var(--ds-border);background:var(--ds-surface)">
    <div class="ds-container" style="padding-top:0.5rem;padding-bottom:0.5rem">
      <div style="display:flex;flex-wrap:wrap;gap:1rem 1.5rem;align-items:center;color:var(--ds-text-muted)">
        ${strips}
      </div>
    </div>
  </div>`;
}

// ─── Header ───────────────────────────────────────────────────────────────────

function buildHeader(brief, sections, docTitle, design) {
  const ctas = (brief && brief.ctas) || {};
  const primaryCta = ctas.primary || { label: 'Get Started', href: '#cta' };
  const secondaryCta = ctas.secondary || null;
  const phone = (brief && brief.phone) || '';

  const sectionTypeSet = new Set(sections.map(s => s.type));
  const navItems = [];
  if (sectionTypeSet.has('services-grid') || sectionTypeSet.has('features')) navItems.push({ label: 'Services', href: '#services' });
  if (sectionTypeSet.has('reviews') || sectionTypeSet.has('testimonials')) navItems.push({ label: 'Reviews', href: '#reviews' });
  if (sectionTypeSet.has('insurance-info')) navItems.push({ label: 'Insurance', href: '#insurance' });
  if (sectionTypeSet.has('pricing')) navItems.push({ label: 'Pricing', href: '#pricing' });
  if (sectionTypeSet.has('faq')) navItems.push({ label: 'FAQ', href: '#faq' });
  if (sectionTypeSet.has('cta') || sectionTypeSet.has('virtual-front-desk')) navItems.push({ label: 'Contact', href: '#contact' });

  const navLinks = navItems.map(item =>
    `<a href="${htmlEscape(item.href)}" style="color:var(--ds-text-muted);font-size:0.9375rem;font-weight:500;text-decoration:none;transition:color 0.2s" onmouseover="this.style.color='var(--ds-primary)'" onmouseout="this.style.color='var(--ds-text-muted)'" data-nav="${htmlEscape(item.href.replace('#',''))}">${htmlEscape(item.label)}</a>`
  ).join('\n        ');

  const secondaryBtn = secondaryCta
    ? `<a href="${htmlEscape(secondaryCta.href || '#')}" class="ds-btn-outline" style="font-size:0.875rem;padding:0.5rem 1rem">${htmlEscape(secondaryCta.label || 'Learn More')}</a>`
    : (phone ? `<a href="tel:${htmlEscape(phone)}" class="ds-btn-ghost" style="font-size:0.875rem;padding:0.5rem 1rem">Call Us</a>` : '');

  // Logo: scraped brand mark wins; otherwise a colored square as a stand-in.
  const brand = (brief && brief.brand) || {};
  const logoUrl = brand.logoUrl || '';
  const brandName = toStringSafe(brand.name || '') || toStringSafe(docTitle);
  const logoEl = logoUrl
    ? `<img src="${htmlEscape(logoUrl)}" alt="${htmlEscape(brandName)} logo" style="height:2.5rem;width:auto;max-width:14rem;object-fit:contain;display:block" />`
    : `<div style="width:2.25rem;height:2.25rem;border-radius:0.5rem;background:var(--ds-primary)"></div>`;

  return `
  <header class="ds-header">
    <div class="ds-container" style="display:flex;align-items:center;justify-content:space-between;padding-top:0.75rem;padding-bottom:0.75rem">
      <div style="display:flex;align-items:center;gap:0.75rem">
        ${logoEl}
        <div ${logoUrl ? 'style="display:none"' : ''}>
          <div style="font-weight:800;font-size:1.0625rem;line-height:1.2;font-family:var(--ds-font-heading)" id="site-brand">${htmlEscape(brandName)}</div>
          <div style="font-size:0.75rem;color:var(--ds-text-muted)" id="site-location" aria-live="polite"></div>
        </div>
      </div>
      <!-- Mobile menu toggle; shown only on small screens -->
      <button id="nav-toggle" style="display:none;background:none;border:none;cursor:pointer;padding:0.5rem" aria-label="Menu">
        <span style="display:block;width:22px;height:2px;background:var(--ds-text);margin:5px 0"></span>
        <span style="display:block;width:22px;height:2px;background:var(--ds-text);margin:5px 0"></span>
        <span style="display:block;width:22px;height:2px;background:var(--ds-text);margin:5px 0"></span>
      </button>
      <nav style="display:none" class="md-nav" id="main-nav">
        <div style="display:flex;align-items:center;gap:1.5rem">
          ${navLinks}
        </div>
      </nav>
      <div style="display:flex;align-items:center;gap:0.75rem" id="header-ctas">
        ${secondaryBtn}
        <a href="${htmlEscape(primaryCta.href || '#cta')}" class="ds-btn-primary" style="font-size:0.875rem;padding:0.5rem 1.125rem">${htmlEscape(primaryCta.label || 'Get Started')}</a>
      </div>
    </div>
  </header>`;
}

// ─── Action section (form) ────────────────────────────────────────────────────

function buildActionSection(brief) {
  const goal = toStringSafe(brief && brief.primary_goal);
  const ctas = (brief && brief.ctas) || {};
  const primaryCta = ctas.primary || { label: 'Get Started', href: '#cta' };
  const phone = (brief && brief.phone) || '';
  const brandName = (brief && brief.brand && brief.brand.name) || 'Us';

  if (goal === 'book_appointments') {
    const phoneLink = phone ? `<a href="tel:${htmlEscape(phone)}" style="color:var(--ds-primary);font-weight:600;text-decoration:none">Or call the office</a>` : '';
    return `
  <section id="book" class="ds-section" style="padding-top:3rem">
    <div class="ds-container">
      <div class="ds-card" style="display:grid;grid-template-columns:1fr;gap:2rem">
        <div>
          <div class="ds-label" style="margin-bottom:0.5rem">Book Now</div>
          <h3 class="ds-section-heading" style="margin-bottom:0.75rem">Request Your Appointment</h3>
          <p style="color:var(--ds-text-muted);margin-bottom:1.5rem">Tell us a little about you. We'll follow up to confirm a time that works.</p>
          <div style="display:grid;gap:1rem">
            <div><label class="ds-label-text">Name</label><input type="text" class="ds-input" placeholder="Your full name" aria-label="Name (demo)" /></div>
            <div><label class="ds-label-text">Phone</label><input type="tel" class="ds-input" placeholder="(000) 000-0000" aria-label="Phone (demo)" /></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
              <div><label class="ds-label-text">Preferred Day</label><input type="text" class="ds-input" placeholder="e.g., Tuesday" /></div>
              <div><label class="ds-label-text">Preferred Time</label><input type="text" class="ds-input" placeholder="e.g., 6:00 PM" /></div>
            </div>
            <div><label class="ds-label-text">Reason for Visit</label><textarea rows="3" class="ds-input" placeholder="Describe your needs..."></textarea></div>
            <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
              <button type="button" class="ds-btn-primary">Request Appointment</button>
              ${phoneLink}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
  }

  if (goal === 'generate_leads' || goal === 'get_in_touch') {
    return `
  <section id="contact" class="ds-section" style="padding-top:3rem">
    <div class="ds-container">
      <div class="ds-card" style="max-width:36rem;margin:0 auto;text-align:center">
        <div class="ds-label" style="margin-bottom:0.5rem">Free Estimate</div>
        <h3 class="ds-section-heading" style="margin-bottom:0.75rem">Get a Free Quote</h3>
        <p style="color:var(--ds-text-muted);margin-bottom:1.5rem">Tell us about your project and we'll get back to you quickly.</p>
        <div style="display:grid;gap:1rem">
          <input type="text" class="ds-input" placeholder="Your name" />
          <input type="tel" class="ds-input" placeholder="Phone number" />
          <textarea rows="3" class="ds-input" placeholder="Describe your project..."></textarea>
          <button type="button" class="ds-btn-primary">${htmlEscape(primaryCta.label || 'Get Free Quote')}</button>
        </div>
      </div>
    </div>
  </section>`;
  }

  if (goal === 'request_demo' || goal === 'schedule_consultation') {
    return `
  <section id="contact" class="ds-section" style="padding-top:3rem">
    <div class="ds-container">
      <div class="ds-card" style="max-width:36rem;margin:0 auto;text-align:center">
        <div class="ds-label" style="margin-bottom:0.5rem">Get Started</div>
        <h3 class="ds-section-heading" style="margin-bottom:0.75rem">${htmlEscape(primaryCta.label || 'Request a Demo')}</h3>
        <p style="color:var(--ds-text-muted);margin-bottom:1.5rem">See how ${htmlEscape(brandName)} works for your team. We'll set up a personalized walkthrough.</p>
        <div style="display:grid;gap:1rem">
          <input type="text" class="ds-input" placeholder="Your name" />
          <input type="email" class="ds-input" placeholder="Work email" />
          <input type="text" class="ds-input" placeholder="Company name" />
          <button type="button" class="ds-btn-primary">${htmlEscape(primaryCta.label || 'Request Demo')}</button>
        </div>
      </div>
    </div>
  </section>`;
  }

  return '';
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function buildFooter(brief, sections, docTitle) {
  const messaging = (brief && brief.messaging) || {};
  const tagline = toStringSafe(messaging.elevator_pitch) || toStringSafe(brief && brief.location) || '';
  const ctas = (brief && brief.ctas) || {};
  const primaryCta = ctas.primary || { label: 'Get Started', href: '#cta' };

  const sectionTypeSet = new Set(sections.map(s => s.type));
  const footerLinks = [];
  if (sectionTypeSet.has('services-grid') || sectionTypeSet.has('features')) footerLinks.push({ label: 'Services', href: '#services' });
  if (sectionTypeSet.has('reviews')) footerLinks.push({ label: 'Reviews', href: '#reviews' });
  if (sectionTypeSet.has('pricing')) footerLinks.push({ label: 'Pricing', href: '#pricing' });
  footerLinks.push({ label: primaryCta.label || 'Contact', href: primaryCta.href || '#cta' });

  const footerNavLinks = footerLinks.map(item =>
    `<a href="${htmlEscape(item.href)}" style="color:var(--ds-text-muted);text-decoration:none;font-size:0.875rem" onmouseover="this.style.color='var(--ds-primary)'" onmouseout="this.style.color='var(--ds-text-muted)'">${htmlEscape(item.label)}</a>`
  ).join('\n        ');

  return `
  <footer style="margin-top:4rem;border-top:1px solid var(--ds-border);background:var(--ds-surface)">
    <div class="ds-container" style="padding-top:2.5rem;padding-bottom:2.5rem;display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:1.5rem">
      <div>
        <div style="font-weight:700;font-size:1rem;font-family:var(--ds-font-heading);color:var(--ds-text)">${htmlEscape(docTitle)}</div>
        ${tagline ? `<div style="font-size:0.8125rem;color:var(--ds-text-muted);margin-top:0.25rem">${htmlEscape(tagline)}</div>` : ''}
      </div>
      <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
        ${footerNavLinks}
      </div>
    </div>
  </footer>`;
}

// ─── Mobile sticky bar ────────────────────────────────────────────────────────

function buildStickyBar(brief) {
  const ctas = (brief && brief.ctas) || {};
  const primaryCta = ctas.primary || { label: 'Get Started', href: '#cta' };
  const secondaryCta = ctas.secondary || null;
  const phone = (brief && brief.phone) || '';

  const leftBtn = secondaryCta
    ? `<a href="${htmlEscape(secondaryCta.href || '#')}" class="ds-btn-outline" style="flex:1;justify-content:center">${htmlEscape(secondaryCta.label || 'Learn More')}</a>`
    : (phone ? `<a href="tel:${htmlEscape(phone)}" class="ds-btn-outline" style="flex:1;justify-content:center">Call Us</a>` : '');

  return `
  <div class="ds-mobile-bar" id="mobile-bar">
    <div class="ds-container" style="display:flex;gap:0.75rem;padding-top:0.75rem;padding-bottom:0.75rem">
      ${leftBtn}
      <a href="${htmlEscape(primaryCta.href || '#cta')}" class="ds-btn-primary" style="flex:1;justify-content:center">${htmlEscape(primaryCta.label || 'Get Started')}</a>
    </div>
  </div>`;
}

// ─── Floating CTA ─────────────────────────────────────────────────────────────

function buildFloatingCta(brief) {
  const cat = nicheCategory(brief && brief.niche);
  const goal = toStringSafe(brief && brief.primary_goal);
  if (cat === 'healthcare_local' || goal === 'book_appointments' || goal === 'generate_leads') {
    return `
  <div class="ds-floating-cta">
    <button id="chat-entry" class="ds-btn-primary" style="border-radius:9999px;box-shadow:0 4px 20px rgba(0,0,0,0.18);gap:0.5rem" aria-label="Open chat">
      <span style="width:0.625rem;height:0.625rem;background:#22c55e;border-radius:9999px;display:inline-block"></span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H9l-5 4v-4H7a3 3 0 0 1-3-3V5z"/></svg>
      Chat
    </button>
  </div>`;
  }
  return '';
}

// ─── Responsive nav script ────────────────────────────────────────────────────

function buildNavScript() {
  return `
    // Responsive nav
    (function() {
      var nav = document.getElementById('main-nav');
      var toggle = document.getElementById('nav-toggle');
      function updateNav() {
        var isMobile = window.innerWidth < 768;
        if (nav) nav.style.display = isMobile ? 'none' : 'block';
        if (toggle) toggle.style.display = isMobile ? 'block' : 'none';
      }
      updateNav();
      window.addEventListener('resize', updateNav);
      if (toggle && nav) {
        toggle.addEventListener('click', function() {
          // Toggle nav visibility on mobile
          if (nav.style.display === 'block') {
            nav.style.display = 'none';
          } else {
            nav.style.display = 'block';
          }
        });
      }
    })();

    // Smooth scroll nav
    document.addEventListener('click', function(e) {
      var t = e.target.closest('[data-nav]');
      if (!t) return;
      var kind = t.getAttribute('data-nav');
      if (!kind) return;
      e.preventDefault();
      var el = document.getElementById(kind) || document.querySelector('[data-section="' + kind + '"]');
      if (!el) {
        var hs = Array.from(document.querySelectorAll('h2'));
        el = hs.find(function(h) { return (h.textContent || '').toLowerCase().includes(kind); }) || null;
      }
      if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e2) { el.scrollIntoView(); } }
    });

    // Floating chat button demo
    var chatBtn = document.getElementById('chat-entry');
    if (chatBtn) {
      chatBtn.addEventListener('click', function() {
        alert('This demo shows how a virtual assistant can answer questions and capture leads, even after hours.');
      });
    }

    // Brand name from hero
    try {
      var brandEl = document.getElementById('site-brand');
      var locEl = document.getElementById('site-location');
      var sections = window.pageSections || [];
      var hero = sections.find(function(s) { return s && s.type === 'hero'; });
      var heroTitle = hero && hero.props && hero.props.title ? String(hero.props.title) : '';
      if (brandEl && heroTitle) {
        var parts = heroTitle.split(/[–—]/);
        brandEl.textContent = (parts[0] || heroTitle).trim();
      }
      if (locEl && heroTitle) {
        var inIdx = heroTitle.toLowerCase().lastIndexOf(' in ');
        if (inIdx !== -1) { var loc = heroTitle.slice(inIdx + 4).trim(); if (loc) locEl.textContent = 'Serving ' + loc; }
      }
    } catch(e) {}
  `;
}

// ─── Main render function ─────────────────────────────────────────────────────

function renderHtmlDocument({ title, schemaJson, assetPrefix, brief, sections, design, localProof, options }) {
  const tp = (p) => assetPrefix + p.replace(/^\.\/?/, '');
  const docTitle = title ? htmlEscape(title) : 'Preview';

  const cssVars = buildCssVariables(design);
  const trustStrip = buildTrustStrip(brief);
  const header = buildHeader(brief, sections, title || 'Preview', design);
  const actionSection = buildActionSection(brief);
  const footer = buildFooter(brief, sections, title || 'Preview');
  const stickyBar = buildStickyBar(brief);
  const floatingCta = buildFloatingCta(brief);
  const motionScript = buildMotionScript(design.motion);
  const navScript = buildNavScript();

  // Surface system CSS (injected for scene-aware sections)
  let surfaceCss = '';
  try {
    const { generateSurfaceCSS } = require('../design/surface-system.js');
    surfaceCss = generateSurfaceCSS();
  } catch (e) {
    // surface-system not available, skip
  }

  // Local proof JSON for client-side hydration
  const localProofJson = localProof ? JSON.stringify(localProof) : 'null';

  // Strategy panel (preview mode)
  let strategyPanelHtml = '';
  try {
    const { buildStrategyPanel } = require('./strategy-panel.js');
    const intentVariantPlan = sections
      .filter(s => s._intent)
      .map(s => ({ intent: s._intent, variant: s.variant }));
    const intentPlan = intentVariantPlan.map(i => i.intent);
    strategyPanelHtml = buildStrategyPanel({
      brief,
      intentPlan,
      intentVariantPlan,
      design,
      nichePack: options && options.nichePack ? options.nichePack : null,
      localProof
    });
  } catch (e) {
    // strategy panel not available, skip
  }

  const bgClass = bgEffectClass(design.backgroundEffect);
  const accentClass = design.accentStyle === 'gold_trim' ? 'accent-gold-trim' : design.accentStyle === 'brand_trim' ? 'accent-brand-trim' : '';

  const themeJson = JSON.stringify({
    palette: design.profile,
    heroVariant: design.heroVariant,
    backgroundEffect: design.backgroundEffect,
    cardStyle: design.cardStyle,
    motionProfile: design.motion.enableScrollReveal ? 'calm_interactive' : 'static',
    accentStyle: design.accentStyle
  });

  // Build Google Fonts preconnect and link tags when a googleFontsUrl is defined on the typography tokens.
  const fontsUrl = design && design.typography && design.typography.googleFontsUrl;
  const fontsLink = fontsUrl ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link rel="stylesheet" href="${fontsUrl}">` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle}</title>
  <script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  ${fontsLink}
  <style>${cssVars}${surfaceCss}</style>
</head>
<body class="${bgClass} ${accentClass}">

${strategyPanelHtml}
${header}
${trustStrip}

  <div id="app" class="min-h-screen">
    <page-renderer :page="pageSections" :theme="pageTheme"></page-renderer>
  </div>

${actionSection}
${footer}
${floatingCta}
${stickyBar}

  <!-- Page theme + sections MUST be injected before any component scripts.
       Some components read window.pageTheme at module load time to pick their
       template (e.g. hero.js → heroVariant), so this script tag has to run
       first or every page falls back to the default variant. -->
  <script>
    window.pageSections = ${schemaJson};
    window.pageTheme = ${themeJson};
    window.pageLocalProof = ${localProofJson};
  </script>

  <!-- Canonical component scripts (src/components/ is the source of truth) -->
  <script src="${tp('src/components/missing-opportunities.js')}"></script>
  <script src="${tp('src/components/services-grid.js')}"></script>
  <script src="${tp('src/components/virtual-front-desk.js')}"></script>
  <script src="${tp('src/components/chat-demo.js')}"></script>
  <script src="${tp('src/components/reviews.js')}"></script>
  <script src="${tp('src/components/insurance-info.js')}"></script>
  <script src="${tp('src/components/cta.js')}"></script>
  <!-- Upgrade model components -->
  <script src="${tp('src/components/trust-signals.js')}"></script>
  <script src="${tp('src/components/upgrade-signal.js')}"></script>
  <!-- Restaurant-native sections -->
  <script src="${tp('src/components/about-story.js')}"></script>
  <script src="${tp('src/components/hours-location.js')}"></script>

  <!-- Shared components -->
  <script src="${tp('components/hero.js')}"></script>
  <script src="${tp('components/features.js')}"></script>
  <script src="${tp('components/pricing.js')}"></script>
  <script src="${tp('components/faq.js')}"></script>
  <script src="${tp('components/testimonials.js')}"></script>
  <script src="${tp('components/how-it-works.js')}"></script>
  <script src="${tp('components/footer.js')}"></script>

  <!-- UI template overrides -->
  <script src="${tp('src/ui/hero.js')}"></script>
  <script src="${tp('src/ui/features.js')}"></script>
  <script src="${tp('src/ui/pricing.js')}"></script>
  <script src="${tp('src/ui/missing-opportunities.js')}"></script>

  <!-- Canonical registry and renderer -->
  <script src="${tp('src/components/registry.js')}"></script>
  <script src="${tp('components/page-renderer.js')}"></script>

  <script>
    const app = Vue.createApp({
      data() { return { pageSections: window.pageSections || [], pageTheme: window.pageTheme || {} }; }
    });
    app.component('page-renderer', PageRenderer);
    app.mount('#app');

    ${navScript}
    ${motionScript}
  </script>
</body>
</html>`;
}

function render(pageSchema, options = {}) {
  const brief = isObject(options.brief) ? options.brief : {};
  const designProfile = isObject(options.design) ? options.design : null;
  const assetPrefix = toStringSafe(options.assetPrefix || './');
  const design = resolveDesign(brief, designProfile);

  // Support scene-based schema (new pipeline) and flat sections array (legacy)
  let sections;
  if (isObject(pageSchema) && Array.isArray(pageSchema.scenes)) {
    // Scene-based schema from scene-composer
    sections = normalizeScenesInput(pageSchema, brief);
  } else {
    sections = normalizeSections(pageSchema);
  }

  // Attach local proof data to sections that need it
  const localProof = options.localProof || null;
  if (localProof) {
    for (const section of sections) {
      if (section.type === 'trust-strip' || section.type === 'local-proof') {
        section.props = Object.assign({}, section.props, { _localProof: localProof });
      }
      if (section.type === 'reviews' && !section.props.reviews) {
        section.props = Object.assign({}, section.props, { reviews: localProof.reviews, _localProof: localProof });
      }
    }
  }

  const title = findTitleFromSchema(sections, brief);
  const schemaJson = JSON.stringify(sections, null, 2);
  return renderHtmlDocument({ title, schemaJson, assetPrefix, brief, sections, design, localProof, options });
}

module.exports = { render };
