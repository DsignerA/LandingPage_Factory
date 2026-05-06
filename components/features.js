const FeaturesSection = {
  props: {
    heading: {
      type: String,
      default: 'Why Choose AI Landing Builder?'
    },
    subheading: {
      type: String,
      default: 'Discover the unique advantages that make our landing page builder the ideal partner for your next launch.'
    },
    items: {
      type: Array,
      default: () => ([
        {
          title: "Lightning Fast",
          description: "Generate complete, conversion-optimized landing pages in seconds — never wait on designers or coders again."
        },
        {
          title: "Fully Modular",
          description: "Effortlessly rearrange, customize, or edit every section. Update content independently without touching code."
        },
        {
          title: "AI-Powered Agents",
          description: "Let smart AI agents build and improve your pages based on your goals and product needs."
        }
      ])
    }
  },
  computed: {
    headingId() {
      const base = typeof this.heading === 'string' ? this.heading : 'features';
      const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return (slug ? slug : 'features') + '-heading';
    }
  },
  template: `
    <section class="py-20 px-6" :aria-labelledby="headingId">
      <div class="max-w-4xl mx-auto text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold mb-4" :id="headingId">{{ heading }}</h2>
        <p v-if="subheading" class="max-w-2xl mx-auto text-zinc-600 text-lg">{{ subheading }}</p>
      </div>
      <div class="max-w-6xl mx-auto grid grid-cols-1 gap-8 md:grid-cols-3">
        <div v-for="(item, idx) in items" :key="idx" class="bg-white border border-zinc-100 shadow-sm rounded-2xl p-8 transition hover:shadow-lg flex flex-col h-full">
          <div class="mb-3">
            <h3 class="text-xl font-semibold mb-2 text-zinc-900">
              <a v-if="item.href" :href="item.href" class="hover:text-blue-600 transition underline underline-offset-4">
                {{ item.title }}
              </a>
              <span v-else>{{ item.title }}</span>
            </h3>
          </div>
          <p class="text-zinc-600 flex-grow">{{ item.description }}</p>
        </div>
      </div>
    </section>
  `
}