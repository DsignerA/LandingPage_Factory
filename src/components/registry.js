// src/components/registry.js
// CANONICAL SectionRegistry — single source of truth for all section type → component mappings.
//
// Architecture decision:
// - src/components/ is the authoritative component directory.
// - components/ (root) contains shared/generic components (hero, features, pricing, etc.).
// - This registry merges both, with src/components/ taking precedence for overlapping types.
// - The render-engine loads THIS file, not components/registry.js.
// - components/registry.js is kept for backward compatibility with index.html / page-builder,
//   but it now delegates to this registry.
//
// Load order in the HTML shell (enforced by render-engine.js):
//   1. src/components/*.js   (dentist-specific and shared overrides)
//   2. components/*.js       (generic shared components)
//   3. src/ui/*.js           (template overrides applied after component definitions)
//   4. src/components/registry.js  ← this file
//   5. components/page-renderer.js
//
// Silent clobber prevention:
// - If a type is already registered and the new value is null/undefined, the existing
//   registration is preserved. This prevents UI template overrides from wiping entries.

(function () {
  'use strict';

  function safeGet(name) {
    try {
      if (typeof window !== 'undefined' && window[name] != null) return window[name];
      if (typeof globalThis !== 'undefined' && globalThis[name] != null) return globalThis[name];
    } catch (e) {}
    return null;
  }

  // Build the registry. Entries are evaluated lazily at registration time so
  // that script load order does not matter as long as this file runs last.
  var registry = {};

  function register(type, globalName) {
    var comp = safeGet(globalName);
    if (comp != null) {
      registry[type] = comp;
    } else if (registry[type] == null) {
      // Leave a null sentinel so callers know the type is known but unresolved
      registry[type] = null;
      try {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[Registry] Component not found for type "' + type + '" (global: ' + globalName + ')');
        }
      } catch (e) {}
    }
    // If comp is null but registry[type] already has a value, preserve the existing registration.
  }

  // ── Shared / generic sections (from components/) ──────────────────────────
  register('hero',           'HeroSection');
  register('features',       'FeaturesSection');
  register('pricing',        'PricingSection');
  register('faq',            'FAQSection');
  register('cta',            'CTASection');
  register('testimonials',   'TestimonialsSection');
  register('how-it-works',   'HowItWorksSection');
  register('footer',         'FooterSection');

  // ── Pipeline-generated section types ────────────────────────────────────────
  register('trust-strip',            'TrustStripSection');

  // ── Niche-specific sections (from src/components/) ────────────────────────
  register('missing-opportunities', 'MissingOpportunitiesSection');
  register('services-grid',         'ServicesGridSection');
  register('virtual-front-desk',    'VirtualFrontDeskSection');
  register('chat-demo',             'ChatDemoSection');
  register('reviews',               'ReviewsSection');
  register('insurance-info',        'InsuranceInfoSection');

  // ── Upgrade model sections ────────────────────────────────────────────────
  register('trust-signals',  'TrustSignalsSection');
  register('upgrade-signal', 'UpgradeSignalSection');

  // Expose globally
  if (typeof window !== 'undefined') {
    window.SectionRegistry = registry;
  } else if (typeof globalThis !== 'undefined') {
    globalThis.SectionRegistry = registry;
  }
})();
