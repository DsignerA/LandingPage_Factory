
const CTASection = {
  props: {
    heading: { type: String, default: 'Start Building Today' },
    subheading: { type: String, default: '' },
    primaryCta: {
      type: Object,
      default: () => ({ label: 'Launch Now', href: '#cta' })
    }
  },
  methods: {
    onPrimaryClick(e) {
      const href = this.primaryCta && this.primaryCta.href
      if (!href) return
      if (href.startsWith && href.startsWith('#')) {
        e.preventDefault()
        const el = document.querySelector(href)
        if (el && el.scrollIntoView) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
          window.location.hash = href
        }
      } // for non-hash links, allow default navigation
    }
  },
  template:`
<section id="cta" class="py-24 text-center bg-blue-600 text-white">
  <h2 class="text-3xl font-bold mb-3">{{ heading }}</h2>
  <p v-if="subheading" class="text-blue-100 max-w-2xl mx-auto mb-6">{{ subheading }}</p>
  <a :href="primaryCta && primaryCta.href ? primaryCta.href : '#cta'" @click="onPrimaryClick" class="inline-block px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70">
    {{ (primaryCta && primaryCta.label) ? primaryCta.label : 'Launch Now' }}
  </a>
</section>
`
}
