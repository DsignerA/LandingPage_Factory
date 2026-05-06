'use strict';

const assert = require('assert');
const fs = require('fs/promises');
const path = require('path');

const { normalizeLead } = require('../../../core/lead-normalizer');
const buildSiteBrief = require('../../data/site-brief-builder');
const { generate: generatePageSchema } = require('../../ai/ai-page-generator');
const { render } = require('../../engine/render-engine');
const { storePreview } = require('../../preview/preview-storage');
const previewIndex = require('../../preview/preview-index');

async function run() {
  // Write preview files into a test-only folder
  const outDir = path.resolve(__dirname, '../../storage/previews_test_e2e');

  const rawLead = {
    business_name: 'Acme Dental',
    niche: 'dentist',
    city: 'Austin',
    state: 'Texas',
    offer_angle: 'Book more new patient appointments',
    notes: 'Weaknesses:\n- Few reviews\nOpportunities:\n- Online booking\n- FAQ improvements'
  };

  // normalizeLead
  const lead = normalizeLead(rawLead, {});
  assert.ok(lead && lead.lead_id, 'normalized lead should include lead_id');
  assert.ok(lead.slug && typeof lead.slug === 'string');

  // buildSiteBrief
  const brief = buildSiteBrief(lead, {});
  assert.ok(brief && brief.messaging, 'brief should include messaging');

  // generatePageSchema
  const schema = generatePageSchema(brief, {});
  assert.ok(Array.isArray(schema) && schema.length > 0, 'schema sections should be generated');

  // render
  const html = render(schema, { assetPrefix: '../' });
  assert.strictEqual(typeof html, 'string');
  assert.ok(html.length > 100, 'rendered HTML should have content');
  assert.ok(/<!DOCTYPE html>/i.test(html), 'rendered HTML should be a full document');

  // store -> upserts preview-index
  const stored = await storePreview({
    lead_id: lead.lead_id,
    slug: brief.slug,
    html,
    business_name: brief.brand && brief.brand.name,
    location: brief.location,
    created_at: lead.created_at || new Date('2026-01-01').toISOString(),
    generator: 'noop',
    schema_version: 'schema-1'
  }, { outDir });

  assert.ok(stored && typeof stored === 'object');
  assert.ok(stored.url && stored.path, 'stored metadata should include url and path');

  // file exists
  const st = await fs.stat(stored.path);
  assert.ok(st.isFile(), 'preview file should be written to disk');

  // verify index contains the stored record by slug
  const rec = await previewIndex.getBySlug(stored.slug);
  assert.ok(rec && rec.slug === stored.slug, 'index should contain record by slug');
  assert.strictEqual(rec.file_path, stored.path);

  // cleanup preview file (keep index entry to avoid touching unrelated previews)
  try { await fs.unlink(stored.path); } catch {}

  console.log('E2E: full preview pipeline passed.');
}

run().catch(err => {
  console.error('E2E: full preview pipeline failed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
