// components/page-builder.js
// Lightweight visual editor for the page schema used by PageRenderer
// Props: modelValue (Array of sections)
// Emits: update:modelValue
// This uses the existing global PageRenderer and SectionRegistry.

const PageBuilder = {
  props: {
    modelValue: {
      type: Array,
      default: () => []
    }
  },
  emits: ['update:modelValue'],
  computed: {
    sections() {
      return Array.isArray(this.modelValue) ? this.modelValue : []
    }
  },
  methods: {
    emitUpdate(next) {
      this.$emit('update:modelValue', next)
    },
    moveUp(index) {
      if (index <= 0 || index >= this.sections.length) return
      const next = this.sections.slice()
      const [item] = next.splice(index, 1)
      next.splice(index - 1, 0, item)
      this.emitUpdate(next)
    },
    moveDown(index) {
      if (index < 0 || index >= this.sections.length - 1) return
      const next = this.sections.slice()
      const [item] = next.splice(index, 1)
      next.splice(index + 1, 0, item)
      this.emitUpdate(next)
    },
    removeSection(index) {
      if (index < 0 || index >= this.sections.length) return
      const next = this.sections.slice()
      next.splice(index, 1)
      this.emitUpdate(next)
    },
    addSection(section) {
      const next = this.sections.slice()
      next.push(section)
      this.emitUpdate(next)
    },
    newId(prefix) {
      return `${prefix}-${Date.now()}`
    },
    addHero() {
      this.addSection({
        id: this.newId('hero'),
        type: 'hero',
        props: {
          title: 'New Hero Title',
          subtitle: 'Describe your product here',
          primaryCta: { label: 'Get Started', href: '#cta' },
          secondaryCta: { label: 'See Pricing', href: '#pricing' },
          logos: []
        }
      })
    },
    addFeatures() {
      this.addSection({
        id: this.newId('features'),
        type: 'features',
        props: {
          heading: 'Everything you need',
          subheading: 'Composable sections that are easy to render and extend.',
          items: [
            { title: 'Reusable sections', description: 'Build once and reuse everywhere.' },
            { title: 'Schema-driven', description: 'Render pages from structured JSON.' },
            { title: 'AI-ready', description: 'Generate safe pages with predictable props.' }
          ]
        }
      })
    },
    addPricing() {
      this.addSection({
        id: this.newId('pricing'),
        type: 'pricing',
        props: {
          defaultCycle: 'monthly',
          pricingStyle: 'highlighted_middle',
          plans: [
            {
              name: 'Starter',
              monthly: 19,
              yearly: 190,
              features: ['1 site', 'Basic analytics', 'Email support'],
              cta: { label: 'Choose Starter', href: '#cta-starter' }
            },
            {
              name: 'Pro',
              popular: true,
              monthly: 49,
              yearly: 490,
              features: ['5 sites', 'Advanced analytics', 'Priority support'],
              cta: { label: 'Choose Pro', href: '#cta-pro' }
            },
            {
              name: 'Enterprise',
              monthly: 'Custom',
              yearly: 'Custom',
              features: ['Unlimited sites', 'Custom integrations', 'Dedicated support'],
              cta: { label: 'Contact Sales', href: '#contact-sales' }
            }
          ]
        }
      })
    },
    addTestimonials() {
      this.addSection({ id: this.newId('testimonials'), type: 'testimonials', props: {} })
    },
    addFaq() {
      this.addSection({ id: this.newId('faq'), type: 'faq', props: {} })
    },
    addCta() {
      this.addSection({
        id: this.newId('cta'),
        type: 'cta',
        props: {
          heading: 'Start Building Today',
          subheading: 'Launch faster with reusable sections.',
          primaryCta: { label: 'Launch Now', href: '#cta' }
        }
      })
    },
    exportSchema() {
      try {
        const json = JSON.stringify(this.sections, null, 2)
        if (typeof console !== 'undefined' && console.log) console.log(json)
      } catch (e) {}
    }
  },
  template: `
    <section class="px-6 py-6">
      <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Builder Panel -->
        <div class="lg:col-span-4 bg-white border border-zinc-200 rounded-2xl p-4">
          <h2 class="text-lg font-semibold mb-3">Page Builder</h2>

          <div class="mb-4">
            <div class="text-sm text-zinc-600 mb-2">Add section</div>
            <div class="flex flex-wrap gap-2">
              <button @click.prevent="addHero" class="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-zinc-50">+ Hero</button>
              <button @click.prevent="addFeatures" class="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-zinc-50">+ Features</button>
              <button @click.prevent="addPricing" class="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-zinc-50">+ Pricing</button>
              <button @click.prevent="addTestimonials" class="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-zinc-50">+ Testimonials</button>
              <button @click.prevent="addFaq" class="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-zinc-50">+ FAQ</button>
              <button @click.prevent="addCta" class="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-zinc-50">+ CTA</button>
            </div>
          </div>

          <div class="text-sm text-zinc-600 mb-2">Sections</div>
          <div v-if="sections.length === 0" class="text-zinc-500 text-sm border border-dashed rounded-xl p-4">No sections yet. Use the buttons above to add your first section.</div>
          <ul v-else class="space-y-2">
            <li v-for="(s, i) in sections" :key="s.id || (s.type + '-' + i)" class="flex items-center justify-between border rounded-xl p-3 bg-white">
              <div>
                <div class="text-xs font-mono uppercase tracking-wide text-zinc-500">{{ s.type || 'section' }}</div>
                <div class="text-xs text-zinc-400">{{ s.id || (s.type + '-' + i) }}</div>
              </div>
              <div class="flex items-center gap-1">
                <button @click.prevent="moveUp(i)" :disabled="i===0" title="Move up" class="px-2 py-1 text-xs rounded border bg-white hover:bg-zinc-50 disabled:opacity-40">↑</button>
                <button @click.prevent="moveDown(i)" :disabled="i===sections.length-1" title="Move down" class="px-2 py-1 text-xs rounded border bg-white hover:bg-zinc-50 disabled:opacity-40">↓</button>
                <button @click.prevent="removeSection(i)" title="Remove" class="px-2 py-1 text-xs rounded border bg-white hover:bg-red-50">✕</button>
              </div>
            </li>
          </ul>

          <div class="mt-4">
            <button @click.prevent="exportSchema" class="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-zinc-50">Export JSON</button>
          </div>
        </div>

        <!-- Live Preview -->
        <div class="lg:col-span-8">
          <page-renderer :page="sections"></page-renderer>
        </div>
      </div>
    </section>
  `
}

if (typeof window !== 'undefined') {
  window.PageBuilder = PageBuilder
}
