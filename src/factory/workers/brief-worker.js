'use strict';

/**
 * brief-worker.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Stage worker for: build_brief
 *
 * Reads:  storage/leads/{lead_id}.json
 *         storage/audits/{lead_id}.json
 * Writes: storage/briefs/{lead_id}.json
 * Emits:  brief.completed → triggers generate_schema
 *
 * Idempotent: re-running produces the same output.
 */

const { getStore } = require('../storage/artifact-store');
const { resolveStrategyFamily } = require('../cache/strategy-cache');

function getBriefFromAudit() {
  return require('../../data/brief-from-audit');
}

/**
 * briefWorkerHandler(job)
 */
async function briefWorkerHandler(job) {
  const store  = getStore(job.payload.storage_dir);
  const leadId = job.lead_id;

  // ── 1. Read artifacts ──────────────────────────────────────────────────────
  const [lead, auditArtifact] = await Promise.all([
    store.read('lead',  leadId),
    store.read('audit', leadId),
  ]);

  if (!lead)          throw new Error(`Lead artifact not found: ${leadId}`);
  if (!auditArtifact) throw new Error(`Audit artifact not found: ${leadId}`);

  // ── 2. Check tier — skip if tier C ────────────────────────────────────────
  const tier = auditArtifact.tier || lead.tier || 'A';
  if (tier === 'C') {
    return { lead_id: leadId, skipped: true, reason: 'tier_C' };
  }

  // ── 3. Build brief from audit ──────────────────────────────────────────────
  const { buildBriefFromAudit } = getBriefFromAudit();
  const brief = buildBriefFromAudit(lead, auditArtifact.audit, auditArtifact.scoring);

  // ── 4. Resolve strategy family and attach ─────────────────────────────────
  const strategyFamily = resolveStrategyFamily(
    brief.niche,
    brief.primary_goal,
    brief.offer_angle,
  );
  brief.strategy_family_id = strategyFamily.family_id;
  brief.strategy_family    = strategyFamily;

  // ── 5. Write artifact ──────────────────────────────────────────────────────
  const artifact = {
    lead_id:    leadId,
    built_at:   new Date().toISOString(),
    tier,
    brief,
    strategy_family_id: strategyFamily.family_id,
  };

  await store.write('brief', leadId, artifact);

  return {
    lead_id:           leadId,
    primary_goal:      brief.primary_goal,
    offer_angle:       brief.offer_angle,
    strategy_family:   strategyFamily.family_id,
    artifact_path:     store.artifactPath('brief', leadId),
  };
}

module.exports = { briefWorkerHandler };
