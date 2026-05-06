
const InsuranceInfoSection = {
  props: {
    title: { type: String, default: 'Insurance & Payment' },
    subtitle: { type: String, default: 'We make it easy to understand your coverage and options.' },
    items: {
      type: Array,
      default: () => [
        'We accept most PPO plans and can help verify your benefits',
        'We file claims on your behalf and explain out-of-pocket costs',
        'Financing and flexible payment options available',
        'Call or message us to confirm your coverage'
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
<section class="py-20 px-6 bg-zinc-50">
  <div class="max-w-4xl mx-auto">
    <div class="text-center mb-8">
      <h2 class="text-3xl md:text-4xl font-bold mb-3">{{ title }}</h2>
      <p v-if="subtitle" class="text-zinc-600 max-w-2xl mx-auto">{{ subtitle }}</p>
    </div>
    <ul class="space-y-3">
      <li v-for="(item, i) in list" :key="i" class="flex items-start gap-3 bg-white border border-zinc-100 rounded-xl p-4 shadow-sm">
        <span class="text-blue-600 mt-0.5" aria-hidden="true">•</span>
        <span class="text-zinc-800">{{ item }}</span>
      </li>
    </ul>
  </div>
</section>
`
}
if (typeof window !== 'undefined') window.InsuranceInfoSection = InsuranceInfoSection;
