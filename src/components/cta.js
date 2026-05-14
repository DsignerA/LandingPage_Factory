
const CTASection = {
  // Neutral, niche-agnostic defaults. The upgrade provider / niche pack supplies
  // the real heading + CTA labels per client; this component just renders them
  // in the page's design tokens.
  props: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    heading: { type: String, default: '' },
    subheading: { type: String, default: '' },
    primaryCta: {
      type: Object,
      default: () => ({ label: 'Get Started', href: '#contact' })
    },
    secondaryCta: {
      type: Object,
      default: () => ({ label: '', href: '' })
    }
  },
  computed: {
    h() { return this.title || this.heading || 'Ready to Get Started?' },
    sh() { return this.subtitle || this.subheading || '' },
    hasSecondary() {
      return this.secondaryCta && (this.secondaryCta.label || this.secondaryCta.href)
    },
    headingId() {
      const base = String(this.h || 'cta')
      const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      return (slug || 'cta') + '-heading'
    }
  },
  methods: {
    onClick(e, target) {
      const href = target && target.href
      if (!href) return
      if (href.startsWith && href.startsWith('#')) {
        e.preventDefault()
        const el = document.querySelector(href)
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        else window.location.hash = href
      }
    }
  },
  template: `
<section id="cta" class="py-20 px-6" :aria-labelledby="headingId" style="background:var(--ds-primary);color:var(--ds-text-inverse)">
  <div class="max-w-4xl mx-auto text-center">
    <h2 class="text-3xl md:text-4xl font-extrabold mb-2" :id="headingId">{{ h }}</h2>
    <p v-if="sh" class="max-w-2xl mx-auto mb-6" style="color:var(--ds-text-inverse);opacity:0.85">{{ sh }}</p>
    <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
      <a :href="primaryCta && primaryCta.href || '#contact'"
         class="btn font-semibold"
         style="background:var(--ds-text-inverse);color:var(--ds-primary)"
         @click="onClick($event, primaryCta)">{{ primaryCta && primaryCta.label || 'Get Started' }}</a>
      <a v-if="hasSecondary"
         :href="secondaryCta && secondaryCta.href || '#'"
         class="btn"
         style="border:1px solid var(--ds-text-inverse);color:var(--ds-text-inverse)"
         @click="onClick($event, secondaryCta)">{{ secondaryCta && secondaryCta.label }}</a>
    </div>
  </div>
</section>
`
}
if (typeof window !== 'undefined') window.CTASection = CTASection;
