'use strict';

/**
 * schema-worker.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Stage worker for: generate_schema
 *
 * Reads:  storage/leads/{lead_id}.json
 *         storage/briefs/{lead_id}.json
 * Writes: storage/schemas/{lead_id}.json
 * Emits:  schema.generated → triggers render_preview
 *
 * This worker runs the full design pipeline:
 *   brief → design-director → page-composer → taste-pass
 * And produces a lightweight scene-based schema (not HTML).
 * The render worker converts schema → HTML.
 */

const { getStore } = require('../storage/artifact-store');

function getDesignDirector()  { return require('../../design/design-director'); }
function getPageComposer()    { return require('../../design/page-composer'); }
function getTastePass()       { return require('../../design/taste-pass'); }
function getAiPageGenerator() { return require('../../ai/ai-page-generator'); }
function getNicheResolver()   { return require('../../niches/index'); }

/**
 * schemaWorkerHandler(job)
 */
async function schemaWorkerHandler(job) {
  const store  = getStore(job.payload.storage_dir);
  const leadId = job.lead_id;

  // ── 1. Read artifacts ──────────────────────────────────────────────────────
  const [lead, briefArtifact] = await Promise.all([
    store.read('lead',  leadId),
    store.read('brief', leadId),
  ]);

  if (!lead)          throw new Error(`Lead artifact not found: ${leadId}`);
  if (!briefArtifact) throw new Error(`Brief artifact not found: ${leadId}`);
  if (briefArtifact.skipped) {
    return { lead_id: leadId, skipped: true, reason: 'brief_skipped' };
  }

  const brief = briefArtifact.brief;
  const tier  = briefArtifact.tier || 'A';

  // ── 2. Run design pipeline ─────────────────────────────────────────────────
  const { directDesign }     = getDesignDirector();
  const { composePage }      = getPageComposer();
  const { applyTastePass }   = getTastePass();
  const { resolveNichePack } = getNicheResolver();

  const nichePack    = resolveNichePack(brief.niche);
  const designTokens = directDesign(brief);
  const sectionPlan  = composePage(brief, designTokens);

  // ── 3. Generate page schema via AI provider ────────────────────────────────
  const { generate } = getAiPageGenerator();
  let pageSchema = await generate(brief, { provider: 'noop', sectionPlan });

  // ── 4. Apply taste pass ────────────────────────────────────────────────────
  pageSchema = applyTastePass(pageSchema, brief, designTokens);

  // ── 5. Build schema artifact ───────────────────────────────────────────────
  const artifact = {
    lead_id:      leadId,
    generated_at: new Date().toISOString(),
    tier,
    brief_summary: {
      niche:           brief.niche,
      primary_goal:    brief.primary_goal,
      offer_angle:     brief.offer_angle,
      strategy_family: briefArtifact.strategy_family_id,
    },
    design_tokens: designTokens,
    section_plan:  sectionPlan,
    page_schema:   pageSchema,
  };

  await store.write('schema', leadId, artifact);

  return {
    lead_id:         leadId,
    section_count:   pageSchema.sections ? pageSchema.sections.length : 0,
    strategy_family: briefArtifact.strategy_family_id,
    artifact_path:   store.artifactPath('schema', leadId),
  };
}

module.exports = { schemaWorkerHandler };
