#!/usr/bin/env node
'use strict';

// Minimal CLI to generate a preview HTML using existing modules.
// Pipeline:
//   normalizeLead(rawLead)
//   -> buildSiteBrief(lead)
//   -> generatePageSchema(brief)
//   -> render(schema)
//   -> store({ lead_id, slug, html })
// Logs the preview URL and file path. Intended for local testing and simple integrations.
//
// Assumptions:
// - Node.js environment can write to ./previews
// - The generated HTML will be opened locally; component scripts are referenced relatively
// - For production use, integrate with your own storage/CDN as needed

const path = require('path');
const fs = require('fs/promises');

const { normalizeLead } = require('../../core/lead-normalizer');
const buildSiteBrief = require('../data/site-brief-builder');
const { generate: generatePageSchema } = require('../ai/ai-page-generator');
const { render } = require('../engine/render-engine');
const { storePreview } = require('../preview/preview-storage');
const { analyzeSite } = require('../data/site-analyzer');
const { enrichWithPlaces } = require('../data/places-enrich');
const { localizeImagesInHtml } = require('../data/localize-assets');
const { rewriteCopyInVoice }   = require('../ai/providers/llm-rewrite');
const { generateImage, buildHeroPrompt, buildCardPrompt, DEFAULT_MODEL: IMAGE_MODEL }
  = require('../ai/providers/openai-image-gen');
const { generateArtifact: odGenerate } = require('../data/open-design-bridge');
const { scorePreview } = require('../data/vision-qa');
const crypto = require('crypto');

function safeSlug(s) {
  const str = String(s || '').toLowerCase();
  const core = str.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return core || 'preview';
}

const SAMPLE_LEAD = {
  business_name: "Bookbinders",
  niche: "restaurant",
  city: "Richmond",
  state: "Virginia",
  website_url: "bookbindersrichmond.com",
  offer_angle: "online_reservations_and_modern_menu"
};

/**
 * Run the full agentic pipeline against a single raw lead. Returns
 * { slug, leadId, htmlPath, provider, qaScore } on success.
 * Throws on hard failures so the batch runner can record them.
 *
 * Suitable for importing from src/cli/run-batch.js — does not call
 * process.exit().
 */
async function runPreviewFor(rawLead) {
    // 1) Normalize lead
    const lead = normalizeLead(rawLead || {}, {});

    // 1b) Analyze existing website — extract site_identity and site_opportunities
    console.log('[analyze] Analyzing existing website...');
    let siteAnalysis = null;
    try {
      siteAnalysis = await analyzeSite(lead, { timeout: 12000 });
      if (siteAnalysis) {
        console.log('[analyze] site_opportunities:', siteAnalysis.site_opportunities);
        console.log('[analyze] site_identity:', siteAnalysis.site_identity);
      }
    } catch (analyzeErr) {
      console.warn('[analyze] Site analysis failed (non-fatal):', analyzeErr && analyzeErr.message);
    }

    // 1c) Optional: Google Places fallback. Only runs when an API key is set
    //     AND the JSON-LD scrape missed (no reviews extracted). For most modern
    //     restaurant sites the JSON-LD path covers rating + reviews + hours for
    //     free, so this is rarely needed.
    let placesData = null;
    const jsonLdHasReviews = !!(siteAnalysis && siteAnalysis.site_identity && siteAnalysis.site_identity.jsonLd && Array.isArray(siteAnalysis.site_identity.jsonLd.reviews) && siteAnalysis.site_identity.jsonLd.reviews.length);
    if (process.env.GOOGLE_MAPS_API_KEY && !jsonLdHasReviews) {
      try {
        placesData = await enrichWithPlaces(lead);
        if (placesData) {
          console.log('[places] rating:', placesData.rating, 'reviews:', placesData.review_count, 'hours:', placesData.hoursWeekday.length ? 'yes' : 'no');
        } else {
          console.log('[places] no match for', lead.business_name);
        }
      } catch (placesErr) {
        console.warn('[places] enrichment failed (non-fatal):', placesErr && placesErr.message);
      }
    } else if (jsonLdHasReviews) {
      console.log('[places] skipped — JSON-LD already provided', siteAnalysis.site_identity.jsonLd.reviews.length, 'reviews');
    } else {
      console.log('[places] skipped (no GOOGLE_MAPS_API_KEY and no JSON-LD)');
    }

    // 2) Build site brief — inject analysis + places results
    const briefOptions = {
      siteIdentity:      siteAnalysis ? siteAnalysis.site_identity : null,
      siteOpportunities: siteAnalysis ? siteAnalysis.site_opportunities : null,
      placesData
    };
    const brief = buildSiteBrief(lead, briefOptions);

    // 2b) Optional: fill missing brand imagery with OpenAI gpt-image-2.
    //     Only fires when OPENAI_API_KEY is set AND the scrape couldn't give us
    //     a real photo. Generated images are cached by prompt hash so reruns
    //     reuse them — keeps the cost predictable.
    if (process.env.OPENAI_API_KEY && process.env.LANDING_BUILDER_SKIP_IMAGE_GEN !== '1') {
      const previewsRoot = path.resolve(process.cwd(), 'previews');
      const assetsDir    = path.join(previewsRoot, `${brief.slug}.assets`);
      await fs.mkdir(assetsDir, { recursive: true });

      async function fillFromPrompt(prompt, label) {
        const key = crypto.createHash('sha1').update(IMAGE_MODEL + '|' + prompt).digest('hex').slice(0, 16);
        const file = path.join(assetsDir, `gen-${label}-${key}.png`);
        try { await fs.access(file); return `./${brief.slug}.assets/gen-${label}-${key}.png`; }
        catch (e) { /* not cached, generate */ }
        const buf = await generateImage({ prompt, size: '1536x1024', quality: 'high' });
        if (!buf) return null;
        await fs.writeFile(file, buf);
        console.log(`[image-gen] ${label} → previews/${brief.slug}.assets/gen-${label}-${key}.png (${(buf.length / 1024).toFixed(0)}kb)`);
        return `./${brief.slug}.assets/gen-${label}-${key}.png`;
      }

      // Hero: only if scraping produced nothing or only a generic Unsplash stock.
      const heroIsStock = brief.brand && brief.brand.heroImageUrl &&
        /images\.unsplash\.com/.test(brief.brand.heroImageUrl);
      const heroMissing = !brief.brand || !brief.brand.heroImageUrl;
      if (heroMissing || heroIsStock) {
        const heroLocal = await fillFromPrompt(buildHeroPrompt(brief), 'hero');
        if (heroLocal) brief.brand.heroImageUrl = heroLocal;
      }

      // Card images: top up the scraped library so the services-grid has at
      // least 4 usable photos. We synthesize from the first N service titles
      // we already know about (filtered for nav noise).
      const lib = (brief.siteIdentity && Array.isArray(brief.siteIdentity.imageLibrary))
        ? brief.siteIdentity.imageLibrary : [];
      const usableScraped = lib.filter(o => o && o.category && /food|generic|interior/.test(o.category));
      if (usableScraped.length < 4) {
        const packCopy = (brief.nichePack && brief.nichePack.copy) || {};
        const candidateTopics = (packCopy.services || [])
          .map(s => s && s.title).filter(Boolean).slice(0, 4 - usableScraped.length);
        for (const topic of candidateTopics) {
          const url = await fillFromPrompt(buildCardPrompt(brief, topic), 'card-' + topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24));
          if (url) {
            brief.siteIdentity = brief.siteIdentity || {};
            brief.siteIdentity.imageLibrary = brief.siteIdentity.imageLibrary || [];
            brief.siteIdentity.imageLibrary.push({ src: url, w: 1536, h: 1024, alt: topic, ctx: 'generated', category: 'food' });
          }
        }
      }
    }

    // 3) Generate the page. Primary path: drive open-design's daemon
    //    (an agent CLI on PATH composes the HTML against the picked design
    //    system + skill). Fallback path: the deterministic upgrade provider.
    //    Override which path runs with LANDING_BUILDER_PROVIDER=upgrade|od|auto
    //    (default: 'auto' — open-design first, deterministic on failure).
    const providerMode = (process.env.LANDING_BUILDER_PROVIDER || 'auto').toLowerCase();
    const qaEnabled = process.env.LANDING_BUILDER_QA_ENABLED === '1' && !!process.env.ANTHROPIC_API_KEY;
    const qaThreshold = parseFloat(process.env.LANDING_BUILDER_QA_THRESHOLD || '7');
    const qaMaxRetries = Math.max(0, parseInt(process.env.LANDING_BUILDER_QA_MAX_RETRIES || '3', 10));
    let html = null;
    let schema = null;        // populated only on the deterministic fallback path
    let usedProvider = null;
    let qaScoreHistory = [];  // records every attempt: { score, designSystem, ... }

    // Helper: rebuild the brief with a different variantIndex so the next
    // try picks a new design system + hero variant + section order from the
    // niche pack's pool. Used for QA-driven retry.
    function rebuildBriefWithVariant(idx) {
      return buildSiteBrief(lead, Object.assign({}, briefOptions, { variantIndex: idx }));
    }

    if (providerMode === 'od' || providerMode === 'auto') {
      let attemptBrief = brief;
      const maxAttempts = qaEnabled ? (1 + qaMaxRetries) : 1;
      let attempt = 0;

      while (attempt < maxAttempts && !html) {
        const variantLabel = attempt === 0 ? 'initial' : `retry ${attempt}/${qaMaxRetries}`;
        console.log(`[od-bridge] attempting agentic generation (${variantLabel})...`);
        const odResult = await odGenerate(attemptBrief, { verbose: true });
        if (!odResult || !odResult.html) {
          if (providerMode === 'od') throw new Error('open-design generation failed and LANDING_BUILDER_PROVIDER=od');
          console.log('[od-bridge] no artifact — falling back to deterministic upgrade provider');
          break;
        }

        // We have a candidate artifact. If QA is disabled, accept it.
        if (!qaEnabled) {
          html = odResult.html;
          usedProvider = `od:${odResult.agentId}/${odResult.skillId}/${odResult.designSystemId || 'none'}`;
          console.log('[od-bridge] artifact captured (' + (odResult.html.length / 1024).toFixed(1) + 'kb) via', usedProvider);
          break;
        }

        // QA enabled — write the candidate to a temp file, screenshot it,
        // score it. Accept if score >= threshold; otherwise try the next
        // variantIndex from the pool.
        const tempDir = path.resolve(process.cwd(), 'previews', `${attemptBrief.slug}.qa-tmp`);
        const assetsDir = path.resolve(process.cwd(), 'previews', `${attemptBrief.slug}.assets`);
        await fs.mkdir(tempDir, { recursive: true });
        await fs.mkdir(assetsDir, { recursive: true });
        const candidateHtml = path.join(tempDir, `attempt-${attempt}.html`);
        await fs.writeFile(candidateHtml, odResult.html, 'utf8');
        const ourPng = path.join(tempDir, `attempt-${attempt}.png`);
        const leadPng = path.join(assetsDir, 'lead-site.png');

        // Capture lead-site.png on first attempt if not already present
        try { await fs.access(leadPng); } catch {
          if (lead.website_url) {
            try {
              const { chromium } = require('playwright');
              const browser = await chromium.launch({ headless: true });
              try {
                const ctx = await browser.newContext({
                  viewport: { width: 1440, height: 900 },
                  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                  deviceScaleFactor: 2
                });
                const p = await ctx.newPage();
                await p.goto(lead.website_url, { waitUntil: 'domcontentloaded', timeout: 25000 });
                try { await p.waitForLoadState('networkidle', { timeout: 6000 }); } catch {}
                await p.waitForTimeout(1200);
                await p.screenshot({ path: leadPng, fullPage: true });
              } finally { await browser.close(); }
            } catch (err) {
              console.warn('[qa] lead screenshot failed (non-fatal):', err.message);
            }
          }
        }

        try {
          const { chromium } = require('playwright');
          const browser = await chromium.launch({ headless: true });
          const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
          const p = await ctx.newPage();
          await p.goto('file://' + candidateHtml, { waitUntil: 'domcontentloaded' });
          try { await p.waitForLoadState('networkidle', { timeout: 6000 }); } catch {}
          await p.waitForTimeout(800);
          await p.screenshot({ path: ourPng, fullPage: true });
          await browser.close();
        } catch (err) {
          console.warn('[qa] screenshot failed (non-fatal):', err.message);
        }

        let qa = null;
        try {
          qa = await scorePreview({ leadPng, ourPng });
        } catch (err) {
          console.warn('[qa] scoring failed (non-fatal):', err.message);
        }

        const dsName = (attemptBrief.designSystem && attemptBrief.designSystem.name) || odResult.designSystemId || 'none';
        const score  = qa && qa.average;
        qaScoreHistory.push({ attempt, designSystem: dsName, score, suggest: qa && qa.suggest });
        console.log(`[qa] attempt ${attempt} (${dsName}): average ${score != null ? score.toFixed(2) : 'n/a'} / threshold ${qaThreshold}` +
          (qa && qa.suggest ? ` · top suggestion: ${qa.suggest.slice(0, 120)}` : ''));

        if (score == null || score >= qaThreshold) {
          html = odResult.html;
          usedProvider = `od:${odResult.agentId}/${odResult.skillId}/${odResult.designSystemId || 'none'}` +
            (score != null ? ` (qa ${score.toFixed(1)})` : '');
          console.log('[od-bridge] artifact accepted via', usedProvider);
          break;
        }

        // Score below threshold — rebuild brief with the next variantIndex.
        attempt++;
        if (attempt < maxAttempts) {
          attemptBrief = rebuildBriefWithVariant(attempt);
          const nextDs = attemptBrief.designSystem && attemptBrief.designSystem.name;
          console.log(`[qa] regenerating with design system "${nextDs}"`);
        } else {
          // Out of retries — accept the latest candidate anyway.
          html = odResult.html;
          usedProvider = `od:${odResult.agentId}/${odResult.skillId}/${odResult.designSystemId || 'none'} (qa ${(score || 0).toFixed(1)}, retries exhausted)`;
          console.log('[od-bridge] retry budget exhausted, accepting last candidate via', usedProvider);
        }
      }
    }

    if (!html) {
      schema = generatePageSchema(brief, { provider: 'upgrade' });
      // Optional: rewrite hero copy in the brand's voice using an LLM.
      const rewriteResult = await rewriteCopyInVoice(schema, brief);
      if (rewriteResult && rewriteResult.rewrote) {
        console.log('[llm-rewrite] hero copy rewritten with', rewriteResult.model);
      } else if (rewriteResult && rewriteResult.skipped && rewriteResult.skipped !== 'no ANTHROPIC_API_KEY') {
        console.log('[llm-rewrite] skipped:', rewriteResult.skipped);
      } else if (rewriteResult && rewriteResult.error) {
        console.warn('[llm-rewrite] failed (non-fatal):', rewriteResult.error);
      }
      // Render to HTML. Brief MUST be passed so the renderer picks the right
      // design theme (heroVariant, palette, motion).
      html = render(schema, { assetPrefix: './', brief });
      usedProvider = 'upgrade';
    }

    // 4b) Localize scraped images so previews don't break when source CDNs
    //     change or add hotlink protection. Non-fatal — if a download fails
    //     the original URL stays in the HTML.
    if (process.env.LANDING_BUILDER_SKIP_LOCALIZE !== '1') {
      try {
        const previewsRoot = path.resolve(process.cwd(), 'previews');
        const extraUrls = [
          brief.brand && brief.brand.heroImageUrl,
          brief.brand && brief.brand.logoUrl,
          ...((brief.siteIdentity && Array.isArray(brief.siteIdentity.imageLibrary))
            ? brief.siteIdentity.imageLibrary.map(i => i && i.src)
            : [])
        ].filter(Boolean);
        const result = await localizeImagesInHtml(html, previewsRoot, brief.slug, extraUrls);
        html = result.html;
        if (result.downloaded > 0) {
          console.log(`[localize] downloaded ${result.downloaded} images to previews/${brief.slug}.assets/`);
        }
      } catch (locErr) {
        console.warn('[localize] failed (non-fatal):', locErr && locErr.message);
      }
    }

    // 5) Store using preview-storage, copying required assets
    const saveDir = path.resolve(process.cwd(), 'previews');
    const stored = await storePreview({
      lead_id: lead.lead_id,
      slug: brief.slug,
      html,
      business_name: brief.brand && brief.brand.name,
      location: brief.location,
      created_at: lead.created_at,
      generator: 'noop',
      schema_version: 'schema-1'
    }, { outDir: saveDir, copyAssets: true });

    // Persist QA history (if any) so the approval queue can surface scores
    if (qaScoreHistory.length) {
      try {
        const qaPath = path.join(path.resolve(process.cwd(), 'previews'), `${stored.slug}.qa.json`);
        await fs.writeFile(qaPath, JSON.stringify({
          slug: stored.slug,
          provider: usedProvider,
          threshold: qaThreshold,
          attempts: qaScoreHistory
        }, null, 2), 'utf8');
        // Clean up the qa-tmp dir; keep only the final accepted artifact
        await fs.rm(path.resolve(process.cwd(), 'previews', `${stored.slug}.qa-tmp`), { recursive: true, force: true });
      } catch (err) {
        console.warn('[qa] failed to persist history (non-fatal):', err.message);
      }
    }

    const fileUrl = 'file://' + stored.path;
    console.log('\nPreview generated successfully');
    console.log('- Lead ID:    ', lead.lead_id);
    console.log('- Slug:       ', stored.slug);
    console.log('- Provider:   ', usedProvider);
    console.log('- File path:  ', stored.path);
    console.log('- Open URL:   ', fileUrl);

    // Pipeline artifact: screenshot the lead's live website so the sales packet
    // always has a visual baseline next to the generated preview. Non-fatal.
    try {
      if (lead.website_url) {
        const { chromium } = require('playwright');
        const screenshotDir = path.resolve(process.cwd(), 'previews', `${stored.slug}.assets`);
        await fs.mkdir(screenshotDir, { recursive: true });
        const leadPng = path.join(screenshotDir, 'lead-site.png');
        const browser = await chromium.launch({ headless: true });
        try {
          const ctx = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            deviceScaleFactor: 2
          });
          const p = await ctx.newPage();
          await p.goto(lead.website_url, { waitUntil: 'domcontentloaded', timeout: 25000 });
          try { await p.waitForLoadState('networkidle', { timeout: 6000 }); } catch (e) {}
          await p.waitForTimeout(1200);
          await p.screenshot({ path: leadPng, fullPage: true });
          console.log('- Lead shot: ', leadPng);
        } finally {
          await browser.close();
        }
      }
    } catch (shotErr) {
      console.warn('[screenshot] failed for lead site:', shotErr && shotErr.message);
    }

    // Perform validation and write debug artifact for this lead
    function validatePreview(leadObj, briefObj, schemaObj) {
      const errors = [];
      const n = String(leadObj && leadObj.niche || '').toLowerCase();
      const isDental = /(dental|dentist|orthodont|dmd|dds|tooth|teeth)/.test(n);
      function countSections(s) {
        if (!s) return 0;
        if (Array.isArray(s)) return s.length;
        if (s.scenes && Array.isArray(s.scenes)) {
          let c = 0;
          for (const sc of s.scenes) {
            if (sc && Array.isArray(sc.blocks)) c += sc.blocks.length;
          }
          return c;
        }
        return 0;
      }
      const sectionCount = countSections(schemaObj);
      const brandName = (briefObj && briefObj.brand && briefObj.brand.name) ? String(briefObj.brand.name).trim() : '';
      if (isDental && (!brandName || brandName.toLowerCase() === 'your business')) {
        errors.push('Dental hero title fallback to generic');
      }
      if (isDental && sectionCount < 4) {
        errors.push('Fewer than 4 sections rendered');
      }
      const hasPhone = !!(leadObj && leadObj.phone);
      const hasRating = leadObj && leadObj.rating != null && leadObj.rating !== '';
      const hasReviews = leadObj && leadObj.review_count != null && leadObj.review_count !== '';
      if (isDental && (!hasPhone || (!hasRating && !hasReviews))) {
        errors.push('Missing contact or review data for dental lead');
      }
      const valid = errors.length === 0;
      return { valid, errors, needs_review: isDental && !valid };
    }

    function flattenSections(s) {
      const list = [];
      if (!s) return list;
      if (Array.isArray(s)) {
        for (const sec of s) {
          if (sec && sec.type) list.push(String(sec.type));
        }
        return list;
      }
      if (s.scenes && Array.isArray(s.scenes)) {
        for (const sc of s.scenes) {
          if (sc && Array.isArray(sc.blocks)) {
            for (const block of sc.blocks) {
              const v = block.variant || '';
              const intent = block.intent || '';
              const t = v || intent;
              if (t) list.push(String(t));
            }
          }
        }
      }
      return list;
    }
    const previewValidation = validatePreview(lead, brief, schema);
    const requestedSections = flattenSections(schema);
    const renderedSections = requestedSections.slice();
    const briefSummary = {
      slug: brief.slug,
      brand: brief.brand,
      niche: brief.niche,
      location: brief.location,
      contact: brief.contact,
      trust: brief.trust,
      audit: brief.audit
    };
    const debug = {
      lead,
      brief: briefSummary,
      requested_sections: requestedSections,
      rendered_sections: renderedSections,
      validation: previewValidation
    };
    try {
      const debugDir = path.resolve(__dirname, '..', 'storage', 'debug');
      await fs.mkdir(debugDir, { recursive: true });
      const debugPath = path.join(debugDir, `lead_${lead.lead_id}.json`);
      await fs.writeFile(debugPath, JSON.stringify(debug, null, 2), 'utf8');
      if (!previewValidation.valid) {
        console.warn('[preview] Validation warnings for lead', lead.lead_id, ':', previewValidation.errors.join('; '));
      }
    } catch (err) {
      // Ignore debug artifact errors in CLI
    }

  // Final return for batch consumers
  return {
    leadId: lead.lead_id,
    slug: stored.slug,
    htmlPath: stored.path,
    provider: usedProvider,
    qa: qaScoreHistory.length ? qaScoreHistory[qaScoreHistory.length - 1] : null,
    brief: {
      brand: brief.brand,
      niche: brief.niche,
      location: brief.location,
      designSystem: brief.designSystem ? { name: brief.designSystem.name, title: brief.designSystem.title } : null
    }
  };
}

async function main() {
  try {
    await runPreviewFor(SAMPLE_LEAD);
  } catch (err) {
    console.error('Failed to generate preview:', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { runPreviewFor, SAMPLE_LEAD };
