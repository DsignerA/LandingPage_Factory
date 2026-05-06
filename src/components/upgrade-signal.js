// src/components/upgrade-signal.js
// Step 9 — Subtle Upgrade Signal
// Shows a tasteful banner that hints at the value of this improved site
// without saying "AI generated". Designed to create the reaction:
//   "This looks better than my current website. How much would it cost to finish this?"
const UpgradeSignalSection = {
  props: {
    message:    { type: String, default: 'Designed to convert more visitors into customers' },
    subMessage: { type: String, default: 'Optimized for mobile, appointment requests, and local search' },
    ctaLabel:   { type: String, default: 'Get This Website' },
    ctaHref:    { type: String, default: '#contact' },
    props:      { type: Object, default: () => ({}) }
  },
  computed: {
    resolvedMessage()    { return (this.props && this.props.message)    || this.message    || 'Designed to convert more visitors into customers'; },
    resolvedSubMessage() { return (this.props && this.props.subMessage) || this.subMessage || 'Optimized for mobile, appointment requests, and local search'; },
    resolvedCtaLabel()   { return (this.props && this.props.ctaLabel)   || this.ctaLabel   || 'Get This Website'; },
    resolvedCtaHref()    { return (this.props && this.props.ctaHref)    || this.ctaHref    || '#contact'; }
  },
  template: `
<section id="upgrade-signal" style="background:linear-gradient(135deg,var(--ds-primary) 0%,var(--ds-secondary,var(--ds-primary)) 100%);padding:3rem 1.5rem">
  <div class="ds-container" style="text-align:center;color:var(--ds-text-inverse)">
    <div style="display:inline-flex;align-items:center;gap:0.5rem;background:rgba(255,255,255,0.15);border-radius:9999px;padding:0.375rem 1rem;margin-bottom:1.25rem;font-size:0.8125rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase">
      <span style="width:0.5rem;height:0.5rem;background:#22c55e;border-radius:9999px;display:inline-block"></span>
      Website Preview
    </div>
    <h2 style="font-size:clamp(1.5rem,3vw,2rem);font-weight:700;color:#fff;margin-bottom:0.75rem;line-height:1.2">{{ resolvedMessage }}</h2>
    <p style="color:rgba(255,255,255,0.82);font-size:1rem;margin-bottom:2rem;max-width:36rem;margin-left:auto;margin-right:auto">{{ resolvedSubMessage }}</p>
    <a :href="resolvedCtaHref" style="display:inline-flex;align-items:center;padding:0.875rem 2.25rem;border-radius:0.75rem;background:#fff;color:var(--ds-primary);font-weight:700;font-size:1rem;text-decoration:none;box-shadow:0 4px 20px rgba(0,0,0,0.15)">{{ resolvedCtaLabel }}</a>
  </div>
</section>
`
};
if (typeof window !== 'undefined') window.UpgradeSignalSection = UpgradeSignalSection;
if (typeof module !== 'undefined' && module.exports) module.exports = UpgradeSignalSection;
