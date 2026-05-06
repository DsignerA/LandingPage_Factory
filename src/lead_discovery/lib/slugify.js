'use strict';
/**
 * slugify.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Lightweight slug utilities for the lead discovery layer.
 * Mirrors the logic in core/lead-normalizer.js (kept as a standalone copy to
 * avoid a cross-layer dependency from src/lead_discovery into core/).
 */

/**
 * slugify(str) — converts a free-form string to a URL-safe, filesystem-safe slug.
 *
 * "Whole Health Dentistry" → "whole-health-dentistry"
 * "O'Brien & Sons, LLC"    → "o-brien-sons-llc"
 */
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics (é → e, ñ → n, etc.)
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumeric runs → single hyphen
    .replace(/^-+|-+$/g, '')           // trim leading/trailing hyphens
    .slice(0, 80);
}

/**
 * fnv1a32(str) — FNV-1a 32-bit hash, returned as 8-char lowercase hex.
 * Used to generate a short deterministic suffix for slugs.
 */
function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * buildLeadSlug(businessName, city, state)
 * Builds a deterministic, stable slug for a discovered lead.
 * Format: {slugified-name}-{slugified-city}-{state-lower}-{6-char-hash}
 *
 * Example: "Whole Health Dentistry", "Houston", "TX"
 *   → "whole-health-dentistry-houston-tx-f3d661"
 */
function buildLeadSlug(businessName, city, state) {
  const parts = [businessName, city, state].filter(Boolean).join(' ');
  const base  = slugify(parts).slice(0, 60);
  const hash  = fnv1a32(parts.toLowerCase()).slice(0, 6);
  return base ? `${base}-${hash}` : `lead-${hash}`;
}

module.exports = { slugify, fnv1a32, buildLeadSlug };
