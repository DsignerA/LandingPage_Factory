#!/usr/bin/env node
'use strict';

// Preview worker that continuously processes jobs from the JSONL queue
// Upgraded pipeline per job:
//   normalizeLead -> analyzeSite -> buildSiteBrief -> generatePageSchema (upgrade) -> render -> store
// Implements the full 10-step persuasive upgrade model.

const { normalizeLead } = require('../../core/lead-normalizer');
const buildSiteBrief = require('../data/site-brief-builder');
const { generate: generatePageSchema } = require('../ai/ai-page-generator');
const { render } = require('../engine/render-engine');
const { storePreview } = require('../preview/preview-storage');
const { analyzeSite } = require('../data/site-analyzer');
const queue = require('../jobs/preview-queue');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function processJob(job, options = {}) {
  const payload = job && job.payload ? job.payload : {};
  const rawLead = payload.rawLead || payload.lead || payload || {};

  try {
    const lead = normalizeLead(rawLead, {});

    // Analyze existing website (non-fatal)
    let siteAnalysis = null;
    try {
      siteAnalysis = await analyzeSite(lead, { timeout: 10000 });
    } catch (e) {
      // ignore
    }

    const briefOptions = siteAnalysis ? {
      siteIdentity:      siteAnalysis.site_identity,
      siteOpportunities: siteAnalysis.site_opportunities
    } : {};
    const brief = buildSiteBrief(lead, briefOptions);
    const schema = generatePageSchema(brief, { provider: 'upgrade' });

    // Render HTML. Use a relative asset prefix so that assets live alongside the preview file.
    // When stored, storePreview will copy all referenced assets into the preview directory.
    const html = render(schema, { assetPrefix: './' });

    const saved = await storePreview({
      lead_id: lead.lead_id,
      slug: brief.slug,
      html,
      business_name: brief.brand && brief.brand.name,
      location: brief.location,
      created_at: lead.created_at,
      generator: 'upgrade',
      schema_version: 'schema-1'
    }, {
      copyAssets: true
    });

    await queue.markCompleted(job.job_id, { preview: saved, briefSlug: brief.slug });
    console.log(`[done] job=${job.job_id} slug=${saved.slug}`);
  } catch (err) {
    await queue.markFailed(job.job_id, err);
    console.error(`[fail] job=${job.job_id} err=${(err && err.message) || err}`);
  }
}

async function startWorker(options = {}) {
  const pollMs = Number(options.pollMs || process.env.JOB_POLL_MS || 1000);
  console.log(`[worker] preview-worker started (poll=${pollMs}ms)`);

  while (true) {
    const job = await queue.getNextJob();
    if (!job) {
      await sleep(pollMs);
      continue;
    }
    console.log(`[work] job=${job.job_id} status=${job.status}`);
    await processJob(job, options);
  }
}

module.exports = { startWorker };

if (require.main === module) {
  startWorker().catch(err => {
    console.error('Worker crashed:', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
}
