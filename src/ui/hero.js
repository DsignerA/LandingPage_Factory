// src/ui/hero.js
// Hero section — 5 layout variants driven by window.pageTheme.heroVariant
//
// Variants:
//   split_premium        – headline left, floating card right (healthcare/professional)
//   centered             – large centered headline, single CTA (professional, general)
//   media_background     – full gradient background, overlay content (restaurant, ecommerce)
//   service_quote_split  – headline left, inline quote form card right (home service)
//   centered_product     – centered headline, product highlights below (B2B SaaS)
//   product_demo         – centered headline, demo CTA, feature pills (B2B SaaS demo goal)
//
// All styling uses CSS variables from the design token system (--ds-*).
// Scroll-reveal is applied via .fade-up class.

(function () {
  'use strict';

  function getHeroVariant() {
    try {
      var theme = window.pageTheme || {};
      var v = String(theme.heroVariant || '').toLowerCase();
      var valid = ['split_premium','centered','media_background','service_quote_split','centered_product','product_demo'];
      if (valid.indexOf(v) !== -1) return v;
    } catch (e) {}
    return 'split_premium';
  }

  function getBgClass() {
    try {
      var effect = (window.pageTheme || {}).backgroundEffect || 'soft_gradient';
      if (effect === 'radial_mesh') return 'bg-radial-mesh';
      if (effect === 'soft_gradient') return 'bg-soft-gradient';
    } catch (e) {}
    return '';
  }

  // ── Variant templates ───────────────────────────────────────────────────────

  var SPLIT_PREMIUM = `
    <section class="ds-section" :id="sectionId">
      <div class="ds-container" style="display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center">
        <div>
          <div v-if="label" class="ds-label" data-hero-reveal="1" style="margin-bottom:0.75rem">{{ label }}</div>
          <h1 class="ds-hero-heading" data-hero-reveal="2" style="margin-bottom:1rem">{{ title }}</h1>
          <p v-if="subtitle" class="ds-subheading" data-hero-reveal="3" style="margin-bottom:2rem;max-width:36rem">{{ subtitle }}</p>
          <div data-hero-reveal="4" style="display:flex;gap:1rem;flex-wrap:wrap">
            <a :href="primaryCta.href || '#cta'" class="ds-btn-primary">{{ primaryCta.label }}</a>
            <a v-if="secondaryCta" :href="secondaryCta.href || '#'" class="ds-btn-outline">{{ secondaryCta.label }}</a>
          </div>
          <div v-if="trustProps && trustProps.length" data-hero-reveal="5" style="display:flex;flex-wrap:wrap;gap:1rem;margin-top:2rem">
            <div v-for="tp in trustProps" :key="tp" style="display:flex;align-items:center;gap:0.375rem;font-size:0.875rem;color:var(--ds-text-muted)">
              <span style="color:var(--ds-primary)">✓</span>{{ tp }}
            </div>
          </div>
        </div>
        <div data-hero-reveal="6" style="display:flex;justify-content:flex-end">
          <div class="ds-card" style="width:100%;max-width:22rem">
            <div style="font-size:0.9375rem;font-weight:700;color:var(--ds-text);margin-bottom:1rem">{{ cardHeading || 'Get in touch' }}</div>
            <div style="display:grid;gap:0.875rem">
              <input type="text" class="ds-input" placeholder="Your name" aria-label="Name (demo)" />
              <input type="tel" class="ds-input" placeholder="Phone number" aria-label="Phone (demo)" />
              <button type="button" class="ds-btn-primary" style="width:100%;justify-content:center">{{ primaryCta.label }}</button>
            </div>
            <div style="font-size:0.75rem;color:var(--ds-text-muted);margin-top:0.75rem;text-align:center">{{ trustLine }}</div>
          </div>
        </div>
      </div>
    </section>`;

  var CENTERED = `
    <section class="ds-section" :id="sectionId" style="text-align:center">
      <div class="ds-container" style="max-width:52rem;margin:0 auto">
        <div v-if="label" class="ds-label" data-hero-reveal="1" style="margin-bottom:0.75rem">{{ label }}</div>
        <h1 class="ds-hero-heading" data-hero-reveal="2" style="margin-bottom:1.25rem">{{ title }}</h1>
        <p v-if="subtitle" class="ds-subheading" data-hero-reveal="3" style="margin-bottom:2.5rem;max-width:40rem;margin-left:auto;margin-right:auto">{{ subtitle }}</p>
        <div data-hero-reveal="4" style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
          <a :href="primaryCta.href || '#cta'" class="ds-btn-primary" style="font-size:1.0625rem;padding:0.75rem 2rem">{{ primaryCta.label }}</a>
          <a v-if="secondaryCta" :href="secondaryCta.href || '#'" class="ds-btn-ghost" style="font-size:1.0625rem;padding:0.75rem 2rem">{{ secondaryCta.label }}</a>
        </div>
      </div>
    </section>`;

  var MEDIA_BACKGROUND = `
    <section :id="sectionId" :style="heroBgStyle">
      <!-- Dark overlay: always present to improve text legibility -->
      <div style="position:absolute;inset:0;background:rgba(0,0,0,0.32)"></div>
      <div class="ds-container" style="position:relative;z-index:1;text-align:center;color:var(--ds-text-inverse)">
        <div v-if="label" data-hero-reveal="1" style="font-size:0.75rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:1rem">{{ label }}</div>
        <h1 data-hero-reveal="2" style="font-size:var(--ds-type-hero-size);font-weight:var(--ds-type-hero-weight);line-height:var(--ds-type-hero-lh);color:#fff;margin-bottom:1.25rem;max-width:44rem;margin-left:auto;margin-right:auto">{{ title }}</h1>
        <p v-if="subtitle" data-hero-reveal="3" style="font-size:1.125rem;color:rgba(255,255,255,0.85);margin-bottom:2.5rem;max-width:36rem;margin-left:auto;margin-right:auto">{{ subtitle }}</p>
        <div data-hero-reveal="4" style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
          <a :href="primaryCta.href || '#cta'" style="display:inline-flex;align-items:center;padding:0.875rem 2.25rem;border-radius:var(--ds-card-radius);background:#fff;color:var(--ds-primary);font-weight:700;font-size:1rem;text-decoration:none">{{ primaryCta.label }}</a>
          <a v-if="secondaryCta" :href="secondaryCta.href || '#'" style="display:inline-flex;align-items:center;padding:0.875rem 2.25rem;border-radius:var(--ds-card-radius);background:transparent;color:#fff;font-weight:600;font-size:1rem;border:2px solid rgba(255,255,255,0.55);text-decoration:none">{{ secondaryCta.label }}</a>
        </div>
      </div>
    </section>`;

  var SERVICE_QUOTE_SPLIT = `
    <section class="ds-section" :id="sectionId">
      <div class="ds-container" style="display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center">
        <div>
          <div v-if="label" class="ds-label" data-hero-reveal="1" style="margin-bottom:0.75rem">{{ label }}</div>
          <h1 class="ds-hero-heading" data-hero-reveal="2" style="margin-bottom:1rem">{{ title }}</h1>
          <p v-if="subtitle" class="ds-subheading" data-hero-reveal="3" style="margin-bottom:2rem">{{ subtitle }}</p>
          <div v-if="bullets && bullets.length" data-hero-reveal="4" style="display:grid;gap:0.75rem">
            <div v-for="b in bullets" :key="b" style="display:flex;align-items:flex-start;gap:0.625rem">
              <span style="color:var(--ds-accent);font-weight:700;margin-top:0.1rem">✓</span>
              <span style="color:var(--ds-text-muted)">{{ b }}</span>
            </div>
          </div>
        </div>
        <div data-hero-reveal="5">
          <div class="ds-card" style="border-top:3px solid var(--ds-accent)">
            <div style="font-size:1.0625rem;font-weight:700;color:var(--ds-text);margin-bottom:0.25rem">{{ cardHeading || 'Get a Free Quote' }}</div>
            <div style="font-size:0.875rem;color:var(--ds-text-muted);margin-bottom:1.25rem">No obligation. We'll follow up quickly.</div>
            <div style="display:grid;gap:0.875rem">
              <input type="text" class="ds-input" placeholder="Your name" aria-label="Name (demo)" />
              <input type="tel" class="ds-input" placeholder="Phone number" aria-label="Phone (demo)" />
              <textarea rows="3" class="ds-input" placeholder="Describe your project..." aria-label="Project (demo)"></textarea>
              <button type="button" class="ds-btn-primary" style="width:100%;justify-content:center">{{ primaryCta.label }}</button>
            </div>
          </div>
        </div>
      </div>
    </section>`;

  var CENTERED_PRODUCT = `
    <section class="ds-section" :id="sectionId" style="text-align:center">
      <div class="ds-container" style="max-width:56rem;margin:0 auto">
        <div v-if="label" class="ds-label" data-hero-reveal="1" style="margin-bottom:0.75rem">{{ label }}</div>
        <h1 class="ds-hero-heading" data-hero-reveal="2" style="margin-bottom:1.25rem">{{ title }}</h1>
        <p v-if="subtitle" class="ds-subheading" data-hero-reveal="3" style="margin-bottom:2.5rem;max-width:42rem;margin-left:auto;margin-right:auto">{{ subtitle }}</p>
        <div data-hero-reveal="4" style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-bottom:3rem">
          <a :href="primaryCta.href || '#cta'" class="ds-btn-primary" style="font-size:1.0625rem;padding:0.75rem 2rem">{{ primaryCta.label }}</a>
          <a v-if="secondaryCta" :href="secondaryCta.href || '#'" class="ds-btn-outline" style="font-size:1.0625rem;padding:0.75rem 2rem">{{ secondaryCta.label }}</a>
        </div>
        <div v-if="highlights && highlights.length" style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
          <div v-for="(h, i) in highlights" :key="i" class="ds-card" data-hero-reveal="5" style="padding:1rem 1.5rem;min-width:9rem;flex:1;max-width:13rem" :data-stagger-group="'hero-highlights'">
            <div style="font-size:1.375rem;margin-bottom:0.375rem">{{ h.icon || '✦' }}</div>
            <div style="font-weight:600;font-size:0.9375rem;color:var(--ds-text)">{{ h.title }}</div>
            <div v-if="h.description" style="font-size:0.8125rem;color:var(--ds-text-muted);margin-top:0.25rem">{{ h.description }}</div>
          </div>
        </div>
      </div>
    </section>`;

  var PRODUCT_DEMO = `
    <section class="ds-section" :id="sectionId" style="text-align:center">
      <div class="ds-container" style="max-width:52rem;margin:0 auto">
        <div v-if="label" class="ds-label" data-hero-reveal="1" style="margin-bottom:0.75rem">{{ label }}</div>
        <h1 class="ds-hero-heading" data-hero-reveal="2" style="margin-bottom:1.25rem">{{ title }}</h1>
        <p v-if="subtitle" class="ds-subheading" data-hero-reveal="3" style="margin-bottom:2rem;max-width:40rem;margin-left:auto;margin-right:auto">{{ subtitle }}</p>
        <div data-hero-reveal="4" style="margin-bottom:2.5rem">
          <a :href="primaryCta.href || '#contact'" class="ds-btn-primary" style="font-size:1.125rem;padding:0.875rem 2.5rem">{{ primaryCta.label }}</a>
        </div>
        <div v-if="pills && pills.length" data-hero-reveal="5" style="display:flex;gap:0.625rem;justify-content:center;flex-wrap:wrap">
          <span v-for="pill in pills" :key="pill" style="padding:0.375rem 0.875rem;border-radius:9999px;background:var(--ds-primary-light);color:var(--ds-primary);font-size:0.8125rem;font-weight:600">{{ pill }}</span>
        </div>
      </div>
    </section>`;

  // ── Variant map ─────────────────────────────────────────────────────────────

  var VARIANT_MAP = {
    split_premium:       SPLIT_PREMIUM,
    centered:            CENTERED,
    media_background:    MEDIA_BACKGROUND,
    service_quote_split: SERVICE_QUOTE_SPLIT,
    centered_product:    CENTERED_PRODUCT,
    product_demo:        PRODUCT_DEMO
  };

  // ── Component ───────────────────────────────────────────────────────────────

  var activeVariant = getHeroVariant();
  var activeTemplate = VARIANT_MAP[activeVariant] || SPLIT_PREMIUM;

  var HeroSection = {
    name: 'HeroSection',
    props: {
      id: String,
      type: String,
      variant: String,
      props: { type: Object, default: function() { return {}; } },
      design: { type: Object, default: function() { return {}; } }
    },
    computed: {
      sectionId: function() { return this.id || 'hero'; },
      title: function() { return (this.props && this.props.title) || ''; },
      subtitle: function() { return (this.props && this.props.subtitle) || ''; },
      label: function() { return (this.props && this.props.label) || ''; },
      primaryCta: function() { return (this.props && this.props.primaryCta) || { label: 'Get Started', href: '#cta' }; },
      secondaryCta: function() { return (this.props && this.props.secondaryCta) || null; },
      trustProps: function() { return (this.props && this.props.trustProps) || []; },
      highlights: function() { return (this.props && this.props.highlights) || []; },
      pills: function() { return (this.props && this.props.pills) || []; },
      bullets: function() { return (this.props && this.props.bullets) || []; },
      cardHeading: function() { return (this.props && this.props.cardHeading) || ''; },
      trustLine: function() {
        // Prefer an explicit trustLine passed via props. Fallback to a default string.
        return (this.props && this.props.trustLine) || 'No commitment required';
      },
      /**
       * Compute the hero background style for the media_background variant. If a heroImageUrl
       * prop is provided, use it as a full bleed background image. Otherwise use the
       * default gradient based on the design tokens. This allows external Unsplash
       * images (injected via site-brief-builder) to display behind the hero content.
       *
       * We return an object keyed by CSS properties, which Vue will merge into
       * the section's style attribute. Other variants can ignore this value.
       */
      heroBgStyle: function() {
        var url = (this.props && this.props.heroImageUrl) || '';
        var base = {
          position: 'relative',
          minHeight: '82vh',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden'
        };
        if (url) {
          // If an image URL is available, set it as the background image and overlay
          base.backgroundImage = 'url(' + url + ')';
          base.backgroundSize = 'cover';
          base.backgroundPosition = 'center';
          // Darken with a subtle overlay via a pseudo-element; this overlay is handled
          // in the template for the media_background variant
        } else {
          // Default gradient if no image is provided
          base.background = 'linear-gradient(135deg,var(--ds-primary) 0%,var(--ds-secondary,var(--ds-primary)) 100%)';
        }
        return base;
      }
    },
    template: activeTemplate
  };

  if (typeof window !== 'undefined') {
    window.HeroSection = HeroSection;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeroSection;
  }
})();
