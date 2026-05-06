
// components/faq.js — Upgraded premium FAQ section with accordion
const FAQSection = {
  props: {
    heading:  { type: String, default: 'Frequently Asked Questions' },
    subtitle: { type: String, default: '' },
    items:    { type: Array,  default: () => [] },
    props:    { type: Object, default: () => ({}) }
  },
  data() {
    return { openIndex: 0 };
  },
  computed: {
    resolvedHeading()  { return (this.props && this.props.heading)  || this.heading  || 'Frequently Asked Questions'; },
    resolvedSubtitle() { return (this.props && this.props.subtitle) || this.subtitle || ''; },
    resolvedItems() {
      const raw = (this.props && Array.isArray(this.props.items)) ? this.props.items : (Array.isArray(this.items) ? this.items : []);
      if (!raw.length) return [
        { question: 'How do I get started?',             answer: 'Simply contact us and we will walk you through the process step by step.' },
        { question: 'What are your hours?',               answer: 'We are open Monday through Friday, 8am to 6pm. Emergency services available.' },
        { question: 'Do you accept insurance?',           answer: 'Yes, we work with most major providers. Contact us to verify your coverage.' },
        { question: 'How long does an appointment take?', answer: 'Most appointments take 30 to 60 minutes depending on the service.' }
      ];
      return raw.map(function(it) {
        return { question: (it && it.question) || '', answer: (it && it.answer) || '' };
      });
    }
  },
  methods: {
    toggle(i) { this.openIndex = this.openIndex === i ? -1 : i; }
  },
  template: `
<section class="ds-section" id="faq">
  <div class="ds-container" style="max-width:52rem;margin:0 auto">
    <div style="text-align:center;margin-bottom:3rem">
      <div class="ds-label fade-up" style="margin-bottom:0.5rem">FAQ</div>
      <h2 class="ds-section-heading fade-up" style="margin-bottom:0.75rem">{{ resolvedHeading }}</h2>
      <p v-if="resolvedSubtitle" class="ds-subheading fade-up" style="max-width:40rem;margin:0 auto">{{ resolvedSubtitle }}</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:0.75rem">
      <div
        v-for="(item, i) in resolvedItems"
        :key="i"
        class="ds-card fade-up"
        style="padding:0;overflow:hidden;cursor:pointer"
        @click="toggle(i)"
      >
        <div style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;gap:1rem">
          <h3 style="font-size:1rem;font-weight:600;color:var(--ds-text);margin:0;flex:1">{{ item.question }}</h3>
          <span style="color:var(--ds-primary);font-size:1.25rem;font-weight:700;flex-shrink:0;transition:transform 0.2s" :style="openIndex===i ? 'transform:rotate(45deg)' : ''">+</span>
        </div>
        <div v-if="openIndex===i" style="padding:0 1.5rem 1.25rem;border-top:1px solid var(--ds-border)">
          <p style="color:var(--ds-text-muted);line-height:1.65;margin:0.75rem 0 0">{{ item.answer }}</p>
        </div>
      </div>
    </div>
  </div>
</section>
`
};
if (typeof window !== 'undefined') window.FAQSection = FAQSection;
if (typeof module !== 'undefined' && module.exports) module.exports = FAQSection;
