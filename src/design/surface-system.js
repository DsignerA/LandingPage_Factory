'use strict';

// src/design/surface-system.js
// Surface and Spatial Rhythm System
//
// Surfaces define the visual environment of a scene:
//   - background color/gradient
//   - text color
//   - border treatment
//   - card background
//
// Spacing tiers define the vertical rhythm:
//   - airy    → large vertical padding (hero scenes, breathing room)
//   - balanced → standard vertical padding (body sections)
//   - dense   → tight vertical padding (CTAs, trust strips)
//
// This module outputs CSS variable overrides and class strings
// that the render engine injects per-scene.

const SURFACES = {
  'paper': {
    bg: '#ffffff',
    bgGradient: null,
    text: 'var(--ds-text)',
    textMuted: 'var(--ds-text-muted)',
    border: 'var(--ds-border)',
    cardBg: 'var(--ds-surface)',
    cssClass: 'surface-paper'
  },
  'brand-soft': {
    bg: null,
    bgGradient: 'linear-gradient(160deg, var(--ds-primary-light) 0%, #ffffff 60%)',
    text: 'var(--ds-text)',
    textMuted: 'var(--ds-text-muted)',
    border: 'var(--ds-border)',
    cardBg: 'rgba(255,255,255,0.85)',
    cssClass: 'surface-brand-soft'
  },
  'warm-light': {
    bg: '#fefce8',
    bgGradient: null,
    text: 'var(--ds-text)',
    textMuted: 'var(--ds-text-muted)',
    border: '#fde68a',
    cardBg: '#ffffff',
    cssClass: 'surface-warm-light'
  },
  'subtle-gradient': {
    bg: null,
    bgGradient: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
    text: 'var(--ds-text)',
    textMuted: 'var(--ds-text-muted)',
    border: 'var(--ds-border)',
    cardBg: '#ffffff',
    cssClass: 'surface-subtle-gradient'
  },
  'contrast-dark': {
    bg: 'var(--ds-text)',
    bgGradient: null,
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.7)',
    border: 'rgba(255,255,255,0.15)',
    cardBg: 'rgba(255,255,255,0.08)',
    cssClass: 'surface-contrast-dark'
  },
  'brand-strong': {
    bg: 'var(--ds-primary)',
    bgGradient: null,
    text: 'var(--ds-text-inverse)',
    textMuted: 'rgba(255,255,255,0.8)',
    border: 'rgba(255,255,255,0.2)',
    cardBg: 'rgba(255,255,255,0.12)',
    cssClass: 'surface-brand-strong'
  }
};

const DENSITY_TOKENS = {
  airy: {
    paddingY: '5rem',
    paddingYMobile: '3.5rem',
    gap: '2.5rem',
    cssClass: 'density-airy'
  },
  balanced: {
    paddingY: '4rem',
    paddingYMobile: '2.5rem',
    gap: '2rem',
    cssClass: 'density-balanced'
  },
  dense: {
    paddingY: '2.5rem',
    paddingYMobile: '1.75rem',
    gap: '1.25rem',
    cssClass: 'density-dense'
  }
};

/**
 * Resolve surface tokens for a given surface name.
 * Falls back to 'paper' if unknown.
 */
function resolveSurface(surfaceName) {
  return SURFACES[surfaceName] || SURFACES['paper'];
}

/**
 * Resolve density tokens for a given density name.
 * Falls back to 'balanced' if unknown.
 */
function resolveDensity(densityName) {
  return DENSITY_TOKENS[densityName] || DENSITY_TOKENS['balanced'];
}

/**
 * Generate inline CSS style string for a scene wrapper element.
 * @param {string} surfaceName
 * @param {string} densityName
 * @returns {string} CSS style string
 */
function sceneStyle(surfaceName, densityName) {
  const surface = resolveSurface(surfaceName);
  const density = resolveDensity(densityName);

  const bg = surface.bgGradient
    ? `background:${surface.bgGradient};`
    : `background:${surface.bg};`;

  return [
    bg,
    `color:${surface.text};`,
    `padding-top:${density.paddingY};`,
    `padding-bottom:${density.paddingY};`,
    `--scene-text:${surface.text};`,
    `--scene-text-muted:${surface.textMuted};`,
    `--scene-border:${surface.border};`,
    `--scene-card-bg:${surface.cardBg};`,
    `--scene-gap:${density.gap};`
  ].join('');
}

/**
 * Generate the global surface CSS block (injected once into the page head).
 */
function generateSurfaceCSS() {
  const rules = [];

  for (const [name, surface] of Object.entries(SURFACES)) {
    const bg = surface.bgGradient
      ? `background:${surface.bgGradient};`
      : `background:${surface.bg};`;

    rules.push(`.surface-${name.replace('-', '-')} {
  ${bg}
  color:${surface.text};
  --scene-text:${surface.text};
  --scene-text-muted:${surface.textMuted};
  --scene-border:${surface.border};
  --scene-card-bg:${surface.cardBg};
}`);
  }

  for (const [name, density] of Object.entries(DENSITY_TOKENS)) {
    rules.push(`.density-${name} {
  padding-top:${density.paddingY};
  padding-bottom:${density.paddingY};
  --scene-gap:${density.gap};
}`);
  }

  return rules.join('\n');
}

module.exports = {
  SURFACES,
  DENSITY_TOKENS,
  resolveSurface,
  resolveDensity,
  sceneStyle,
  generateSurfaceCSS
};
