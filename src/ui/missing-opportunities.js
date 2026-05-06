(function(){
  if (typeof window === 'undefined') return;
  window.UITemplates = window.UITemplates || {};
  window.UITemplates.missing = `
    <div>
      <h2 class="h2 mb-4">{{ title }}</h2>
      <ul class="list-disc pl-6 space-y-2">
        <li v-for="(item, i) in list" :key="i" class="body text-zinc-800">{{ item }}</li>
      </ul>
    </div>
  `;
  if (typeof MissingOpportunitiesSection !== 'undefined') {
    try { MissingOpportunitiesSection.template = window.UITemplates.missing; } catch (e) {}
  }
})();
