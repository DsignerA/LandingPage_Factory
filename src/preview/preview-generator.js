'use strict';

// src/preview/preview-generator.js
// Preview Generator — orchestrates the complete landing page generation pipeline.
//
// Final Pipeline:
//   1.  normalizeLead         (core/lead-normalizer.js)
//   2.  resolveNichePack      (src/niches/index.js)
//   3.  buildSiteBrief        (src/data/site-brief-builder.js)
//   4.  [validate brief]      (src/engine/schema-validator.js)
//   5.  resolveDesignProfile  (src/design/design-director.js)
//   6.  generateIntentPlan    (src/design/intent-map.js)
//   7.  [validate intentPlan] (src/engine/schema-validator.js)
//   8.  resolveVariants       (src/design/variant-selector.js)
//   9.  composeScenes         (src/design/scene-composer.js)
//  10.  [validate sceneSchema](src/engine/schema-validator.js)
//  11.  generateLocalProof    (src/data/local-proof.js)
//  12.  generatePageSchema    (src/ai/ai-page-generator.js)
//  13.  applyTastePass        (src/design/taste-pass.js)
//  14.  render                (src/engine/render-engine.js)
//  15.  storePreview          (fs write)
//
// Returns: { lead, brief, design, intentPlan, sceneSchema, schema, html, preview, validationErrors }

const path = require('path');
const fs = require('fs/promises');

// Use the shared preview storage for all HTML writes. This ensures deploy-safe previews
// with assets copied and index records updated.
const { storePreview } = require('../preview/preview-storage');

// ── Core deps (always required) ────────────────────────────────────────────────
const { normalizeLead } = require('../../core/lead-normalizer');
const buildSiteBrief = require('../data/site-brief-builder');
const { generate: generatePageSchema } = require('../ai/ai-page-generator');
const { render } = require('../engine/render-engine');

// ── DESIGN.md serializer + lint gate (optional but always present) ────────────
let designMdSerializer = null;
let lintDesignMd = null;
try { designMdSerializer = require('../design/design-md'); } catch (e) { /* optional */ }
try { ({ lintDesignMd } = require('../design/design-md-lint')); } catch (e) { /* optional */ }

// ── New pipeline modules (graceful fallback if not yet present) ────────────────
let resolveNichePack, resolveDesignProfile, generateIntentPlan, resolveVariants,
    composeScenes, generateLocalProof, applyTastePass, validate;

try { ({ resolveNichePack } = require('../niches/index')); } catch (e) { resolveNichePack = () => null; }
try { ({ resolveDesignProfile } = require('../design/design-director')); } catch (e) { resolveDesignProfile = null; }
try { ({ generateIntentPlan } = require('../design/intent-map')); } catch (e) { generateIntentPlan = null; }
try { ({ resolveVariants } = require('../design/variant-selector')); } catch (e) { resolveVariants = null; }
try { ({ composeScenes } = require('../design/scene-composer')); } catch (e) { composeScenes = null; }
try { ({ generateLocalProof } = require('../data/local-proof')); } catch (e) { generateLocalProof = null; }
try { ({ applyTastePass } = require('../design/taste-pass')); } catch (e) { applyTastePass = null; }
try { ({ validate } = require('../engine/schema-validator')); } catch (e) { validate = () => ({ valid: true, errors: [] }); }

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeSlug(s) {
  const str = String(s || '').toLowerCase();
  const core = str.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return core || 'preview';
}

// Removed local storePreview implementation. Imported storePreview from preview-storage above.

// ── Main pipeline ──────────────────────────────────────────────────────────────

async function previewGenerator(rawLead, options = {}) {
  const validationErrors = [];
  const skipValidation = options.skipValidation || false;

  // ── 1. Normalize lead ──────────────────────────────────────────────────────
  const lead = normalizeLead(rawLead || {}, options.normalizer || {});

  // ── 2. Resolve niche pack ──────────────────────────────────────────────────
  const nichePack = resolveNichePack
    ? resolveNichePack(lead.niche || lead.business_type || '')
    : null;

  // ── 3. Build site brief ────────────────────────────────────────────────────
  const brief = buildSiteBrief(lead, options.brief || {});

  // ── 4. Validate brief ──────────────────────────────────────────────────────
  if (!skipValidation && validate) {
    const r = validate('brief', brief);
    if (!r.valid) validationErrors.push(...r.errors.map(e => `[brief] ${e}`));
  }

  // ── 5. Resolve design profile ──────────────────────────────────────────────
  let design = null;
  if (resolveDesignProfile) {
    try { design = resolveDesignProfile(brief, nichePack); } catch (e) { /* non-fatal */ }
  }

  // ── 6. Generate intent plan ────────────────────────────────────────────────
  let intentPlan = null;
  if (generateIntentPlan) {
    try { intentPlan = generateIntentPlan(brief, nichePack); } catch (e) { /* non-fatal */ }
  }

  // ── 7. Validate intent plan ────────────────────────────────────────────────
  if (!skipValidation && validate && intentPlan) {
    const r = validate('intentPlan', intentPlan);
    if (!r.valid) validationErrors.push(...r.errors.map(e => `[intentPlan] ${e}`));
  }

  // ── 8. Resolve variants ────────────────────────────────────────────────────
  let intentVariantPlan = null;
  if (resolveVariants && intentPlan) {
    try { intentVariantPlan = resolveVariants(intentPlan, brief, nichePack, design); } catch (e) { /* non-fatal */ }
  }

  // ── 9. Compose scenes ──────────────────────────────────────────────────────
  let sceneSchema = null;
  if (composeScenes && intentVariantPlan) {
    try { sceneSchema = composeScenes(intentVariantPlan, brief, nichePack); } catch (e) { /* non-fatal */ }
  }

  // ── 10. Validate scene schema ──────────────────────────────────────────────
  if (!skipValidation && validate && sceneSchema) {
    const r = validate('sceneSchema', sceneSchema);
    if (!r.valid) validationErrors.push(...r.errors.map(e => `[sceneSchema] ${e}`));
  }

  // ── 11. Generate local proof ───────────────────────────────────────────────
  let localProof = null;
  if (generateLocalProof) {
    try { localProof = generateLocalProof(brief, nichePack); } catch (e) { /* non-fatal */ }
  }

  // ── 12. Generate page schema (AI / noop fills section props) ──────────────
  const schemaOptions = Object.assign({}, options.schema || {});
  // Do not set sectionPlan here. When provided, the AI page generator will
  // skip generating props for sections and return an empty schema. We rely on
  // the generator's default logic to produce a content-rich schema, including
  // proper headings for dental services and other sections. Variant-specific
  // presentation decisions are handled via the scene/variant pipeline rather
  // than by forcing a section plan here.
  // if (intentVariantPlan) schemaOptions.sectionPlan = intentVariantPlan;
  if (nichePack) schemaOptions.nichePack = nichePack;
  if (localProof) schemaOptions.localProof = localProof;

  // Generate a schema using the AI generator. When scenes are available,
  // the AI generator will still enrich props for each section according to the
  // resolved intent/variant plan. We currently prefer the AI-generated schema
  // for rendering because scene schemas do not yet merge props and can drop
  // important fields like dental service headings.
  const schema = generatePageSchema(brief, schemaOptions);

  const renderSchema = schema;

  // ── 13. Taste pass ─────────────────────────────────────────────────────────
  let polishedSchema = renderSchema;
  if (applyTastePass) {
    try { polishedSchema = applyTastePass(renderSchema, brief, design); } catch (e) { polishedSchema = renderSchema; }
  }

  // ── 14. Render to HTML ─────────────────────────────────────────────────────
  const html = render(polishedSchema, {
    assetPrefix: options.assetPrefix || '../',
    brief,
    design,
    localProof,
    nichePack
  });

  // ── Custom validation for dental leads and preview completeness ───────────
  function validatePreview(leadObj, briefObj, schemaObj, htmlContent) {
    const errors = [];
    const n = String(leadObj && leadObj.niche || '').toLowerCase();
    const isDental = /(dental|dentist|orthodont|dmd|dds|tooth|teeth)/.test(n);
    // Extract number of sections. Works for both flat and scene-based schemas.
    function countSections(s) {
      if (!s) return 0;
      // Flat array schema
      if (Array.isArray(s)) return s.length;
      // Scene-based schema: count blocks
      if (s.scenes && Array.isArray(s.scenes)) {
        let count = 0;
        for (const sc of s.scenes) {
          if (sc && Array.isArray(sc.blocks)) count += sc.blocks.length;
        }
        return count;
      }
      return 0;
    }
    const sectionCount = countSections(schemaObj);
    // Validate hero title / brand name
    const brandName = (briefObj && briefObj.brand && briefObj.brand.name) ? String(briefObj.brand.name).trim() : '';
    if (isDental && (!brandName || brandName.toLowerCase() === 'your business')) {
      errors.push('Dental hero title fallback to generic');
    }
    // At least four meaningful sections
    if (isDental && sectionCount < 4) {
      errors.push('Fewer than 4 sections rendered');
    }
    // Contact/trust data should be present for dental leads
    const hasPhone = !!(leadObj && leadObj.phone);
    const hasRating = leadObj && leadObj.rating != null && leadObj.rating !== '';
    const hasReviews = leadObj && leadObj.review_count != null && leadObj.review_count !== '';
    if (isDental && (!hasPhone || (!hasRating && !hasReviews))) {
      errors.push('Missing contact or review data for dental lead');
    }
    // Unsupported section types should be flagged (render-engine silently drops them).
    (function checkUnsupported() {
      // Flatten sections (supports both array and scene-based schemas)
      function flatten(s) {
        const list = [];
        if (!s) return list;
        if (Array.isArray(s)) return s;
        if (s.scenes && Array.isArray(s.scenes)) {
          for (const sc of s.scenes) {
            if (sc && Array.isArray(sc.blocks)) {
              for (const block of sc.blocks) list.push({ type: block.type || block.intent || '', variant: block.variant });
            }
          }
        }
        return list;
      }
      const supported = new Set([
        'hero','missing-opportunities','features','pricing','services-grid','virtual-front-desk','chat-demo','reviews','insurance-info','cta','faq','how-it-works','testimonials','trust-strip','local-proof'
      ]);
      const sections = flatten(schemaObj);
      for (const s of sections) {
        const type = String((s && s.type) || '').toLowerCase();
        if (type && !supported.has(type)) {
          errors.push(`Unsupported section type: ${type}`);
        }
      }
    })();
    const valid = errors.length === 0;
    return { valid, errors, needs_review: isDental && !valid };
  }

  const previewValidation = validatePreview(lead, brief, polishedSchema, html);
  if (!previewValidation.valid) {
    // Append errors to validationErrors array
    validationErrors.push(...previewValidation.errors.map(e => `[preview] ${e}`));
  }

  // ── Write debug artifact for this lead ────────────────────────────────────
  try {
    // Flatten schema sections for debug
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
              // Attempt to derive component type from variant or intent; fallback to intent
              const v = block.variant || '';
              const intent = block.intent || '';
              // Use variant if defined, else intent
              const t = v || intent;
              if (t) list.push(String(t));
            }
          }
        }
      }
      return list;
    }
    const requestedSections = flattenSections(polishedSchema);
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
    const debugDir = path.resolve(__dirname, '..', 'storage', 'debug');
    await fs.mkdir(debugDir, { recursive: true });
    const debugPath = path.join(debugDir, `lead_${lead.lead_id}.json`);
    await fs.writeFile(debugPath, JSON.stringify(debug, null, 2), 'utf8');
  } catch (e) {
    // Ignore debug artifact errors
  }

  // ── 15. Store or skip ────────────────────────────────────────────────────
  // If the preview passed validation, write it to disk using the canonical
  // storage module. Otherwise, skip storing and return null preview. Always
  // propagate validation errors to the caller.
  let preview = null;
  let designMd = null;
  let designMdLint = null;
  if (previewValidation.valid) {
    const savePayload = {
      lead_id: lead.lead_id,
      slug: brief.slug,
      html,
      business_name: brief.brand && brief.brand.name,
      location: brief.location,
      created_at: lead.created_at,
      generator: 'preview-generator',
      schema_version: 'schema-1'
    };
    const saveOptions = Object.assign({}, { outDir: options.outDir, copyAssets: true });
    const saved = await storePreview(savePayload, saveOptions);
    const url = 'file://' + saved.path;
    preview = { ...saved, lead_id: lead.lead_id, url };

    // ── 15a. Emit DESIGN.md alongside the HTML and run the lint gate. ──────
    // The DESIGN.md describes the design decision the factory made for this
    // page. It is a side artifact for inspection / diffing — it is not used
    // to re-render the page.
    if (designMdSerializer && design) {
      try {
        const md = designMdSerializer.fromDesignProfile(design, { brief });
        const designPath = saved.path.replace(/\.html?$/i, '.design.md');
        await fs.writeFile(designPath, md, 'utf8');
        designMd = { path: designPath };

        if (lintDesignMd) {
          const report = await lintDesignMd(md);
          designMdLint = report;
          if (!report.ok) {
            previewValidation.needs_review = true;
            const errs = report.findings
              .filter((f) => f.severity === 'error')
              .map((f) => `[design.md] ${f.path || ''} ${f.message}`.trim());
            validationErrors.push(...errs);
          }
        }
      } catch (e) {
        validationErrors.push(`[design.md] failed to emit/lint: ${e.message}`);
      }
    }
  }

  return {
    lead,
    brief,
    design,
    intentPlan,
    intentVariantPlan,
    sceneSchema,
    schema: polishedSchema,
    html,
    preview,
    designMd,
    designMdLint,
    nichePack,
    localProof,
    validationErrors
  };
}

module.exports = previewGenerator;
