// src/components/hours-location.js
// Hours + location card: real address from JSON-LD, real hours when extracted,
// link to Google Maps when present, phone CTA. Auto-hides when no data.

const HoursLocationSection = {
  props: {
    heading:       { type: String, default: 'Hours & Location' },
    address:       { type: Object, default: () => ({}) },
    hours:         { type: Array,  default: () => [] },
    phone:         { type: String, default: '' },
    googleMapsUrl: { type: String, default: '' }
  },
  computed: {
    hasAddress() {
      const a = this.address || {};
      return !!(a.street || a.city);
    },
    addressLines() {
      const a = this.address || {};
      const top = [a.street].filter(Boolean).join('');
      const bot = [a.city, a.state, a.postal].filter(Boolean).join(', ').replace(', ,', ',');
      return [top, bot].filter(Boolean);
    },
    mapsHref() {
      if (this.googleMapsUrl) return this.googleMapsUrl;
      const a = this.address || {};
      const q = [a.street, a.city, a.state].filter(Boolean).join(', ');
      return q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : '';
    },
    isEmpty() {
      return !this.hasAddress && !this.hours.length && !this.phone;
    }
  },
  template: `
<section v-if="!isEmpty" id="hours" class="py-20 px-6" style="background:var(--ds-bg)">
  <div class="max-w-6xl mx-auto">
    <h2 class="text-3xl md:text-4xl font-bold mb-10 text-center" style="color:var(--ds-text);font-family:var(--ds-font-heading)">{{ heading }}</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(20rem,1fr));gap:2rem">
      <div v-if="hasAddress" class="rounded-2xl p-7" style="background:var(--ds-surface);border:1px solid var(--ds-border)">
        <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--ds-primary);margin-bottom:0.75rem">Location</div>
        <div v-for="(line, i) in addressLines" :key="i" style="color:var(--ds-text);font-size:1.0625rem;line-height:1.5">{{ line }}</div>
        <a v-if="mapsHref" :href="mapsHref" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:0.375rem;margin-top:1rem;color:var(--ds-primary);font-weight:600;font-size:0.9375rem;text-decoration:none">Get Directions →</a>
      </div>
      <div v-if="hours.length" class="rounded-2xl p-7" style="background:var(--ds-surface);border:1px solid var(--ds-border)">
        <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--ds-primary);margin-bottom:0.75rem">Hours</div>
        <ul style="list-style:none;padding:0;margin:0">
          <li v-for="(h, i) in hours" :key="i" style="color:var(--ds-text);font-size:0.9375rem;padding:0.25rem 0">{{ h }}</li>
        </ul>
      </div>
      <div v-if="phone" class="rounded-2xl p-7" style="background:var(--ds-surface);border:1px solid var(--ds-border)">
        <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--ds-primary);margin-bottom:0.75rem">Call Us</div>
        <a :href="'tel:' + phone" style="color:var(--ds-text);font-size:1.25rem;font-weight:700;text-decoration:none;font-family:var(--ds-font-heading)">{{ phone }}</a>
      </div>
    </div>
  </div>
</section>
`
}
if (typeof window !== 'undefined') window.HoursLocationSection = HoursLocationSection;
