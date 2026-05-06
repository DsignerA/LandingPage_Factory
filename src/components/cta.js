
const CTASection = {
  props: {
    // Support both title/subtitle and heading/subheading for compatibility
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    heading: { type: String, default: '' },
    subheading: { type: String, default: '' },
    primaryCta: {
      type: Object,
      default: () => ({ label: 'Request Appointment', href: '#book' })
    },
    secondaryCta: {
      type: Object,
      default: () => ({ label: 'Call Our Office', href: 'tel:' })
    }
  },
  computed: {
    h() {
      return this.title || this.heading || 'Ready for a Healthier Smile?'
    },
    sh() {
      return this.subtitle || this.subheading || 'Friendly care, clear answers, and appointment requests in minutes.'
    },
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
      // For tel: and external links, allow default navigation
    }
  },
  template: `
<section id="cta" class="py-20 px-6 bg-blue-600 text-white" :aria-labelledby="headingId">
  <div class="max-w-4xl mx-auto text-center">
    <h2 class="text-3xl md:text-4xl font-extrabold mb-2" :id="headingId">{{ h }}</h2>
    <p class="text-blue-100 max-w-2xl mx-auto mb-6">{{ sh }}</p>
    <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
      <a :href="primaryCta?.href || '#book'"
         class="btn bg-white text-blue-700 font-semibold"
         @click="onClick($event, primaryCta)">{{ primaryCta?.label || 'Request Appointment' }}</a>
      <a v-if="hasSecondary"
         :href="secondaryCta?.href || 'tel:'"
         class="btn border border-white/70 text-white"
         @click="onClick($event, secondaryCta)">{{ secondaryCta?.label || 'Call Our Office' }}</a>
    </div>
    <div class="text-xs text-blue-100 mt-3">See how your site can capture after-hours appointment requests so nothing gets missed.</div>
  </div>
</section>
`
}
if (typeof window !== 'undefined') window.CTASection = CTASection;
