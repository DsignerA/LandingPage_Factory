// src/components/about-story.js
// About / story section — pairs a real scraped about paragraph with a real
// interior photo when available. Falls back to a niche pack tagline.

const AboutStorySection = {
  props: {
    heading:  { type: String, default: 'Our Story' },
    body:     { type: String, default: '' },
    image:    { type: String, default: '' }
  },
  computed: {
    paragraphs() {
      return String(this.body || '')
        .split(/\n{2,}|\.\s{2,}/)
        .map(p => p.trim())
        .filter(p => p.length > 20);
    }
  },
  template: `
<section id="about" class="py-20 px-6" style="background:var(--ds-surface-alt)">
  <div class="max-w-6xl mx-auto" style="display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center">
    <div v-if="image" class="w-full rounded-2xl overflow-hidden" style="aspect-ratio:4/3;background-size:cover;background-position:center;box-shadow:0 6px 32px rgba(0,0,0,0.12)" :style="{backgroundImage:'url(' + image + ')'}"></div>
    <div :style="{gridColumn: image ? 'auto' : 'span 2'}">
      <h2 class="text-3xl md:text-4xl font-bold mb-5" style="color:var(--ds-text);font-family:var(--ds-font-heading)">{{ heading }}</h2>
      <p v-for="(p, i) in paragraphs" :key="i" class="mb-4" style="color:var(--ds-text-muted);font-size:1.0625rem;line-height:1.7">{{ p }}</p>
    </div>
  </div>
</section>
`
}
if (typeof window !== 'undefined') window.AboutStorySection = AboutStorySection;
