// components/registry.js
// LEGACY COMPATIBILITY SHIM — do not add new component registrations here.
//
// The canonical registry is src/components/registry.js.
// This file exists only for backward compatibility with index.html and page-builder.
// It re-exports window.SectionRegistry if already populated by the canonical registry.
//
// If window.SectionRegistry is not yet populated (standalone/dev contexts),
// it builds a minimal registry from available globals so that page-renderer
// does not break. New section types must be added to src/components/registry.js only.

(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  // If the canonical registry already ran, just expose it and exit.
  if (window.SectionRegistry && Object.keys(window.SectionRegistry).length > 0) {
    return;
  }

  // Fallback: build a minimal registry from available globals.
  var registry = {};
  var entries = [
    ['hero',                   'HeroSection'],
    ['features',               'FeaturesSection'],
    ['pricing',                'PricingSection'],
    ['faq',                    'FAQSection'],
    ['cta',                    'CTASection'],
    ['testimonials',           'TestimonialsSection'],
    ['how-it-works',           'HowItWorksSection'],
    ['footer',                 'FooterSection'],
    ['missing-opportunities',  'MissingOpportunitiesSection'],
    ['services-grid',          'ServicesGridSection'],
    ['virtual-front-desk',     'VirtualFrontDeskSection'],
    ['chat-demo',              'ChatDemoSection'],
    ['reviews',                'ReviewsSection'],
    ['insurance-info',         'InsuranceInfoSection']
  ];

  for (var i = 0; i < entries.length; i++) {
    var type = entries[i][0];
    var globalName = entries[i][1];
    try {
      var comp = window[globalName];
      if (comp != null) registry[type] = comp;
    } catch (e) {}
  }

  window.SectionRegistry = registry;
})();
