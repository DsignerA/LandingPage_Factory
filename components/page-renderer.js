// components/page-renderer.js
// PageRenderer: Renders a page (array of section objects) using the registry.
// Schema (AI-ready):
// page: Array<{
//   id?: string,
//   type: 'hero' | 'features' | 'pricing' | string,
//   props?: object // forwarded to the target component
// }>

const PageRenderer = {
  props: {
    page: {
      type: Array,
      default: () => []
    }
  },
  computed: {
    renderList() {
      const arr = Array.isArray(this.page) ? this.page : []
      return arr.map((section, i) => {
        const type = section && section.type
        const reg = (typeof window !== 'undefined' && window.SectionRegistry)
          ? window.SectionRegistry
          : (typeof SectionRegistry !== 'undefined' ? SectionRegistry : null)
        const comp = (reg && type) ? reg[type] : null
        if (!comp) {
          try { if (typeof console !== 'undefined' && console.warn) console.warn('[PageRenderer] Unknown section type:', type) } catch (e) {}
        }
        const t = type || 'section'
        const key = (section && section.id) ? section.id : `${t}-${i}`
        // Pass the full section object so components that read `this.props.title` etc. work correctly.
        // Components that declare top-level props (title, subtitle, etc.) will also receive them via spread.
        const sectionObj = section && typeof section === 'object' ? section : {}
        const sectionProps = (sectionObj.props && typeof sectionObj.props === 'object') ? sectionObj.props : {}
        // Merge: spread section.props at top level AND pass the full section as `props` prop
        const props = Object.assign({}, sectionProps, { id: sectionObj.id, type: sectionObj.type, variant: sectionObj.variant, props: sectionProps, design: sectionObj.design || {} })
        return { key, comp, props }
      }).filter(item => !!item.comp)
    }
  },
  template: `
    <div>
      <component
        v-for="item in renderList"
        :key="item.key"
        :is="item.comp"
        v-bind="item.props"
      />
    </div>
  `
}

// Expose globally for non-module usage
if (typeof window !== 'undefined') {
  window.PageRenderer = PageRenderer
}
