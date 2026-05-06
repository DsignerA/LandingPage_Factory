// src/ui/pricing.js
// Pricing section — 2 layout variants
//
// Variants:
//   tiered_cards  – 3-column cards with billing toggle (default, SaaS)
//   simple_tiers  – clean 2-column or single-tier layout (services, home service)
//
// All styling uses CSS variables from the design token system (--ds-*).

(function () {
  'use strict';

  var TIERED_CARDS = `
    <div class="ds-section fade-up" :id="sectionId" :data-section="sectionId">
      <div class="ds-container">
        <div style="text-align:center;margin-bottom:3rem">
          <div v-if="label" class="ds-label fade-up" style="margin-bottom:0.5rem">{{ label }}</div>
          <h2 class="ds-section-heading fade-up" style="margin-bottom:0.75rem">{{ heading }}</h2>
          <p v-if="subheading" class="ds-subheading fade-up" style="max-width:40rem;margin:0 auto;margin-bottom:1.5rem">{{ subheading }}</p>
          <div v-if="hasYearly" style="display:inline-flex;background:var(--ds-surface-alt);border-radius:9999px;padding:0.25rem;gap:0.125rem">
            <button :style="selectedCycle==='monthly' ? 'background:var(--ds-surface);box-shadow:0 1px 4px rgba(0,0,0,0.12);color:var(--ds-text)' : 'background:transparent;color:var(--ds-text-muted)'" style="padding:0.375rem 1rem;border-radius:9999px;font-size:0.875rem;font-weight:500;border:none;cursor:pointer;transition:all 0.2s" @click="selectedCycle='monthly'">Monthly</button>
            <button :style="selectedCycle==='yearly' ? 'background:var(--ds-surface);box-shadow:0 1px 4px rgba(0,0,0,0.12);color:var(--ds-text)' : 'background:transparent;color:var(--ds-text-muted)'" style="padding:0.375rem 1rem;border-radius:9999px;font-size:0.875rem;font-weight:500;border:none;cursor:pointer;transition:all 0.2s" @click="selectedCycle='yearly'">Yearly <span style="color:#16a34a;font-weight:600">-2 mo free</span></button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:var(--ds-grid-gap)">
          <div v-for="(plan, i) in plans" :key="i" class="ds-card fade-up" :data-stagger-group="'pricing'" :style="plan.popular ? 'outline:2px solid var(--ds-primary);outline-offset:2px' : ''">
            <div v-if="plan.popular" style="font-size:0.75rem;font-weight:700;color:var(--ds-primary);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.5rem">Most Popular</div>
            <div style="font-weight:700;font-size:1.125rem;color:var(--ds-text);margin-bottom:0.5rem">{{ plan.name }}</div>
            <div style="margin-bottom:1.25rem">
              <span style="font-size:2.25rem;font-weight:800;color:var(--ds-text);font-family:var(--ds-font-heading)">{{ displayPrice(plan) }}</span>
              <span v-if="displayPrice(plan) !== 'Custom'" style="font-size:0.875rem;color:var(--ds-text-muted)">/mo</span>
              <div v-if="selectedCycle==='yearly' && plan.yearly" style="font-size:0.8125rem;color:var(--ds-text-muted);margin-top:0.25rem">Billed annually</div>
            </div>
            <ul style="display:grid;gap:0.625rem;margin-bottom:1.5rem;flex:1">
              <li v-for="(f, fi) in plan.features" :key="fi" style="display:flex;align-items:flex-start;gap:0.5rem;font-size:0.875rem;color:var(--ds-text-muted)">
                <span style="color:#16a34a;font-weight:700;margin-top:0.1rem">✓</span><span>{{ f }}</span>
              </li>
            </ul>
            <a :href="(plan.cta && plan.cta.href) || '#cta'" class="ds-btn-primary" :style="plan.popular ? '' : 'background:transparent;color:var(--ds-primary);border:2px solid var(--ds-primary)'" style="width:100%;justify-content:center">{{ (plan.cta && plan.cta.label) || 'Get Started' }}</a>
          </div>
        </div>
      </div>
    </div>`;

  var SIMPLE_TIERS = `
    <div class="ds-section fade-up" :id="sectionId" :data-section="sectionId">
      <div class="ds-container" style="max-width:52rem;margin:0 auto">
        <div style="margin-bottom:2.5rem">
          <div v-if="label" class="ds-label fade-up" style="margin-bottom:0.5rem">{{ label }}</div>
          <h2 class="ds-section-heading fade-up" style="margin-bottom:0.5rem">{{ heading }}</h2>
          <p v-if="subheading" class="ds-subheading fade-up">{{ subheading }}</p>
        </div>
        <div style="display:grid;gap:1.25rem">
          <div v-for="(plan, i) in plans" :key="i" class="ds-card fade-up" :data-stagger-group="'pricing'" style="display:flex;align-items:center;justify-content:space-between;gap:2rem;flex-wrap:wrap">
            <div style="flex:1">
              <div style="font-weight:700;font-size:1rem;color:var(--ds-text);margin-bottom:0.25rem">{{ plan.name }}</div>
              <ul style="display:flex;flex-wrap:wrap;gap:0.5rem 1.25rem">
                <li v-for="(f, fi) in plan.features" :key="fi" style="display:flex;align-items:center;gap:0.375rem;font-size:0.8125rem;color:var(--ds-text-muted)">
                  <span style="color:#16a34a">✓</span>{{ f }}
                </li>
              </ul>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:1.75rem;font-weight:800;color:var(--ds-text);font-family:var(--ds-font-heading)">{{ displayPrice(plan) }}</div>
              <a :href="(plan.cta && plan.cta.href) || '#cta'" class="ds-btn-primary" style="margin-top:0.75rem;font-size:0.875rem;padding:0.5rem 1.25rem">{{ (plan.cta && plan.cta.label) || 'Get Started' }}</a>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  var PricingSection = {
    name: 'PricingSection',
    props: {
      id: String,
      type: String,
      variant: { type: String, default: 'tiered_cards' },
      props: { type: Object, default: function() { return {}; } },
      design: { type: Object, default: function() { return {}; } }
    },
    data: function() { return { selectedCycle: 'monthly' }; },
    computed: {
      sectionId: function() { return this.id || 'pricing'; },
      heading: function() { return (this.props && this.props.heading) || 'Simple, Transparent Pricing'; },
      subheading: function() { return (this.props && this.props.subheading) || ''; },
      label: function() { return (this.props && this.props.label) || ''; },
      plans: function() { return (this.props && Array.isArray(this.props.plans)) ? this.props.plans : []; },
      hasYearly: function() { return this.plans.some(function(p) { return p.yearly; }); },
      activeVariant: function() { return this.variant === 'simple_tiers' ? 'simple_tiers' : 'tiered_cards'; }
    },
    methods: {
      displayPrice: function(plan) {
        if (!plan) return '';
        if (this.selectedCycle === 'yearly' && plan.yearly) return '$' + plan.yearly;
        if (plan.monthly) return '$' + plan.monthly;
        if (plan.price) return plan.price;
        return 'Custom';
      }
    },
    template: `<component :is="'div'" style="display:contents">
      <template v-if="activeVariant === 'simple_tiers'">${SIMPLE_TIERS}</template>
      <template v-else>${TIERED_CARDS}</template>
    </component>`
  };

  if (typeof window !== 'undefined') {
    window.PricingSection = PricingSection;
    window.UITemplates = window.UITemplates || {};
    window.UITemplates.pricing = TIERED_CARDS;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = PricingSection;
})();
