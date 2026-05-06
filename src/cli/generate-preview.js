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

function safeSlug(s) {
  const str = String(s || '').toLowerCase();
  const core = str.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return core || 'preview';
}

async function main() {
  // Sample raw lead for local testing (edit as needed)
const rawLead = {
  business_name: "Little Oaks Smile Center",
  niche: "dentist",
  city: "Houston",
  state: "Texas",
  website_url: "riveroakssmilecenter.com",

  // Internal generation signal — NOT shown on the site
  offer_angle: "after_hours_patient_capture",

  notes: `
Weaknesses:
- Patients must call during office hours to schedule appointments
- No online appointment request option
- Insurance information is unclear
- No after-hours way for patients to contact the practice

Opportunities:
- Simple appointment request form on the website
- Insurance information and FAQs for patients
- Website chat for quick patient questions
- Ability for patients to request appointments after hours
- Modern mobile-friendly dental website
`
};

  try {
    // 1) Normalize lead
    const lead = normalizeLead(rawLead || {}, {});

    // 1b) Analyze existing website — extract site_identity and site_opportunities
    console.log('[analyze] Analyzing existing website...');
    let siteAnalysis = null;
    try {
      siteAnalysis = await analyzeSite(lead, { timeout: 12000 });
      if (siteAnalysis) {
        console.log('[analyze] site_opportunities:', siteAnalysis.site_opportunities);
      }
    } catch (analyzeErr) {
      console.warn('[analyze] Site analysis failed (non-fatal):', analyzeErr && analyzeErr.message);
    }

    // 2) Build site brief — inject analysis results
    const briefOptions = siteAnalysis ? {
      siteIdentity:      siteAnalysis.site_identity,
      siteOpportunities: siteAnalysis.site_opportunities
    } : {};
    const brief = buildSiteBrief(lead, briefOptions);

    // 3) Generate page schema using the upgrade provider (persuasive upgrade model)
    const schema = generatePageSchema(brief, { provider: 'upgrade' });

    // 4) Render to HTML with a relative asset prefix for deploy-safe output
    const html = render(schema, { assetPrefix: './' });

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

    const fileUrl = 'file://' + stored.path;
    console.log('\nPreview generated successfully');
    console.log('- Lead ID:    ', lead.lead_id);
    console.log('- Slug:       ', stored.slug);
    console.log('- File path:  ', stored.path);
    console.log('- Open URL:   ', fileUrl);

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
  } catch (err) {
    console.error('Failed to generate preview:', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
