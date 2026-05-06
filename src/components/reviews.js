// src/components/reviews.js
// Reviews / Testimonials section — 2 layout variants
//
// Variants:
//   review_grid       – 3-column card grid with star ratings (default)
//   testimonial_cards – large featured quote cards with avatar initials
//
// All styling uses CSS variables from the design token system (--ds-*).

const ReviewsSection = {
  name: 'ReviewsSection',
  props: {
    id: { type: String, default: 'reviews' },
    type: String,
    variant: { type: String, default: 'review_grid' },
    props: { type: Object, default: () => ({}) },
    design: { type: Object, default: () => ({}) }
  },
  computed: {
    sectionId() { return this.id || 'reviews'; },
    title() { return (this.props && this.props.title) || 'What Our Customers Say'; },
    subtitle() { return (this.props && this.props.subtitle) || ''; },
    label() { return (this.props && this.props.label) || ''; },
    rawItems() { return (this.props && Array.isArray(this.props.items)) ? this.props.items : this.defaultItems; },
    defaultItems() {
      return [
        { author: 'Alicia M.', rating: 5, text: 'Friendly staff and a great experience. Highly recommend!' },
        { author: 'Jordan P.', rating: 5, text: 'They fit me in quickly and delivered outstanding results.' },
        { author: 'Sam K.', rating: 5, text: 'Clear pricing and they answered all my questions.' }
      ];
    },
    normalized() {
      return this.rawItems.map(it => {
        const author = (it && typeof it.author === 'string') ? it.author.trim() : 'Customer';
        const text = (it && typeof it.text === 'string') ? it.text.trim() : '';
        let rating = Number((it && it.rating) || 5);
        if (!Number.isFinite(rating) || rating < 1) rating = 5;
        if (rating > 5) rating = 5;
        const initials = author.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
        return { author, text, rating, initials };
      }).filter(it => it.text);
    },
    googleMapsUrl() {
      // Expose the Google Maps URL passed through props. Fallback to empty string.
      return (this.props && this.props.google_maps_url) ? this.props.google_maps_url : '';
    },
    activeVariant() {
      return (this.variant === 'testimonial_cards') ? 'testimonial_cards' : 'review_grid';
    }
  },
  methods: {
    stars(n) {
      const full = Math.round(n);
      return '★'.repeat(full) + '☆'.repeat(5 - full);
    }
  },
  template: `
    <div>
      <!-- review_grid variant -->
      <section v-if="activeVariant === 'review_grid'" class="ds-section fade-up" :id="sectionId" :data-section="sectionId">
        <div class="ds-container">
          <div style="text-align:center;margin-bottom:3rem">
            <div v-if="label" class="ds-label fade-up" style="margin-bottom:0.5rem">{{ label }}</div>
            <h2 class="ds-section-heading fade-up" style="margin-bottom:0.75rem">{{ title }}</h2>
            <p v-if="subtitle" class="ds-subheading fade-up" style="max-width:40rem;margin:0 auto">{{ subtitle }}</p>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:var(--ds-grid-gap)">
            <div v-for="(r, i) in normalized" :key="i" class="ds-card fade-up" :data-stagger-group="'reviews'">
              <div style="color:#f59e0b;font-size:1.125rem;margin-bottom:0.625rem" aria-hidden="true">{{ stars(r.rating) }}</div>
              <p style="color:var(--ds-text);line-height:1.65;margin-bottom:1rem;font-size:0.9375rem">"{{ r.text }}"</p>
              <div style="font-size:0.875rem;font-weight:600;color:var(--ds-text)">{{ r.author }}</div>
            </div>
          </div>
          <!-- Micro CTA: encourage visitors to read more reviews on Google -->
          <div v-if="googleMapsUrl" style="margin-top:1.75rem;text-align:center">
            <a :href="googleMapsUrl" target="_blank" rel="noopener" style="font-size:0.875rem;color:var(--ds-primary);text-decoration:none">Read more on Google →</a>
          </div>
        </div>
      </section>

      <!-- testimonial_cards variant -->
      <section v-else class="ds-section fade-up" :id="sectionId" :data-section="sectionId" style="background:var(--ds-surface-alt)">
        <div class="ds-container">
          <div style="text-align:center;margin-bottom:3rem">
            <div v-if="label" class="ds-label fade-up" style="margin-bottom:0.5rem">{{ label }}</div>
            <h2 class="ds-section-heading fade-up" style="margin-bottom:0.75rem">{{ title }}</h2>
            <p v-if="subtitle" class="ds-subheading fade-up" style="max-width:40rem;margin:0 auto">{{ subtitle }}</p>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(20rem,1fr));gap:var(--ds-grid-gap)">
            <div v-for="(r, i) in normalized" :key="i" class="ds-card fade-up" :data-stagger-group="'reviews'" style="display:flex;flex-direction:column;gap:1rem">
              <div style="font-size:2.5rem;color:var(--ds-primary);line-height:1;font-family:Georgia,serif;opacity:0.4">"</div>
              <p style="color:var(--ds-text);line-height:1.7;font-size:1rem;flex:1">"{{ r.text }}"</p>
              <div style="display:flex;align-items:center;gap:0.75rem;padding-top:0.75rem;border-top:1px solid var(--ds-border)">
                <div style="width:2.25rem;height:2.25rem;border-radius:9999px;background:var(--ds-primary);display:flex;align-items:center;justify-content:center;color:var(--ds-text-inverse);font-size:0.75rem;font-weight:700">{{ r.initials }}</div>
                <div>
                  <div style="font-weight:600;font-size:0.875rem;color:var(--ds-text)">{{ r.author }}</div>
                  <div style="color:#f59e0b;font-size:0.8125rem" aria-hidden="true">{{ stars(r.rating) }}</div>
                </div>
              </div>
            </div>
          </div>
          <!-- Micro CTA: encourage visitors to read more reviews on Google -->
          <div v-if="googleMapsUrl" style="margin-top:1.75rem;text-align:center">
            <a :href="googleMapsUrl" target="_blank" rel="noopener" style="font-size:0.875rem;color:var(--ds-primary);text-decoration:none">Read more on Google →</a>
          </div>
        </div>
      </section>
    </div>
  `
};

if (typeof window !== 'undefined') window.ReviewsSection = ReviewsSection;
if (typeof module !== 'undefined' && module.exports) module.exports = ReviewsSection;
