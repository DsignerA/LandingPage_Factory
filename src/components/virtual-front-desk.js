
const VirtualFrontDeskSection = {
  props: {
    title: { type: String, default: 'Your Virtual Front Desk—Here When You Need Us' },
    subtitle: { type: String, default: 'Our website helps patients even when the office is busy or closed.' },
    items: {
      type: Array,
      default: () => [
        'Answers common patient questions in seconds',
        'Collects appointment requests anytime, day or night',
        'Guides patients on insurance and payment options',
        'Captures after-hours messages so nothing gets missed'
      ]
    }
  },
  computed: {
    list() {
      const arr = Array.isArray(this.items) ? this.items : []
      return arr.map(x => (typeof x === 'string' ? x.trim() : String(x || ''))).filter(Boolean)
    }
  },
  template: `
<section class="py-20 px-6 bg-blue-50/40">
  <div class="max-w-4xl mx-auto text-center">
    <h2 class="text-3xl md:text-4xl font-bold mb-3">{{ title }}</h2>
    <p v-if="subtitle" class="text-zinc-600 max-w-2xl mx-auto mb-6">{{ subtitle }}</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
      <div v-for="(item, i) in list" :key="i" class="bg-white rounded-xl border border-zinc-100 shadow-sm p-5">
        <div class="flex items-start gap-3">
          <span class="text-green-600 mt-0.5" aria-hidden="true">✓</span>
          <span class="text-zinc-800">{{ item }}</span>
        </div>
      </div>
    </div>
  </div>
</section>
`
}
if (typeof window !== 'undefined') window.VirtualFrontDeskSection = VirtualFrontDeskSection;
