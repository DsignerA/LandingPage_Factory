'use strict';
/**
 * html-writer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central HTML document builder for landing page previews.
 *
 * Component structure — legacy vs. canonical:
 * ─────────────────────────────────────────────────────────────────────────────
 * components/          LEGACY compatibility layer.
 *                      These files (hero.js, features.js, pricing.js, etc.) are
 *                      the original component implementations and remain in place
 *                      for backward compatibility. The registry (registry.js)
 *                      and page renderer (page-renderer.js) also live here.
 *
 * src/components/      Newer source area for components that do not yet have a
 *                      counterpart in src/ui/ (e.g. missing-opportunities.js).
 *
 * src/ui/              CANONICAL / modern component source.
 *                      Components here (hero.js, features.js, pricing.js,
 *                      missing-opportunities.js) override the legacy components/
 *                      equivalents when both are loaded, because they are loaded
 *                      after the legacy scripts and re-register the same Vue
 *                      component names with updated templates.
 *
 * Rule of thumb:
 *   - New section types → add to src/ui/ (and register in components/registry.js)
 *   - Bug fixes to existing sections → prefer src/ui/ over components/
 *   - Do NOT remove components/ entries without verifying no external callers
 *     depend on them directly (e.g. standalone HTML files, tests).
 *
 * Other responsibilities of this file:
 *   - Injects design-system.css
 *   - Loads component scripts, registry, and PageRenderer wiring
 *   - Wraps each section render inside <section class="section fade-up"><div class="container">
 */

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function writeHtml({ title, schemaJson, assetPrefix }) {
  const tp = (p) => assetPrefix + p.replace(/^\.\/?/, '');
  const docTitle = title ? htmlEscape(title) : 'Preview';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle}</title>
  <link rel="stylesheet" href="${tp('src/styles/design-system.css')}">
  <script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white text-zinc-900 bg-soft-gradient">
  <div id="app" class="min-h-screen">
    <div class="container section" style="padding-top:48px; padding-bottom:0;">
      <p class="text-sm text-zinc-500">Preview</p>
    </div>
    <ds-page-renderer :page="pageSections"></ds-page-renderer>
  </div>

  <!-- Components used by supported section types -->
  <script src="${tp('components/hero.js')}"></script>
  <script src="${tp('components/features.js')}"></script>
  <script src="${tp('components/pricing.js')}"></script>
  <script src="${tp('src/components/missing-opportunities.js')}"></script>
  <script src="${tp('components/faq.js')}"></script>
  <script src="${tp('components/cta.js')}"></script>
  <script src="${tp('components/testimonials.js')}"></script>
  <script src="${tp('components/how-it-works.js')}"></script>
  <script src="${tp('components/footer.js')}"></script>

  <!-- UI templates (override component templates for modern layouts) -->
  <script src="${tp('src/ui/hero.js')}"></script>
  <script src="${tp('src/ui/features.js')}"></script>
  <script src="${tp('src/ui/pricing.js')}"></script>
  <script src="${tp('src/ui/missing-opportunities.js')}"></script>

  <!-- Registry and Renderer -->
  <script src="${tp('components/registry.js')}"></script>
  <script src="${tp('components/page-renderer.js')}"></script>

  <!-- Minimal wrapper renderer to enforce section/container structure -->
  <script>
    const DSPageRenderer = {
      props: { page: { type: Array, default: () => [] } },
      computed: {
        renderList() {
          const arr = Array.isArray(this.page) ? this.page : [];
          return arr.map((section, i) => {
            const type = section && section.type;
            const reg = (typeof window !== 'undefined' && window.SectionRegistry)
              ? window.SectionRegistry
              : (typeof SectionRegistry !== 'undefined' ? SectionRegistry : null);
            const comp = (reg && type) ? reg[type] : null;
            if (!comp) {
              try { if (typeof console !== 'undefined' && console.warn) console.warn('[DSPageRenderer] Unknown section type:', type) } catch (e) {}
            }
            const t = type || 'section';
            const key = (section && section.id) ? section.id : (t + '-' + i);
            const props = (section && section.props && typeof section.props === 'object') ? section.props : {};
            return { key, comp, props };
          }).filter(item => !!item.comp);
        }
      },
      // The page renderer wraps each component without adding extra section or container elements.
      // Each component (e.g., hero, features) is responsible for its own ds-section wrapper and spacing.
      template: `
        <div>
          <component v-for="item in renderList" :key="item.key"
            :is="item.comp" v-bind="item.props" />
        </div>
      `
    };

    // Mount
    window.pageSections = ${schemaJson};
    const app = Vue.createApp({ data() { return { pageSections: window.pageSections || [] }; } });
    app.component('ds-page-renderer', DSPageRenderer);
    app.component('page-renderer', PageRenderer);
    app.mount('#app');
  </script>
</body>
</html>`;
}

module.exports = { writeHtml };
