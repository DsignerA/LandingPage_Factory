
const ServicesGridSection = {
  // Accept both `heading` (canonical, emitted by upgrade provider) and `title`
  // (legacy). Generic default — never leak a niche-specific phrase like "Our
  // Dental Services" here; the provider/niche pack supplies the real wording.
  props: {
    heading:  { type: String, default: '' },
    title:    { type: String, default: '' },
    subtitle: { type: String, default: '' },
    items:    { type: Array,  default: () => [] }
  },
  computed: {
    displayHeading() {
      return (this.heading && String(this.heading).trim()) ||
             (this.title   && String(this.title).trim())   ||
             'Our Services';
    },
    normalizedItems() {
      const arr = Array.isArray(this.items) ? this.items : []
      return arr
        .map((it) => {
          if (typeof it === 'string') return { title: it.trim(), description: '', image: '' }
          const t = (it && typeof it.title === 'string') ? it.title : ''
          const d = (it && typeof it.description === 'string') ? it.description : ''
          const img = (it && typeof it.image === 'string') ? it.image : ''
          return { title: String(t).trim(), description: String(d).trim(), image: img }
        })
        .filter(it => it.title)
    },
    headingId() {
      const slug = this.displayHeading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      return (slug ? slug : 'services') + '-heading'
    }
  },
  template: `
<section class="py-20 px-6" style="background:var(--ds-bg)">
  <div class="max-w-6xl mx-auto">
    <div class="text-center mb-12">
      <h2 class="text-3xl md:text-4xl font-bold mb-2" :id="headingId" style="color:var(--ds-text)">{{ displayHeading }}</h2>
      <p style="color:var(--ds-text-muted)" class="max-w-2xl mx-auto" v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div v-for="(item, idx) in normalizedItems" :key="idx" class="rounded-2xl overflow-hidden hover:shadow-lg transition" style="background:var(--ds-surface);border:1px solid var(--ds-border);box-shadow:0 2px 16px rgba(0,0,0,0.06)">
        <div v-if="item.image" class="w-full" style="aspect-ratio:4/3;background-size:cover;background-position:center" :style="{backgroundImage:'url(' + item.image + ')'}"></div>
        <div class="p-6">
          <h3 class="text-xl font-semibold mb-2" style="color:var(--ds-text)">{{ item.title }}</h3>
          <p v-if="item.description" style="color:var(--ds-text-muted)" class="leading-relaxed">{{ item.description }}</p>
        </div>
      </div>
    </div>
  </div>
</section>
`
}
if (typeof window !== 'undefined') window.ServicesGridSection = ServicesGridSection;
