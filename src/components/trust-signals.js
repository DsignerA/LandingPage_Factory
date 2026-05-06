// src/components/trust-signals.js
// Step 4 — Trust Signals section
// Displays ratings, review count, certifications, and social proof badges
// prominently near the top of the page to reduce visitor anxiety.
const TrustSignalsSection = {
  props: {
    rating:       { type: Number, default: null },
    reviewCount:  { type: Number, default: null },
    businessName: { type: String, default: '' },
    location:     { type: String, default: '' },
    phone:        { type: String, default: '' },
    badges:       { type: Array,  default: () => [] },
    googleMapsUrl:{ type: String, default: '' },
    props:        { type: Object, default: () => ({}) }
  },
  computed: {
    r()    { return (this.props && this.props.rating      != null) ? this.props.rating      : this.rating; },
    rc()   { return (this.props && this.props.reviewCount != null) ? this.props.reviewCount : this.reviewCount; },
    name() { return (this.props && this.props.businessName) || this.businessName || ''; },
    loc()  { return (this.props && this.props.location)     || this.location     || ''; },
    ph()   { return (this.props && this.props.phone)        || this.phone        || ''; },
    gUrl() { return (this.props && this.props.googleMapsUrl)|| this.googleMapsUrl|| ''; },
    resolvedBadges() {
      const raw = (this.props && Array.isArray(this.props.badges)) ? this.props.badges : (Array.isArray(this.badges) ? this.badges : []);
      return raw.length ? raw : ['Licensed & Insured', 'Accepting New Patients', 'Same-Day Appointments'];
    },
    stars() {
      if (!this.r) return '';
      const full = Math.floor(this.r);
      const half = (this.r - full) >= 0.5 ? 1 : 0;
      return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
    },
    ratingDisplay() {
      if (!this.r) return '';
      return this.r.toFixed(1);
    },
    reviewDisplay() {
      if (!this.rc) return '';
      return this.rc >= 1000 ? (this.rc / 1000).toFixed(1) + 'k' : String(this.rc);
    }
  },
  template: `
<section id="trust-signals" style="background:var(--ds-surface);border-bottom:1px solid var(--ds-border);padding:1.5rem 1.5rem">
  <div class="ds-container" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:1.5rem 2.5rem">
    <!-- Rating badge -->
    <div v-if="r" style="display:flex;align-items:center;gap:0.625rem">
      <span style="color:#f59e0b;font-size:1.125rem;letter-spacing:-0.02em">{{ stars }}</span>
      <div>
        <span style="font-weight:700;font-size:1rem;color:var(--ds-text)">{{ ratingDisplay }}</span>
        <span style="color:var(--ds-text-muted);font-size:0.875rem"> / 5</span>
        <span v-if="rc" style="color:var(--ds-text-muted);font-size:0.8125rem;margin-left:0.25rem">({{ reviewDisplay }} reviews)</span>
      </div>
    </div>
    <!-- Phone -->
    <div v-if="ph" style="display:flex;align-items:center;gap:0.5rem">
      <span style="color:var(--ds-primary);font-size:1rem">📞</span>
      <a :href="'tel:'+ph" style="font-weight:600;font-size:0.9375rem;color:var(--ds-text);text-decoration:none">{{ ph }}</a>
    </div>
    <!-- Location -->
    <div v-if="loc" style="display:flex;align-items:center;gap:0.5rem">
      <span style="color:var(--ds-primary);font-size:1rem">📍</span>
      <span style="font-size:0.9375rem;color:var(--ds-text-muted)">{{ loc }}</span>
    </div>
    <!-- Trust badges -->
    <div style="display:flex;flex-wrap:wrap;gap:0.625rem">
      <span
        v-for="(badge, i) in resolvedBadges"
        :key="i"
        style="display:inline-flex;align-items:center;gap:0.375rem;background:var(--ds-primary-light,#eff6ff);color:var(--ds-primary);font-size:0.8125rem;font-weight:600;padding:0.3125rem 0.75rem;border-radius:9999px"
      >
        <span aria-hidden="true">✓</span>{{ badge }}
      </span>
    </div>
  </div>
</section>
`
};
if (typeof window !== 'undefined') window.TrustSignalsSection = TrustSignalsSection;
if (typeof module !== 'undefined' && module.exports) module.exports = TrustSignalsSection;
