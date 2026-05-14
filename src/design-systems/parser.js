'use strict';

/**
 * src/design-systems/parser.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Load and parse vendored DESIGN.md design-system specs (one per subdirectory)
 * into a programmable shape that the renderer can consume.
 *
 * Each DESIGN.md is prose — descriptive, not strict. We extract:
 *   - title              (first H1)
 *   - category           (the "> Category: ..." blockquote)
 *   - paletteHex[]       (hex codes in source order; the first ones tend to be
 *                         background + primary because the authors describe
 *                         the "canvas + accent" first)
 *   - heading / body     (first font family mentioned after a typography heading)
 *   - body               (the full prose, for LLM consumption)
 *
 * Returns a single helper, `loadDesignSystem(name)`, plus a `listDesignSystems()`
 * for niche packs / variation pools.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

/**
 * List every available design system slug (subdirectory containing DESIGN.md).
 * Sorted alphabetically.
 */
function listDesignSystems() {
  try {
    return fs.readdirSync(ROOT, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(name => name !== '_schema' && name !== 'node_modules')
      .filter(name => fs.existsSync(path.join(ROOT, name, 'DESIGN.md')))
      .sort();
  } catch (e) {
    return [];
  }
}

function extractTitle(body) {
  const m = body.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : '';
}

function extractCategory(body) {
  const m = body.match(/^>\s*Category:\s*(.+?)\s*$/im);
  return m ? m[1].trim() : '';
}

function extractHexColors(body) {
  // Collect unique hex codes in source order; #fff is too short to be a brand
  // signal so we only keep 6-digit hex.
  const all = body.match(/#[0-9a-fA-F]{6}\b/g) || [];
  const seen = new Set();
  const ordered = [];
  for (const h of all) {
    const lower = h.toLowerCase();
    if (!seen.has(lower)) { seen.add(lower); ordered.push(lower); }
  }
  return ordered;
}

function extractFonts(body) {
  // DESIGN.md prose tends to call out fonts like:
  //   "custom Anthropic Serif typeface"
  //   "Inter Display"
  //   "JetBrains Mono"
  // We approximate by pulling capitalised multi-word phrases adjacent to the
  // word "serif", "sans", "mono", "typeface", or "font".
  const heading = (body.match(/\b([A-Z][\w\-]+(?:\s[A-Z][\w\-]+)*)\s+(?:Serif|Sans|Display|Mono)\b/g) || [])[0] || '';
  const body2   = (body.match(/(?:body|paragraph|reading)\s+(?:font|text|typeface)\s+(?:is\s+)?["']?([A-Z][\w\-]+(?:\s[A-Z][\w\-]+)*)/gi) || [])[0] || '';
  return {
    heading: (heading || '').replace(/\s+(Serif|Sans|Display|Mono)$/, '').trim(),
    body:    body2 ? body2.replace(/^.*?["']?/, '').trim() : ''
  };
}

/**
 * Heuristic palette mapping. The author writes prose; we have to guess which
 * hex is "background" vs "primary" vs "accent". Strategy:
 *   - The hex with the highest luminance is bg.
 *   - The most-saturated mid-luminance hex is primary.
 *   - The most-saturated remaining hex is accent.
 *   - The darkest is text.
 */
function rgbOf(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function luminance([r, g, b]) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
function saturation([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}
function pickPalette(hexes) {
  if (!hexes.length) return null;
  const rich = hexes.map(h => {
    const rgb = rgbOf(h);
    return { hex: h, lum: luminance(rgb), sat: saturation(rgb) };
  });
  const bg     = rich.slice().sort((a, b) => b.lum - a.lum)[0].hex;
  const text   = rich.slice().sort((a, b) => a.lum - b.lum)[0].hex;
  const midSat = rich.filter(r => r.lum > 0.15 && r.lum < 0.75)
                     .sort((a, b) => b.sat - a.sat);
  const primary = (midSat[0] && midSat[0].hex) || rich[0].hex;
  const accent  = (midSat[1] && midSat[1].hex) || primary;
  return { bg, primary, accent, text };
}

/**
 * Load one design system by slug. Returns null if missing.
 */
function loadDesignSystem(name) {
  if (!name) return null;
  const file = path.join(ROOT, name, 'DESIGN.md');
  let body;
  try { body = fs.readFileSync(file, 'utf8'); }
  catch (e) { return null; }

  const paletteHex = extractHexColors(body);
  return {
    name,
    title:    extractTitle(body),
    category: extractCategory(body),
    paletteHex,
    palette:  pickPalette(paletteHex),
    fonts:    extractFonts(body),
    body
  };
}

module.exports = { listDesignSystems, loadDesignSystem };
