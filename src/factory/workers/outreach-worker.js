'use strict';

/**
 * outreach-worker.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Stage worker for: build_outreach_packet
 *
 * Reads:  storage/leads/{lead_id}.json
 *         storage/audits/{lead_id}.json
 *         storage/briefs/{lead_id}.json
 *         storage/previews/{lead_id}.html  (for preview URL)
 *         storage/screenshots/...          (for screenshot paths)
 * Writes: storage/outreach/{lead_id}.json
 * Emits:  outreach.completed (terminal stage)
 *
 * Idempotent: re-running overwrites outreach artifact.
 */

const path = require('path');
const fs   = require('fs');
const { getStore } = require('../storage/artifact-store');

function getOutreachPacketBuilder() {
  return require('../../outreach/outreach-packet-builder');
}
function getStrategySummary() {
  return require('../../preview/strategy-summary');
}

/**
 * outreachWorkerHandler(job)
 */
async function outreachWorkerHandler(job) {
  const store  = getStore(job.payload.storage_dir);
  const leadId = job.lead_id;

  // ── 1. Read all artifacts ──────────────────────────────────────────────────
  const [lead, auditArtifact, briefArtifact] = await Promise.all([
    store.read('lead',  leadId),
    store.read('audit', leadId),
    store.read('brief', leadId),
  ]);

  if (!lead) throw new Error(`Lead artifact not found: ${leadId}`);

  const tier = (auditArtifact && auditArtifact.tier) || lead.tier || 'A';

  // ── 2. Resolve screenshot paths ────────────────────────────────────────────
  const currentScreenshotPath   = store.artifactPath('screenshot_current',  leadId);
  const generatedScreenshotPath = store.artifactPath('screenshot_generated', leadId);
  const previewPath             = store.artifactPath('preview', leadId);

  const currentScreenshot   = fs.existsSync(currentScreenshotPath)   ? currentScreenshotPath   : null;
  const generatedScreenshot = fs.existsSync(generatedScreenshotPath) ? generatedScreenshotPath : null;
  const previewUrl          = fs.existsSync(previewPath)             ? `file://${previewPath}` : null;

  // ── 3. Build strategy summary ──────────────────────────────────────────────
  const { generateStrategySummary } = getStrategySummary();
  const brief         = briefArtifact ? briefArtifact.brief : null;
  const scoringResult = auditArtifact ? auditArtifact.scoring : {};

  const strategySummary = generateStrategySummary({
    lead,
    brief:   brief || {},
    scoring: scoringResult,
  });

  // ── 4. Build outreach packet ───────────────────────────────────────────────
  const { buildOutreachPacket } = getOutreachPacketBuilder();
  const packetResult = buildOutreachPacket({
    normalizedLead:   lead,
    auditResult:      auditArtifact ? auditArtifact.audit : {},
    scoringResult,
    strategySummary,
    previewMeta:      { previewUrl },
    screenshotResult: { currentScreenshot, generatedScreenshot },
  });
  // Unwrap: buildOutreachPacket returns { packet, validationErrors }
  const packet = (packetResult && packetResult.packet) ? packetResult.packet : packetResult;

  // ── 5. Write artifact ──────────────────────────────────────────────────────
  const artifact = {
    lead_id:    leadId,
    built_at:   new Date().toISOString(),
    tier,
    packet,
    strategy_summary: strategySummary,
    preview_url:      previewUrl,
    screenshots: {
      current:   currentScreenshot,
      generated: generatedScreenshot,
    },
  };

  await store.write('outreach', leadId, artifact);

  return {
    lead_id:       leadId,
    email_subject: packet.outreach ? packet.outreach.email_subject : null,
    tier,
    artifact_path: store.artifactPath('outreach', leadId),
  };
}

module.exports = { outreachWorkerHandler };
