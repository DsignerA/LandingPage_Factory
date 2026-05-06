'use strict';

/**
 * audit-worker.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Stage worker for: audit_site
 *
 * Reads:  storage/leads/{lead_id}.json
 * Writes: storage/audits/{lead_id}.json
 * Emits:  audit.completed → triggers build_brief
 *
 * Idempotent: re-running produces the same output (overwrites artifact).
 */

const path = require('path');
const { getStore } = require('../storage/artifact-store');
const { scoreLead, getTierConfig } = require('../tier/lead-ranker');

// Lazy-require to avoid loading at module parse time
function getSiteAuditor() {
  return require('../../audit/site-auditor');
}
function getWeaknessScoring() {
  return require('../../audit/weakness-scoring');
}

/**
 * auditWorkerHandler(job)
 *
 * This is the function registered with the StageQueue for 'audit_site'.
 *
 * @param {Job} job
 * @returns {object} artifact summary
 */
async function auditWorkerHandler(job) {
  const store  = getStore(job.payload.storage_dir);
  const leadId = job.lead_id;

  // ── 1. Read lead artifact ──────────────────────────────────────────────────
  const lead = await store.read('lead', leadId);
  if (!lead) {
    throw new Error(`Lead artifact not found for lead_id: ${leadId}`);
  }

  const websiteUrl = lead.website_url || lead.website || null;

  // ── 2. Audit the site ──────────────────────────────────────────────────────
  const { auditWebsite } = getSiteAuditor();
  const auditResult = await auditWebsite(websiteUrl, { timeoutMs: 12000 });

  // ── 3. Score weaknesses ────────────────────────────────────────────────────
  const { scoreWeaknesses } = getWeaknessScoring();
  const scoringResult = scoreWeaknesses(auditResult, { niche: lead.niche || 'generic' });

  // ── 4. Rank the lead (assign tier) ────────────────────────────────────────
  const ranking   = scoreLead(lead, scoringResult);
  const tierConfig = getTierConfig(ranking.tier);

  // ── 5. Build audit artifact ────────────────────────────────────────────────
  const artifact = {
    lead_id:       leadId,
    audited_at:    new Date().toISOString(),
    website_url:   websiteUrl,
    audit:         auditResult,
    scoring:       scoringResult,
    ranking,
    tier:          ranking.tier,
    tier_config:   tierConfig,
  };

  // ── 6. Write artifact ──────────────────────────────────────────────────────
  await store.write('audit', leadId, artifact);

  // ── 7. Update lead artifact with tier info ─────────────────────────────────
  const updatedLead = { ...lead, tier: ranking.tier, score: ranking.score };
  await store.write('lead', leadId, updatedLead);

  return {
    lead_id:         leadId,
    site_score:      scoringResult.site_score,
    weakness_count:  scoringResult.weakness_count,
    tier:            ranking.tier,
    artifact_path:   store.artifactPath('audit', leadId),
  };
}

module.exports = { auditWorkerHandler };
