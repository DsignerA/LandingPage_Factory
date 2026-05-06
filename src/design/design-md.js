'use strict';

// src/design/design-md.js
// DESIGN.md serializer — converts an internal design profile (or a niche pack)
// into a DESIGN.md document conforming to the @google/design.md spec.
//
// The factory remains the source of truth for what UI is rendered. This module
// only describes that decision in DESIGN.md form so it can be inspected,
// linted, and diffed.

const PALETTES = require('./palettes');
const TYPOGRAPHY = require('./typography');
const LAYOUT = require('./layout');

// ─── YAML helpers ─────────────────────────────────────────────────────────────
//
// We emit a very small subset of YAML: nested maps of scalars. Every scalar is
// double-quoted so we never have to worry about colons, hashes, or token-ref
// braces being interpreted by the YAML parser.

function quote(s) {
  const str = String(s);
  return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function emitYamlBlock(map, indent) {
  const pad = ' '.repeat(indent);
  const lines = [];
  for (const [key, value] of Object.entries(map)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${pad}${key}:`);
      lines.push(emitYamlBlock(value, indent + 2));
    } else {
      lines.push(`${pad}${key}: ${quote(value)}`);
    }
  }
  return lines.join('\n');
}

// ─── Color / typography / layout normalization ────────────────────────────────
//
// Internal palettes use camelCase keys (primaryHover). DESIGN.md tokens are
// kebab-case by convention. We rename for readability but keep the values.

const COLOR_KEY_RENAMES = {
  bg:           'background',
  surface:      'surface',
  surfaceAlt:   'surface-alt',
  primary:      'primary',
  primaryHover: 'primary-hover',
  primaryLight: 'primary-light',
  primaryRing:  'primary-ring',
  secondary:    'secondary',
  accent:       'accent',
  border:       'border',
  text:         'on-surface',
  textMuted:    'on-surface-muted',
  textInverse:  'on-primary'
};

function buildColors(paletteTokens) {
  if (!paletteTokens) return {};
  const out = {};
  for (const [key, value] of Object.entries(paletteTokens)) {
    const renamed = COLOR_KEY_RENAMES[key] || key;
    out[renamed] = value;
  }
  return out;
}

const TYPOGRAPHY_ROLES = [
  'Display', 'Hero', 'SectionHeading', 'Subheading',
  'BodyLarge', 'Body', 'Caption', 'Label'
];
const HEADING_ROLES = new Set(['Display', 'Hero', 'SectionHeading', 'Subheading']);

function kebab(role) {
  return role.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// design.md requires dimensions to carry a unit. Our internal data sometimes
// uses the bare string '0' for letterSpacing; coerce to '0em'.
function normalizeDimension(value) {
  if (value == null) return value;
  const str = String(value).trim();
  if (str === '0') return '0em';
  return str;
}

function buildTypography(typographyTokens) {
  if (!typographyTokens) return {};
  const out = {};
  for (const role of TYPOGRAPHY_ROLES) {
    const r = typographyTokens[role];
    if (!r) continue;
    const family = HEADING_ROLES.has(role)
      ? typographyTokens.fontFamilyHeading
      : typographyTokens.fontFamilyBody;
    const entry = {};
    if (family) entry.fontFamily = family;
    if (r.size)          entry.fontSize = normalizeDimension(r.size);
    if (r.weight)        entry.fontWeight = r.weight;
    if (r.lineHeight)    entry.lineHeight = r.lineHeight;
    if (r.letterSpacing) entry.letterSpacing = normalizeDimension(r.letterSpacing);
    out[kebab(role)] = entry;
  }
  return out;
}

function buildRounded(layoutTokens) {
  if (!layoutTokens) return {};
  const radius = layoutTokens.cardRadius;
  if (!radius) return {};
  // We only have one radius value in our layout system; emit `md` and derive
  // sm/lg by simple proportions so the design.md scale is populated.
  const num = parseFloat(radius);
  const unit = String(radius).replace(/^[\d.]+/, '') || 'px';
  if (!Number.isFinite(num)) return { md: radius };
  return {
    sm: `${Math.max(2, Math.round(num / 2))}${unit}`,
    md: radius,
    lg: `${Math.round(num * 1.5)}${unit}`
  };
}

function buildSpacing(layoutTokens) {
  if (!layoutTokens) return {};
  const out = {};
  if (layoutTokens.innerSpacing)          out.sm  = layoutTokens.innerSpacing;
  if (layoutTokens.gridGap)               out.md  = layoutTokens.gridGap;
  if (layoutTokens.cardPadding)           out.lg  = layoutTokens.cardPadding;
  if (layoutTokens.sectionPaddingMobile)  out.xl  = layoutTokens.sectionPaddingMobile;
  if (layoutTokens.sectionPaddingDesktop) out.xxl = layoutTokens.sectionPaddingDesktop;
  return out;
}

// Component definitions ensure primary tokens are referenced (avoiding the
// `orphaned-tokens` warning) and provide consumers with concrete usage hints.
function buildComponents(colors, layoutTokens) {
  const components = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(colors, k);
  const innerPad = (layoutTokens && layoutTokens.innerSpacing) || '16px';
  const cardPad  = (layoutTokens && layoutTokens.cardPadding)  || '24px';

  if (has('primary') && has('on-primary')) {
    components['button-primary'] = {
      backgroundColor: '{colors.primary}',
      textColor:       '{colors.on-primary}',
      rounded:         '{rounded.md}',
      padding:         innerPad
    };
  }
  if (has('primary-hover')) {
    components['button-primary-hover'] = {
      backgroundColor: '{colors.primary-hover}'
    };
  }
  if (has('secondary') && has('on-primary')) {
    components['button-secondary'] = {
      backgroundColor: '{colors.secondary}',
      textColor:       '{colors.on-primary}',
      rounded:         '{rounded.md}',
      padding:         innerPad
    };
  }
  if (has('surface') && has('on-surface')) {
    components['card'] = {
      backgroundColor: '{colors.surface}',
      textColor:       '{colors.on-surface}',
      rounded:         '{rounded.md}',
      padding:         cardPad
    };
  }
  if (has('surface-alt') && has('on-surface')) {
    components['surface-alt'] = {
      backgroundColor: '{colors.surface-alt}',
      textColor:       '{colors.on-surface}',
      padding:         cardPad
    };
  }
  if (has('background') && has('on-surface')) {
    components['page'] = {
      backgroundColor: '{colors.background}',
      textColor:       '{colors.on-surface}'
    };
  }
  if (has('primary-light') && has('on-surface')) {
    components['badge'] = {
      backgroundColor: '{colors.primary-light}',
      textColor:       '{colors.on-surface}',
      rounded:         '{rounded.sm}',
      padding:         '8px'
    };
  }
  if (has('on-surface-muted')) {
    components['caption'] = {
      textColor: '{colors.on-surface-muted}'
    };
  }
  if (has('surface') && has('border') && has('primary-ring')) {
    components['input'] = {
      backgroundColor: '{colors.surface}',
      textColor:       '{colors.on-surface}',
      rounded:         '{rounded.md}',
      padding:         innerPad
    };
    components['input-focus'] = {
      backgroundColor: '{colors.surface}',
      rounded:         '{rounded.md}'
    };
    components['divider'] = {
      backgroundColor: '{colors.border}'
    };
  }
  if (has('accent')) {
    components['accent-marker'] = {
      backgroundColor: '{colors.accent}'
    };
  }
  return components;
}

// ─── Prose helpers ────────────────────────────────────────────────────────────

function colorsProse(colors) {
  const lines = ['## Colors', '', 'The palette is generated by the design director and represents the niche-aware brand identity for this page.', ''];
  const order = ['primary', 'primary-hover', 'secondary', 'accent', 'background', 'surface', 'surface-alt', 'border', 'on-surface', 'on-surface-muted', 'on-primary'];
  for (const key of order) {
    if (colors[key]) lines.push(`- **${key} (${colors[key]}):** semantic role applied across components.`);
  }
  lines.push('');
  return lines.join('\n');
}

function layoutProse(layoutTokens) {
  if (!layoutTokens) return '';
  const lines = ['## Layout', ''];
  if (layoutTokens.containerMaxWidth)     lines.push(`- **Container max width:** ${layoutTokens.containerMaxWidth}`);
  if (layoutTokens.sectionPaddingDesktop) lines.push(`- **Section padding (desktop):** ${layoutTokens.sectionPaddingDesktop}`);
  if (layoutTokens.sectionPaddingMobile)  lines.push(`- **Section padding (mobile):** ${layoutTokens.sectionPaddingMobile}`);
  if (layoutTokens.gridGap)               lines.push(`- **Grid gap:** ${layoutTokens.gridGap}`);
  if (layoutTokens.cardPadding)           lines.push(`- **Card padding:** ${layoutTokens.cardPadding}`);
  lines.push('');
  return lines.join('\n');
}

function elevationProse(layoutTokens) {
  if (!layoutTokens) return '';
  const lines = ['## Elevation & Depth', ''];
  if (layoutTokens.cardShadow)      lines.push(`- **Card shadow:** ${layoutTokens.cardShadow}`);
  if (layoutTokens.cardShadowHover) lines.push(`- **Card shadow on hover:** ${layoutTokens.cardShadowHover}`);
  if (layoutTokens.cardBorder)      lines.push(`- **Card border:** ${layoutTokens.cardBorder}`);
  lines.push('');
  return lines.join('\n');
}

function shapesProse(layoutTokens) {
  if (!layoutTokens || !layoutTokens.cardRadius) return '';
  return `## Shapes\n\nCorner radii follow a single base of \`${layoutTokens.cardRadius}\`. Smaller controls round to roughly half that; larger surfaces round to roughly 1.5x.\n`;
}

function componentsProse() {
  return [
    '## Components',
    '',
    '- **button-primary:** brand-driven CTA. Tertiary state is reserved for primary conversion only.',
    '- **button-primary-hover:** uses the darker primary tint to signal interaction.',
    '- **card:** neutral surface used for services, reviews, FAQs, pricing tiers.',
    ''
  ].join('\n');
}

function dosProse() {
  return [
    "## Do's and Don'ts",
    '',
    '- **Do** keep the primary color reserved for conversion-driving CTAs.',
    '- **Do** maintain the niche-defined motion profile across all interactive elements.',
    "- **Don't** introduce a second accent color without updating the niche pack DESIGN.md.",
    "- **Don't** mix multiple background effects on the same page.",
    ''
  ].join('\n');
}

// ─── Top-level builders ───────────────────────────────────────────────────────

/**
 * Build a DESIGN.md string from a fully resolved design profile (the object
 * returned by design-director.directDesign).
 *
 * @param {object} design  Resolved design profile.
 * @param {object} [opts]  { name, description, brief }
 * @returns {string} DESIGN.md content.
 */
function fromDesignProfile(design, opts) {
  const options = opts || {};
  const brief = options.brief || {};
  const colors      = buildColors(design && design.paletteTokens);
  const typography  = buildTypography(design && design.typographyTokens);
  const rounded     = buildRounded(design && design.layoutTokens);
  const spacing     = buildSpacing(design && design.layoutTokens);
  const components  = buildComponents(colors, design && design.layoutTokens);

  const name = options.name
    || (brief.brand && brief.brand.name)
    || (design && design.profile)
    || 'Generated Page';

  const description = options.description
    || `Auto-generated design system for ${name} (profile: ${design && design.profile || 'general'}, palette: ${design && design.palette || ''}, typography: ${design && design.typography || ''}).`;

  return assembleDocument({
    name,
    description,
    overview: overviewProse(design, brief),
    colors,
    typography,
    rounded,
    spacing,
    components,
    layoutTokens: design && design.layoutTokens
  });
}

/**
 * Build a DESIGN.md string for a niche pack — the base identity that
 * leads in this niche extend at generation time.
 *
 * @param {string} nicheCategory  e.g. 'healthcare_local'
 * @param {object} pack           Niche pack ({ config, intents, ... })
 * @param {object} [opts]         { paletteKey, typographyKey, layoutKey }
 * @returns {string}
 */
function fromNichePack(nicheCategory, pack, opts) {
  const options = opts || {};
  const cfg = (pack && pack.config) || {};
  const paletteKey    = options.paletteKey    || pickFirst(options.paletteCandidates);
  const typographyKey = options.typographyKey || 'clean_system';
  const layoutKey     = options.layoutKey     || 'balanced';

  const paletteTokens    = PALETTES[paletteKey];
  const typographyTokens = TYPOGRAPHY[typographyKey];
  const layoutTokens     = LAYOUT[layoutKey];

  const colors      = buildColors(paletteTokens);
  const typography  = buildTypography(typographyTokens);
  const rounded     = buildRounded(layoutTokens);
  const spacing     = buildSpacing(layoutTokens);
  const components  = buildComponents(colors, layoutTokens);

  const name = options.name || cfg.label || nicheCategory;
  const description = options.description
    || `Base DESIGN.md for the ${nicheCategory} niche pack. Defines the canonical palette, typography, layout, and component tokens that lead-specific previews extend.`;

  return assembleDocument({
    name,
    description,
    overview: nicheOverviewProse(nicheCategory, cfg, paletteKey, typographyKey, layoutKey),
    colors,
    typography,
    rounded,
    spacing,
    components,
    layoutTokens
  });
}

function pickFirst(candidates) {
  if (!Array.isArray(candidates)) return null;
  for (const k of candidates) { if (PALETTES[k]) return k; }
  return null;
}

function overviewProse(design, brief) {
  const profile = (design && design.profile) || 'general';
  const niche = (brief && brief.niche) || 'this business';
  return [
    '## Overview',
    '',
    `Profile: **${profile}** for ${niche}. The render pipeline picks every token deterministically from the slug hash so re-runs are reproducible.`,
    '',
    `- Hero variant: \`${design && design.heroVariant}\``,
    `- Card style: \`${design && design.cardStyle}\``,
    `- Section density: \`${design && design.sectionDensity}\``,
    `- Motion profile: \`${design && design.motionProfile}\``,
    `- Background effect: \`${design && design.backgroundEffect}\``,
    `- Accent style: \`${design && design.accentStyle}\``,
    ''
  ].join('\n');
}

function nicheOverviewProse(nicheCategory, cfg, paletteKey, typographyKey, layoutKey) {
  return [
    '## Overview',
    '',
    `Canonical visual identity for the **${cfg.label || nicheCategory}** niche pack.`,
    '',
    `- Niche category: \`${nicheCategory}\``,
    `- Tone: \`${cfg.tone || 'n/a'}\``,
    `- Primary goal: \`${cfg.primaryGoal || 'n/a'}\``,
    `- Default palette key: \`${paletteKey}\``,
    `- Default typography key: \`${typographyKey}\``,
    `- Default layout key: \`${layoutKey}\``,
    '',
    'Per-lead previews extend this base with slug-hashed variant selections.',
    ''
  ].join('\n');
}

function assembleDocument({ name, description, overview, colors, typography, rounded, spacing, components, layoutTokens }) {
  const frontMatter = {
    version: 'alpha',
    name,
    description
  };
  if (Object.keys(colors).length)     frontMatter.colors = colors;
  if (Object.keys(typography).length) frontMatter.typography = typography;
  if (Object.keys(rounded).length)    frontMatter.rounded = rounded;
  if (Object.keys(spacing).length)    frontMatter.spacing = spacing;
  if (Object.keys(components).length) frontMatter.components = components;

  const body = [
    overview,
    colorsProse(colors),
    typographyProseFromTokens(frontMatter.typography),
    layoutProse(layoutTokens),
    elevationProse(layoutTokens),
    shapesProse(layoutTokens),
    componentsProse(),
    dosProse()
  ].filter(Boolean).join('\n');

  return [
    '---',
    emitYamlBlock(frontMatter, 0),
    '---',
    '',
    body
  ].join('\n');
}

// Helper: typography prose using the already-emitted typography block.
function typographyProseFromTokens(typography) {
  if (!typography || Object.keys(typography).length === 0) return '';
  const families = new Set();
  for (const v of Object.values(typography)) {
    if (v && v.fontFamily) families.add(v.fontFamily);
  }
  const lines = ['## Typography', ''];
  for (const fam of families) lines.push(`- ${fam}`);
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  fromDesignProfile,
  fromNichePack
};
