// src/ui/features.js
// Features section — 3 layout variants driven by section.variant
//
// Variants:
//   grid_cards    – 3-column card grid with icons (default)
//   icon_features – 2-column icon+text list, compact
//   list_features – single-column numbered list, minimal
//
// All styling uses CSS variables from the design token system (--ds-*).

(function () {
  'use strict';

  var GRID_CARDS = `
    <div class="ds-section fade-up" :id="sectionId" :data-section="sectionId">
      <div class="ds-container">
        <div style="text-align:center;margin-bottom:3rem">
          <div v-if="label" class="ds-label fade-up" style="margin-bottom:0.5rem">{{ label }}</div>
          <h2 class="ds-section-heading fade-up" style="margin-bottom:0.75rem">{{ heading }}</h2>
          <p v-if="subheading" class="ds-subheading fade-up" style="max-width:40rem;margin:0 auto">{{ subheading }}</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:var(--ds-grid-gap)">
          <div v-for="(item, i) in items" :key="i" class="ds-card fade-up" :data-stagger-group="'features'" style="display:flex;flex-direction:column;gap:0.75rem">
            <div style="width:2.5rem;height:2.5rem;border-radius:0.625rem;background:var(--ds-primary-light);display:flex;align-items:center;justify-content:center">
              <span class="ds-icon" style="font-size:1.125rem;color:var(--ds-primary)">{{ item.icon || '✦' }}</span>
            </div>
            <div style="font-weight:700;font-size:1rem;color:var(--ds-text)">{{ item.title }}</div>
            <div v-if="item.description" style="font-size:0.9375rem;color:var(--ds-text-muted);line-height:1.6">{{ item.description }}</div>
          </div>
        </div>
        <!-- Micro CTA: small forward link to encourage visitors to continue engaging -->
        <div style="margin-top:2rem;text-align:center">
          <a href="#cta" style="font-size:0.875rem;color:var(--ds-primary);text-decoration:none">See all services →</a>
        </div>
      </div>
    </div>`;

  var ICON_FEATURES = `
    <div class="ds-section fade-up" :id="sectionId" :data-section="sectionId">
      <div class="ds-container">
        <div style="margin-bottom:2.5rem">
          <div v-if="label" class="ds-label fade-up" style="margin-bottom:0.5rem">{{ label }}</div>
          <h2 class="ds-section-heading fade-up" style="margin-bottom:0.5rem">{{ heading }}</h2>
          <p v-if="subheading" class="ds-subheading fade-up">{{ subheading }}</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(22rem,1fr));gap:1.5rem 3rem">
          <div v-for="(item, i) in items" :key="i" class="fade-up" :data-stagger-group="'features'" style="display:flex;gap:1rem;align-items:flex-start">
            <div style="width:2.25rem;height:2.25rem;border-radius:0.5rem;background:var(--ds-primary-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:0.125rem">
              <span class="ds-icon" style="font-size:1rem;color:var(--ds-primary)">{{ item.icon || '✦' }}</span>
            </div>
            <div>
              <div style="font-weight:700;font-size:0.9375rem;color:var(--ds-text);margin-bottom:0.25rem">{{ item.title }}</div>
              <div v-if="item.description" style="font-size:0.875rem;color:var(--ds-text-muted);line-height:1.6">{{ item.description }}</div>
            </div>
          </div>
        </div>
        <!-- Micro CTA: encourage exploration of the services or next step -->
        <div style="margin-top:2rem;text-align:center">
          <a href="#cta" style="font-size:0.875rem;color:var(--ds-primary);text-decoration:none">See all services →</a>
        </div>
      </div>
    </div>`;

  var LIST_FEATURES = `
    <div class="ds-section fade-up" :id="sectionId" :data-section="sectionId">
      <div class="ds-container" style="max-width:44rem;margin:0 auto">
        <div style="margin-bottom:2rem">
          <div v-if="label" class="ds-label fade-up" style="margin-bottom:0.5rem">{{ label }}</div>
          <h2 class="ds-section-heading fade-up" style="margin-bottom:0.5rem">{{ heading }}</h2>
          <p v-if="subheading" class="ds-subheading fade-up">{{ subheading }}</p>
        </div>
        <div style="display:grid;gap:1.25rem">
          <div v-for="(item, i) in items" :key="i" class="fade-up" :data-stagger-group="'features'" style="display:flex;gap:1rem;align-items:flex-start;padding-bottom:1.25rem;border-bottom:1px solid var(--ds-border)">
            <div style="font-size:1.25rem;font-weight:800;color:var(--ds-primary);min-width:2rem;font-family:var(--ds-font-heading)">{{ String(i + 1).padStart(2, '0') }}</div>
            <div>
              <div style="font-weight:700;font-size:0.9375rem;color:var(--ds-text);margin-bottom:0.25rem">{{ item.title }}</div>
              <div v-if="item.description" style="font-size:0.875rem;color:var(--ds-text-muted);line-height:1.6">{{ item.description }}</div>
            </div>
          </div>
        </div>
        <!-- Micro CTA: encourage exploration of the services or next step -->
        <div style="margin-top:2rem;text-align:center">
          <a href="#cta" style="font-size:0.875rem;color:var(--ds-primary);text-decoration:none">See all services →</a>
        </div>
      </div>
    </div>`;

  var FeaturesSection = {
    name: 'FeaturesSection',
    props: {
      id: String,
      type: String,
      variant: { type: String, default: 'grid_cards' },
      props: { type: Object, default: function() { return {}; } },
      design: { type: Object, default: function() { return {}; } }
    },
    computed: {
      sectionId: function() { return this.id || 'features'; },
      heading: function() { return (this.props && this.props.heading) || 'What We Offer'; },
      subheading: function() { return (this.props && this.props.subheading) || ''; },
      label: function() { return (this.props && this.props.label) || ''; },
      items: function() { return (this.props && Array.isArray(this.props.items)) ? this.props.items : []; },
      activeVariant: function() {
        var v = this.variant;
        if (v === 'icon_features' || v === 'list_features' || v === 'grid_cards') return v;
        return 'grid_cards';
      }
    },
    template: `<component :is="'div'" style="display:contents">
      <template v-if="activeVariant === 'icon_features'">${ICON_FEATURES}</template>
      <template v-else-if="activeVariant === 'list_features'">${LIST_FEATURES}</template>
      <template v-else>${GRID_CARDS}</template>
    </component>`
  };

  if (typeof window !== 'undefined') {
    window.FeaturesSection = FeaturesSection;
    window.UITemplates = window.UITemplates || {};
    window.UITemplates.features = GRID_CARDS;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = FeaturesSection;
})();
