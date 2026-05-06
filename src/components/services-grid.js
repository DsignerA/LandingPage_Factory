
const ServicesGridSection = {
  props: {
    title: { type: String, default: 'Our Dental Services' },
    subtitle: { type: String, default: '' },
    items: { type: Array, default: () => [] }
  },
  computed: {
    normalizedItems() {
      const arr = Array.isArray(this.items) ? this.items : []
      return arr
        .map((it) => {
          if (typeof it === 'string') return { title: it.trim(), description: '' }
          const t = (it && typeof it.title === 'string') ? it.title : ''
          const d = (it && typeof it.description === 'string') ? it.description : ''
          return { title: String(t).trim(), description: String(d).trim() }
        })
        .filter(it => it.title)
    },
    headingId() {
      const base = typeof this.title === 'string' ? this.title : 'services'
      const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      return (slug ? slug : 'services') + '-heading'
    }
  },
  template: `
<section class="py-20 px-6 bg-white">
  <div class="max-w-6xl mx-auto">
    <div class="text-center mb-12">
      <h2 class="text-3xl md:text-4xl font-bold mb-2" :id="headingId">{{ title }}</h2>
      <p class="text-zinc-600 max-w-2xl mx-auto">{{ subtitle || 'Comprehensive care for all ages — from preventive checkups to modern restorative treatments.' }}</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div v-for="(item, idx) in normalizedItems" :key="idx" class="bg-white rounded-2xl border border-zinc-100 shadow-md p-6 hover:shadow-lg transition">
        <h3 class="text-xl font-semibold mb-2 text-zinc-900">{{ item.title }}</h3>
        <p v-if="item.description" class="text-zinc-700 leading-relaxed">{{ item.description }}</p>
      </div>
    </div>
  </div>
</section>
`
}
if (typeof window !== 'undefined') window.ServicesGridSection = ServicesGridSection;
