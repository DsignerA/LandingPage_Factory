'use strict';

/**
 * render-worker.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Stage worker for: render_preview
 *
 * Reads:  storage/leads/{lead_id}.json
 *         storage/briefs/{lead_id}.json
 *         storage/schemas/{lead_id}.json
 * Writes: storage/previews/{lead_id}.html
 * Emits:  preview.rendered → triggers capture_screenshots
 *
 * Idempotent: re-running overwrites the HTML artifact.
 */

const { getStore } = require('../storage/artifact-store');

function getRenderEngine()  { return require('../../engine/render-engine'); }
function getStrategyPanel() { return require('../../engine/strategy-panel'); }
function getLocalProof()    { return require('../../data/local-proof'); }
function getSurfaceSystem() { return require('../../design/surface-system'); }

/**
 * renderWorkerHandler(job)
 */
async function renderWorkerHandler(job) {
  const store  = getStore(job.payload.storage_dir);
  const leadId = job.lead_id;

  // ── 1. Read artifacts ──────────────────────────────────────────────────────
  const [lead, briefArtifact, schemaArtifact] = await Promise.all([
    store.read('lead',   leadId),
    store.read('brief',  leadId),
    store.read('schema', leadId),
  ]);

  if (!lead)           throw new Error(`Lead artifact not found: ${leadId}`);
  if (!briefArtifact)  throw new Error(`Brief artifact not found: ${leadId}`);
  if (!schemaArtifact) throw new Error(`Schema artifact not found: ${leadId}`);
  if (schemaArtifact.skipped) {
    return { lead_id: leadId, skipped: true, reason: 'schema_skipped' };
  }

  const brief        = briefArtifact.brief;
  const pageSchema   = schemaArtifact.page_schema;
  const designTokens = schemaArtifact.design_tokens;
  const tier         = briefArtifact.tier || 'A';

  // ── 2. Build local proof ───────────────────────────────────────────────────
  const { generateLocalProof } = getLocalProof();
  const localProof = generateLocalProof(lead, brief);

  // ── 3. Build surface CSS ───────────────────────────────────────────────────
  const { generateSurfaceCSS } = getSurfaceSystem();
  const surfaceCSS = generateSurfaceCSS();

  // ── 4. Build strategy panel ────────────────────────────────────────────────
  const { buildStrategyPanel } = getStrategyPanel();
  const auditArtifact = await store.read('audit', leadId);
  const strategyPanelHtml = buildStrategyPanel({
    brief,
    designTokens,
    sectionPlan:   schemaArtifact.section_plan,
    scoringResult: auditArtifact ? auditArtifact.scoring : {},
    tier,
  });

  // ── 5. Render HTML ────────────────────────────────────────────────────────────
  const { render } = getRenderEngine();
  const html = render(pageSchema, {
    brief,
    design:           designTokens,
    localProof,
    surfaceCSS,
    strategyPanelHtml,
    previewMode:      true,
  }); // ── 6. Write HTML artifact ─────────────────────────────────────────────────
  await store.write('preview', leadId, html);

  // Resolve slug from lead artifact (set by lead-normalizer).
  // Included in the return value so downstream workers (e.g. screenshot-worker)
  // can read it from job.result without re-reading the lead artifact.
  const slug = lead.slug || null;

  return {
    lead_id:       leadId,
    slug,                                             // canonical slug for screenshot filenames
    preview_path:  store.artifactPath('preview', leadId), // absolute path to the HTML file
    html_length:   html.length,
    artifact_path: store.artifactPath('preview', leadId), // kept for backward compat
  };
}

module.exports = { renderWorkerHandler };
