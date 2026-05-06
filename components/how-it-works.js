
// components/how-it-works.js — Upgraded premium "How It Works" section
const HowItWorksSection = {
  props: {
    heading:  { type: String, default: 'How It Works' },
    subtitle: { type: String, default: '' },
    items:    { type: Array,  default: () => [] },
    props:    { type: Object, default: () => ({}) }
  },
  computed: {
    resolvedHeading()  { return (this.props && this.props.heading)  || this.heading  || 'How It Works'; },
    resolvedSubtitle() { return (this.props && this.props.subtitle) || this.subtitle || ''; },
    resolvedItems() {
      const raw = (this.props && Array.isArray(this.props.items)) ? this.props.items : (Array.isArray(this.items) ? this.items : []);
      if (!raw.length) return [
        { step: 1, title: 'Contact Us',  description: 'Reach out to discuss your needs — we will ask a few questions to understand your goals.' },
        { step: 2, title: 'Get a Plan',  description: 'We craft a customized plan and walk you through the details with transparent pricing.' },
        { step: 3, title: 'Take Action', description: 'We execute and support you every step of the way to ensure a successful outcome.' }
      ];
      return raw.map(function(it, i) {
        return { step: i + 1, title: (it && it.title) || '', description: (it && it.description) || '' };
      });
    }
  },
  template: `
<section class="ds-section" style="background:var(--ds-surface-alt)">
  <div class="ds-container">
    <div style="text-align:center;margin-bottom:3rem">
      <div class="ds-label fade-up" style="margin-bottom:0.5rem">Simple Process</div>
      <h2 class="ds-section-heading fade-up" style="margin-bottom:0.75rem">{{ resolvedHeading }}</h2>
      <p v-if="resolvedSubtitle" class="ds-subheading fade-up" style="max-width:40rem;margin:0 auto">{{ resolvedSubtitle }}</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:var(--ds-grid-gap)">
      <div v-for="(step, i) in resolvedItems" :key="i" class="ds-card fade-up" :data-stagger-group="'how-it-works'" style="position:relative;overflow:hidden">
        <div style="width:2.5rem;height:2.5rem;border-radius:9999px;background:var(--ds-primary);color:var(--ds-text-inverse);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;margin-bottom:1.25rem;flex-shrink:0">{{ step.step }}</div>
        <h3 style="font-size:1.0625rem;font-weight:700;color:var(--ds-text);margin-bottom:0.5rem">{{ step.title }}</h3>
        <p style="color:var(--ds-text-muted);font-size:0.9375rem;line-height:1.65">{{ step.description }}</p>
      </div>
    </div>
  </div>
</section>
`
};

if (typeof window !== 'undefined') window.HowItWorksSection = HowItWorksSection;
