const PricingSection = {
  props: {
    plans: {
      type: Array,
      default: () => ([
        {
          name: 'Starter',
          monthly: 19,
          yearly: 190,
          features: [
            '1 landing page',
            'Basic templates',
            'Email support',
          ],
          cta: {
            label: 'Start Starter',
            href: '#cta-starter'
          }
        },
        {
          name: 'Pro',
          monthly: 49,
          yearly: 490,
          features: [
            '10 landing pages',
            'All templates',
            'Priority support',
            'Custom branding',
          ],
          cta: {
            label: 'Choose Pro',
            href: '#cta-pro'
          },
          popular: true,
        },
        {
          name: 'Enterprise',
          monthly: null,
          yearly: null,
          features: [
            'Unlimited pages',
            'White-glove onboarding',
            'AI integrations',
            'Dedicated support',
          ],
          cta: {
            label: 'Contact Sales',
            href: '#cta-enterprise'
          }
        }
      ])
    },
    defaultCycle: {
      type: String,
      default: 'monthly'
    },
    // New: allow customizing vertical padding on the section
    sectionPad: {
      type: String,
      default: 'py-20'
    },
    // New: control visual emphasis of pricing cards
    pricingStyle: {
      type: String,
      default: 'highlighted_middle'
    }
  },
  emits: ['pricing_toggle', 'pricing_cta_click'],
  data() {
    return {
      selectedCycle: this.defaultCycle === 'yearly' ? 'yearly' : 'monthly'
    }
  },
  computed: {
    basePlans() {
      if (Array.isArray(this.plans) && this.plans.length) return this.plans
      // fallback
      return [
        {
          name: 'Starter',
          monthly: 19,
          yearly: 190,
          features: [
            '1 landing page',
            'Basic templates',
            'Email support',
          ],
          cta: { label: 'Start Starter', href: '#cta-starter' }
        },
        {
          name: 'Pro',
          monthly: 49,
          yearly: 490,
          features: [
            '10 landing pages',
            'All templates',
            'Priority support',
            'Custom branding',
          ],
          cta: { label: 'Choose Pro', href: '#cta-pro' },
          popular: true,
        },
        {
          name: 'Enterprise',
          monthly: null,
          yearly: null,
          features: [
            'Unlimited pages',
            'White-glove onboarding',
            'AI integrations',
            'Dedicated support',
          ],
          cta: { label: 'Contact Sales', href: '#cta-enterprise' }
        }
      ]
    },
    showPlans() {
      // normalize both shapes: plan.monthly/yearly OR plan.price.monthly/yearly
      return this.basePlans.map(p => {
        const monthly = (p && p.monthly !== undefined) ? p.monthly : (p && p.price ? p.price.monthly : null)
        const yearly = (p && p.yearly !== undefined) ? p.yearly : (p && p.price ? p.price.yearly : null)
        return {
          ...p,
          monthly,
          yearly
        }
      })
    }
  },
  methods: {
    hasEventListener(name) {
      try {
        // Vue 2 style listeners
        if (this.$listeners && typeof this.$listeners === 'object') {
          if (this.$listeners[name] || this.$listeners[name.replace(/_/g, '-')]) return true;
        }
        // Vue 3 style listeners present on $attrs as onXxx handlers
        const a = this.$attrs || {};
        const toPascal = (s) => s
          .replace(/[_-]+/g, '-')
          .replace(/(^|-)\w/g, m => m.replace(/-|_/g, '').toUpperCase())
          .replace(/[-_]/g, '');
        const variants = [name, name.replace(/_/g, '-')];
        for (const v of variants) {
          const onKey = 'on' + toPascal(v); // e.g., pricing-cta-click -> onPricingCtaClick
          if (a[onKey]) return true;
        }
      } catch (e) {}
      return false;
    },
    toggleCycle(cycle) {
      if (this.selectedCycle !== cycle) {
        this.selectedCycle = cycle;
        const payload = { cycle };
        if (typeof this.$emit === 'function') this.$emit('pricing_toggle', payload);
        // Fallback: if no listener, use window tracking when available
        try {
          const hasListener = this.hasEventListener && this.hasEventListener('pricing_toggle');
          if (!hasListener && typeof window !== 'undefined' && typeof window.trackEvent === 'function') {
            window.trackEvent('pricing_toggle', payload);
          }
        } catch (e) {}
      }
    },
    handleCtaClick(plan) {
      const fallback = '#cta-' + (plan.name || 'plan').toLowerCase();
      const target = (plan && plan.cta && plan.cta.href) ? plan.cta.href : fallback;
      const payload = { plan: plan.name, cycle: this.selectedCycle, href: target };
      // Emit event for parent tracking/handling
      if (typeof this.$emit === 'function') this.$emit('pricing_cta_click', payload);
      // Fallback: if no listener, use window tracking when available
      try {
        const hasListener = this.hasEventListener && this.hasEventListener('pricing_cta_click');
        if (!hasListener && typeof window !== 'undefined' && typeof window.trackEvent === 'function') {
          window.trackEvent('pricing_cta_click', payload);
        }
      } catch (e) {}
      // Proceed with navigation
      if (typeof target === 'string') {
        if (target.startsWith('#')) {
          if (typeof window !== 'undefined') window.location.hash = target;
        } else {
          if (typeof window !== 'undefined') window.location.href = target;
        }
      }
    },
    toNumber(val) {
      if (typeof val === 'number') return val
      if (typeof val === 'string') {
        const n = parseFloat(val.replace(/[^0-9.]/g, ''))
        return isNaN(n) ? null : n
      }
      return null
    },
    toCurrency(n) {
      try { return `$${Math.round(n)}` } catch(e) { return '' }
    },
    formatPrice(p, cycle) {
      const mRaw = p.monthly
      const yRaw = p.yearly
      if (cycle === 'yearly') {
        if (yRaw == null) return 'Custom'
        const yNum = this.toNumber(yRaw)
        if (yNum == null) return typeof yRaw === 'string' ? yRaw : 'Custom'
        // Show price per month, billed yearly (no /mo suffix here; template adds it)
        return this.toCurrency(yNum / 12)
      } else {
        if (mRaw == null) return 'Custom'
        const mNum = this.toNumber(mRaw)
        if (mNum == null) return typeof mRaw === 'string' ? mRaw : 'Custom'
        return this.toCurrency(mNum)
      }
    },
    cycleSubtitle(cycle, plan) {
      if (cycle === 'yearly' && plan.yearly) {
        return 'Billed yearly';
      }
      if (cycle === 'monthly' && plan.monthly) {
        return 'Billed monthly';
      }
      return '';
    }
  },
  template: `
<section :class="sectionPad + ' px-6 bg-gray-50'" id="pricing">
  <div class="max-w-2xl mx-auto text-center mb-12">
    <h2 class="text-3xl font-bold mb-2">Simple, transparent pricing</h2>
    <p class="text-zinc-600">Choose a plan that fits your business size. Cancel anytime.</p>
    <div class="inline-flex bg-zinc-100 rounded-full mt-6 p-1 select-none shadow-sm">
      <button
        :class="selectedCycle==='monthly' ? 'bg-white shadow text-zinc-900' : 'text-zinc-500'"
        class="px-4 py-1.5 text-sm font-medium rounded-full focus:outline-none transition"
        @click="toggleCycle('monthly')"
        aria-pressed="selectedCycle==='monthly'"
        aria-label="Show monthly pricing"
      >Monthly</button>
      <button
        :class="selectedCycle==='yearly' ? 'bg-white shadow text-zinc-900' : 'text-zinc-500'"
        class="px-4 py-1.5 text-sm font-medium rounded-full focus:outline-none transition"
        @click="toggleCycle('yearly')"
        aria-pressed="selectedCycle==='yearly'"
        aria-label="Show yearly pricing"
      >Yearly <span class="ml-1 text-green-600 font-semibold" v-if="showPlans.some(p=>p.yearly)">-2 months free</span></button>
    </div>
  </div>

  <div class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
    <div
      v-for="(plan, i) in showPlans"
      :key="i"
        :class="[
        'relative flex flex-col p-8 border rounded-2xl bg-white transition-all hover:shadow-xl',
        plan.popular && pricingStyle==='highlighted_middle'
          ? 'border-blue-600 shadow-lg scale-105 z-10'
          : 'border-zinc-200',
        !plan.popular && pricingStyle==='highlighted_middle' ? 'opacity-90' : ''
      ]"
    >
      <div
        v-if="plan.popular && pricingStyle==='highlighted_middle'"
        class="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 text-xs bg-blue-600 rounded-full text-white font-semibold shadow-sm"
      >
        Most Popular
      </div>

      <h3 class="text-xl font-bold mb-2 text-zinc-900">{{ plan.name }}</h3>

      <div class="mt-2">
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-extrabold text-zinc-900">
            {{ formatPrice(plan, selectedCycle) }}
          </span>
          <span
            v-if="formatPrice(plan, selectedCycle) !== 'Custom'"
            class="text-zinc-500"
          >/mo</span>
    </div>
        <div class="text-sm text-zinc-500 mt-1">
          {{ cycleSubtitle(selectedCycle, plan) }}
  </div>
      </div>

      <ul class="mt-6 space-y-2 text-sm text-zinc-700 flex-1">
        <li
          v-for="(f, idx) in plan.features"
          :key="idx"
          class="flex items-start gap-2"
        >
          <span class="text-green-600 mt-0.5" aria-hidden="true">✓</span>
          <span>{{ f }}</span>
        </li>
      </ul>

      <div class="mt-8">
        <a
          :href="plan?.cta?.href || '#cta-' + (plan.name || 'plan').toLowerCase()"
          @click.prevent="handleCtaClick(plan)"
          class="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-white font-semibold shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
          :aria-label="'Select ' + plan.name + ' plan'"
        >
          {{ plan?.cta?.label || (formatPrice(plan, selectedCycle) === 'Custom' ? 'Contact Sales' : 'Choose ' + plan.name) }}
        </a>
      </div>
    </div>
  </div>
</section>
`
};