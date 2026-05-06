const HeroSection = {
  props: {
    title: { type: String, default: 'AI Landing Builder' },
    subtitle: { type: String, default: 'Generate landing pages instantly with AI agents.' },
    primaryCta: {
      type: Object,
      default: () => ({ label: 'Get Started', href: '#cta' })
    },
    secondaryCta: {
      type: Object,
      default: () => ({ label: 'See pricing', href: '#pricing' })
    },
    logos: {
      type: Array,
      default: () => []
    }
  },
  computed: {
    normalizedLogos() {
      return (this.logos || [])
        .map((l, i) => {
          if (typeof l === 'string') return { src: l, alt: 'Logo ' + (i + 1) }
          return { src: l?.src || '', alt: l?.alt || 'Logo ' + (i + 1) }
        })
        .filter(l => l.src)
    }
  },
  methods: {
    safeTrack(name, payload) {
      try {
        if (typeof window !== 'undefined' && typeof window.trackEvent === 'function') {
          window.trackEvent(name, payload || {})
        }
      } catch (e) {}
    },
    onPrimaryClick(e) {
      this.safeTrack('hero_cta_click', {
        label: this.primaryCta?.label,
        href: this.primaryCta?.href
      })
      // Allow default navigation behavior
    },
    onSecondaryClick(e) {
      this.safeTrack('hero_secondary_click', {
        label: this.secondaryCta?.label,
        href: this.secondaryCta?.href
      })
      const href = (this.secondaryCta && this.secondaryCta.href) ? this.secondaryCta.href : '#pricing'
      if (href && href.startsWith('#')) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault()
        if (typeof document !== 'undefined') {
          const el = document.querySelector(href)
          if (el && typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          } else if (typeof window !== 'undefined') {
            window.location.hash = href
          }
        } else if (typeof window !== 'undefined') {
          window.location.hash = href
        }
      }
      // If not a hash link, let the browser navigate
    }
  },
  template: `
<section id="hero" class="relative overflow-hidden bg-gradient-to-b from-blue-50/50 from-30% to-white pb-12">
  <div class="absolute -left-20 -top-20 -z-10 h-60 w-96 bg-blue-100 rounded-full opacity-30 blur-3xl"></div>
  <div class="absolute right-0 top-0 -z-10 h-40 w-40 bg-blue-300 rounded-full opacity-10 blur-2xl"></div>
  <div class="mx-auto max-w-7xl px-6 py-20 md:py-32">
    <div class="mx-auto max-w-3xl text-center flex flex-col items-center">
      <span class="inline-block rounded-full bg-blue-100 text-blue-700 font-semibold text-xs uppercase tracking-widest mb-6 px-3 py-1 ring-1 ring-inset ring-blue-200">
        Build faster launch pages
      </span>
      <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-900 leading-tight mb-4">
        {{ title }}
      </h1>
      <p class="text-lg sm:text-2xl text-zinc-600 max-w-xl mx-auto font-medium mb-8">
        {{ subtitle }}
      </p>
      <div class="w-full flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
        <a :href="primaryCta?.href || '#cta'"
           @click="onPrimaryClick"
           :aria-label="primaryCta?.label || 'Get Started'"
           class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-7 py-3 text-white font-semibold text-lg shadow-lg shadow-blue-100/50 hover:bg-blue-700 hover:shadow-blue-200/70 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500">
          {{ primaryCta?.label || 'Get Started' }}
        </a>
        <a :href="secondaryCta?.href || '#pricing'"
           @click="onSecondaryClick"
           :aria-label="secondaryCta?.label || 'See pricing'"
           class="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-7 py-3 text-zinc-800 bg-white font-semibold text-lg hover:bg-zinc-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-zinc-400">
          {{ secondaryCta?.label || 'See pricing' }}
        </a>
      </div>
      <div class="text-xs text-zinc-400 mt-1">No credit card required</div>
      <div v-if="normalizedLogos.length" class="mt-14 w-full">
        <p class="text-sm text-zinc-500 mb-3">Trusted by teams at</p>
        <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 opacity-80">
          <img v-for="(logo, i) in normalizedLogos"
               :key="i"
               :src="logo.src"
               :alt="logo.alt"
               class="h-8 w-auto object-contain grayscale hover:grayscale-0 transition"
               loading="lazy" />
        </div>
      </div>
    </div>
  </div>
</section>
`
}