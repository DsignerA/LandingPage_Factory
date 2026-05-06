
const MissingOpportunitiesSection = {
  props: {
    title: {
      type: String,
      default: 'Your current site is missing:'
    },
    items: {
      type: Array,
      default: () => []
    }
  },
  computed: {
    list() {
      const arr = Array.isArray(this.items) ? this.items : []
      return arr.map(x => (typeof x === 'string' ? x.trim() : String(x || ''))).filter(Boolean)
    },
    headingId() {
      const base = typeof this.title === 'string' ? this.title : 'missing-opportunities'
      const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      return (slug ? slug : 'missing-opportunities') + '-heading'
    }
  },
  template: `
<section class="py-16 px-6 bg-amber-50/40">
  <div class="max-w-3xl mx-auto">
    <h2 class="text-2xl md:text-3xl font-bold mb-4" :id="headingId">{{ title }}</h2>
    <ul class="list-disc pl-6 space-y-2 text-zinc-800">
      <li v-for="(item, i) in list" :key="i">{{ item }}</li>
    </ul>
  </div>
</section>
`
}
if (typeof window !== 'undefined') window.MissingOpportunitiesSection = MissingOpportunitiesSection;
