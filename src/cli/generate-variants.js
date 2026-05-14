#!/usr/bin/env node
'use strict';

// generate-variants.js
// Runs the preview pipeline N times for the same lead with different
// variantIndex overrides, so the niche pack's variation pools generate
// visibly distinct layouts. Writes each as previews/{slug}-vN.html and a
// comparison index page (previews/{slug}.variants.html) that iframes all
// variants side-by-side.
//
// Usage: node src/cli/generate-variants.js [variantCount]   (default 3)
//
// Reads the same hardcoded sample lead as generate-preview.js. Replace this
// with a CLI flag or a CSV-driven runner for production.

const path = require('path');
const fs = require('fs/promises');

const { normalizeLead } = require('../../core/lead-normalizer');
const buildSiteBrief    = require('../data/site-brief-builder');
const { generate: generatePageSchema } = require('../ai/ai-page-generator');
const { render }        = require('../engine/render-engine');
const { analyzeSite }   = require('../data/site-analyzer');
const { enrichWithPlaces } = require('../data/places-enrich');
const { localizeImagesInHtml } = require('../data/localize-assets');

function htmlEscape(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function main() {
  const variantCount = parseInt(process.argv[2], 10) || 3;

  // Same sample lead as generate-preview.js. Customize per-call when wiring
  // this into a real lead pipeline.
  const rawLead = {
    business_name: 'Bookbinders',
    niche: 'restaurant',
    city: 'Richmond',
    state: 'Virginia',
    website_url: 'bookbindersrichmond.com',
    offer_angle: 'online_reservations_and_modern_menu'
  };

  const lead = normalizeLead(rawLead, {});

  // Site analysis runs once (cache-able). Reused for every variant.
  console.log('[variants] running site analysis once for', lead.business_name);
  let siteAnalysis = null;
  try { siteAnalysis = await analyzeSite(lead, { timeout: 12000 }); }
  catch (e) { console.warn('[variants] site analysis failed:', e && e.message); }

  let placesData = null;
  const jsonLdHasReviews = !!(siteAnalysis && siteAnalysis.site_identity && siteAnalysis.site_identity.jsonLd && Array.isArray(siteAnalysis.site_identity.jsonLd.reviews) && siteAnalysis.site_identity.jsonLd.reviews.length);
  if (process.env.GOOGLE_MAPS_API_KEY && !jsonLdHasReviews) {
    try { placesData = await enrichWithPlaces(lead); } catch (e) {}
  }

  const previewsRoot = path.resolve(process.cwd(), 'previews');
  await fs.mkdir(previewsRoot, { recursive: true });

  const briefBase = {
    siteIdentity:      siteAnalysis ? siteAnalysis.site_identity : null,
    siteOpportunities: siteAnalysis ? siteAnalysis.site_opportunities : null,
    placesData
  };

  const variantPaths = [];
  for (let i = 0; i < variantCount; i++) {
    const briefOptions = Object.assign({}, briefBase, { variantIndex: i });
    const brief = buildSiteBrief(lead, briefOptions);
    const schema = generatePageSchema(brief, { provider: 'upgrade' });
    let html = render(schema, { assetPrefix: './', brief });

    if (process.env.LANDING_BUILDER_SKIP_LOCALIZE !== '1') {
      try {
        const extraUrls = [
          brief.brand && brief.brand.heroImageUrl,
          brief.brand && brief.brand.logoUrl,
          ...((brief.siteIdentity && Array.isArray(brief.siteIdentity.imageLibrary))
            ? brief.siteIdentity.imageLibrary.map(im => im && im.src)
            : [])
        ].filter(Boolean);
        const result = await localizeImagesInHtml(html, previewsRoot, brief.slug, extraUrls);
        html = result.html;
      } catch (e) {}
    }

    const fileName = `${brief.slug}-v${i}.html`;
    const filePath = path.join(previewsRoot, fileName);
    await fs.writeFile(filePath, html, 'utf8');
    variantPaths.push({ fileName, brief, theme: brief.theme });
    console.log(`[variants] v${i} → ${fileName}  (hero:${brief.theme.heroStyle}, accent:${brief.theme.accentStyle}, bg:${brief.theme.backgroundEffect})`);
  }

  // Build comparison index page.
  const indexName = `${lead.slug}.variants.html`;
  const indexPath = path.join(previewsRoot, indexName);
  const cards = variantPaths.map((v, i) => `
    <article>
      <header>
        <h2>v${i}</h2>
        <dl>
          <dt>Hero</dt><dd>${htmlEscape(v.theme.heroStyle)}</dd>
          <dt>Accent</dt><dd>${htmlEscape(v.theme.accentStyle)}</dd>
          <dt>BG</dt><dd>${htmlEscape(v.theme.backgroundEffect)}</dd>
          <dt>Card</dt><dd>${htmlEscape(v.theme.cardStyle)}</dd>
        </dl>
        <a href="${htmlEscape(v.fileName)}" target="_blank">Open ↗</a>
      </header>
      <iframe src="${htmlEscape(v.fileName)}" loading="lazy"></iframe>
    </article>
  `).join('\n');

  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${htmlEscape(lead.business_name)} — Variant Comparison</title>
  <style>
    :root { --bg: #0f172a; --surface: #1e293b; --text: #e2e8f0; --muted: #94a3b8; --accent: #f59e0b; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, -apple-system, sans-serif; padding: 1.5rem; }
    h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
    .sub { color: var(--muted); margin-bottom: 1.5rem; }
    main { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1rem; }
    article { background: var(--surface); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; min-height: 80vh; }
    header { padding: 0.875rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    header h2 { font-size: 1rem; margin: 0; color: var(--accent); }
    dl { display: flex; gap: 0.875rem; margin: 0; font-size: 0.75rem; color: var(--muted); flex-wrap: wrap; }
    dl dt { font-weight: 600; color: var(--text); }
    dl dt::after { content: ':'; }
    dl dd { margin: 0; margin-right: 0.5rem; }
    header a { margin-left: auto; color: var(--accent); text-decoration: none; font-weight: 600; font-size: 0.8125rem; }
    iframe { flex: 1; border: 0; width: 100%; background: white; }
  </style>
</head>
<body>
  <h1>${htmlEscape(lead.business_name)} — variant comparison</h1>
  <div class="sub">${htmlEscape(lead.location)} · ${variantCount} variants generated from the niche pack's variation pools</div>
  <main>
    ${cards}
  </main>
</body>
</html>`;

  await fs.writeFile(indexPath, indexHtml, 'utf8');
  console.log(`\n[variants] index → ${indexPath}`);
  console.log(`[variants] open: file://${indexPath}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('[variants] failed:', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
}
