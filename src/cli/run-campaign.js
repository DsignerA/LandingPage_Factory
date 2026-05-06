#!/usr/bin/env node
'use strict';

/**
 * run-campaign.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Lead Intelligence + Preview Generation Factory — Batch Campaign Runner
 *
 * Upgraded to use the stage-based PipelineQueue with:
 *   - Artifact storage (reads/writes per-stage JSON/HTML artifacts)
 *   - Lead tier ranking (A/B/C based on niche, city, reviews, weaknesses)
 *   - Event-driven auto-chaining (audit → brief → schema → render → screenshots → outreach)
 *   - Retry with exponential backoff (max 3 retries per stage)
 *   - Dead-letter queue for exhausted jobs
 *   - CRM-ready CSV + JSONL export
 *
 * Usage:
 *   node src/cli/run-campaign.js <leads.csv> [options]
 *
 * Options:
 *   --out-dir <dir>       Output / storage directory (default: ./campaign-output)
 *   --no-screenshots      Skip screenshot capture (faster)
 *   --single <name>       Process only one lead matching this name substring
 *   --tier <A|B|C>        Force all leads to this tier (overrides auto-ranking)
 *   --concurrency <n>     Override default concurrency for all stages
 *   --verbose             Print detailed progress logs
 *   --dry-run             Parse and rank leads without processing
 *
 * Exported files:
 *   {out-dir}/outreach-packets.jsonl
 *   {out-dir}/outreach-export.csv
 *   {out-dir}/preview-urls.txt
 *   {out-dir}/failed-leads.json
 *   {out-dir}/campaign-summary.json
 */

const path  = require('path');
const fs    = require('fs');
const fsP   = require('fs/promises');
const { parse: parseCSVSync } = require('csv-parse/sync');

// ── Factory modules ───────────────────────────────────────────────────────────
const { PipelineQueue }           = require('../factory/queue/job-queue');
const { ArtifactStore }           = require('../factory/storage/artifact-store');
const { auditWorkerHandler }      = require('../factory/workers/audit-worker');
const { briefWorkerHandler }      = require('../factory/workers/brief-worker');
const { schemaWorkerHandler }     = require('../factory/workers/schema-worker');
const { renderWorkerHandler }     = require('../factory/workers/render-worker');
const { screenshotWorkerHandler } = require('../factory/workers/screenshot-worker');
const { outreachWorkerHandler }   = require('../factory/workers/outreach-worker');
const { rankLeads }               = require('../factory/tier/lead-ranker');
const { normalizeLead }           = require('../../core/lead-normalizer');

// ── CLI argument parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    csvPath:       null,
    outDir:        path.resolve(process.cwd(), 'campaign-output'),
    noScreenshots: false,
    single:        null,
    forceTier:     null,
    concurrency:   null,
    verbose:       false,
    dryRun:        false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out-dir')          opts.outDir       = path.resolve(args[++i]);
    else if (a === '--no-screenshots') opts.noScreenshots = true;
    else if (a === '--single')      opts.single       = args[++i];
    else if (a === '--tier')        opts.forceTier    = args[++i];
    else if (a === '--concurrency') opts.concurrency  = parseInt(args[++i], 10);
    else if (a === '--verbose')     opts.verbose      = true;
    else if (a === '--dry-run')     opts.dryRun       = true;
    else if (!a.startsWith('--'))   opts.csvPath      = path.resolve(a);
  }

  return opts;
}

// ── CSV parser ────────────────────────────────────────────────────────────────
// Uses csv-parse/sync for robust handling of quoted fields, escaped commas,
// inconsistent column counts, and leading/trailing whitespace.

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCSVSync(content, {
    columns:            true,   // use first row as header keys
    skip_empty_lines:   true,
    trim:               true,
    relax_column_count: true,   // tolerate rows with more/fewer columns than header
  });
  // Normalise header keys to lowercase to stay compatible with csvRowToRawLead()
  return rows.map(row => {
    const normalised = {};
    for (const [k, v] of Object.entries(row)) {
      normalised[k.toLowerCase()] = v;
    }
    return normalised;
  });
}

// ── CSV row → raw lead mapper ─────────────────────────────────────────────────

function csvRowToRawLead(row) {
  return {
    business_name: row.business_name || row.name || row.company || '',
    niche:         row.niche || row.industry || row.category || row.type || '',
    city:          row.city || '',
    state:         row.state || '',
    location:      row.location || row.address || '',
    phone:         row.phone || row.phone_number || row.tel || '',
    website_url:   row.website_url || row.website || row.url || '',
    email:         row.email || '',
    rating:        row.rating || row.stars || '',
    review_count:  row.review_count || row.reviews || '',
    lead_id:       row.lead_id || row.id || '',
    offer_angle:   row.offer_angle || row.notes || '',
    has_ads:       row.has_ads === 'true' || row.has_ads === '1',
  };
}

// ── Logger ────────────────────────────────────────────────────────────────────

function makeLogger(verbose) {
  return {
    info:  (...a) => console.log('[INFO]', ...a),
    ok:    (...a) => console.log('[OK]  ', ...a),
    warn:  (...a) => console.warn('[WARN]', ...a),
    err:   (...a) => console.error('[ERR] ', ...a),
    dbg:   (...a) => { if (verbose) console.log('[DBG] ', ...a); },
  };
}

// ── Export helpers ────────────────────────────────────────────────────────────

async function exportResults(store, outDir, leads, log) {
  await fsP.mkdir(outDir, { recursive: true });

  const allResults = [];
  for (const lead of leads) {
    const [auditArt, outreachArt] = await Promise.all([
      store.read('audit',    lead.lead_id),
      store.read('outreach', lead.lead_id),
    ]);
    allResults.push({ lead, audit: auditArt, outreach: outreachArt });
  }

  // ── JSONL ──────────────────────────────────────────────────────────────────
  const jsonlLines = allResults
    .filter(r => r.outreach && r.outreach.packet)
    .map(r => JSON.stringify(r.outreach.packet));
  const jsonlPath = path.join(outDir, 'outreach-packets.jsonl');
  await fsP.writeFile(jsonlPath, jsonlLines.join('\n') + '\n', 'utf8');
  log.info(`JSONL export: ${jsonlPath} (${jsonlLines.length} packets)`);

  // ── CSV ────────────────────────────────────────────────────────────────────
  const csvHeaders = [
    'lead_id','business_name','niche','city','phone','website_url',
    'tier','site_score','weakness_count',
    'top_issue_1','top_issue_2',
    'offer_angle','email_subject','email_opener',
    'preview_url','current_screenshot','generated_screenshot',
  ];
  const csvRows = allResults.map(r => {
    const p  = r.outreach && r.outreach.packet ? r.outreach.packet : {};
    const oe = p.outreach || {};  // p.outreach.email_subject / email_opener
    const s  = r.audit && r.audit.scoring ? r.audit.scoring : {};
    const w  = s.weaknesses || [];
    const loc = (r.lead.location || '').split(',');
    return [
      r.lead.lead_id,
      p.business_name || r.lead.business_name || '',
      p.niche         || r.lead.niche || '',
      p.city          || r.lead.city || loc[0] || '',
      p.phone         || r.lead.phone || '',
      p.website_url   || r.lead.website_url || '',
      (r.audit && r.audit.tier) || r.lead.tier || '',
      s.site_score || '',
      s.weakness_count || '',
      w[0] ? (w[0].label || w[0].description || '') : '',
      w[1] ? (w[1].label || w[1].description || '') : '',
      (p.offer_angles && p.offer_angles[0]) || '',
      oe.email_subject || '',
      oe.email_opener  || '',
      (r.outreach && r.outreach.preview_url) || '',
      (r.outreach && r.outreach.screenshots && r.outreach.screenshots.current)   || '',
      (r.outreach && r.outreach.screenshots && r.outreach.screenshots.generated) || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csvPath = path.join(outDir, 'outreach-export.csv');
  await fsP.writeFile(csvPath, [csvHeaders.join(','), ...csvRows].join('\n') + '\n', 'utf8');
  log.info(`CSV export:  ${csvPath}`);

  // ── Preview URLs ───────────────────────────────────────────────────────────
  const urlLines = allResults
    .filter(r => r.outreach && r.outreach.preview_url)
    .map(r => `${r.lead.lead_id}\t${r.lead.business_name}\t${r.outreach.preview_url}`);
  const urlsPath = path.join(outDir, 'preview-urls.txt');
  await fsP.writeFile(urlsPath, urlLines.join('\n') + '\n', 'utf8');
  log.info(`Preview URLs: ${urlsPath}`);

  // ── Failed leads ───────────────────────────────────────────────────────────
  const deadDir = path.join(outDir, 'storage', 'dead_letter');
  let deadLetterFiles = [];
  try { deadLetterFiles = fs.readdirSync(deadDir).filter(f => f.endsWith('.json')); } catch {}
  const failedPath = path.join(outDir, 'failed-leads.json');
  const failedLeads = deadLetterFiles.map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(deadDir, f), 'utf8')); } catch { return null; }
  }).filter(Boolean);
  await fsP.writeFile(failedPath, JSON.stringify(failedLeads, null, 2), 'utf8');

  return { jsonlPath, csvPath, urlsPath, failedPath };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);
  const log  = makeLogger(opts.verbose);

  if (!opts.csvPath) {
    console.error('Usage: node src/cli/run-campaign.js <leads.csv> [options]');
    console.error('  --out-dir <dir>       Output directory (default: ./campaign-output)');
    console.error('  --no-screenshots      Skip screenshots');
    console.error('  --single <name>       Process one lead by name');
    console.error('  --tier <A|B|C>        Force tier for all leads');
    console.error('  --concurrency <n>     Override concurrency');
    console.error('  --verbose             Detailed logs');
    console.error('  --dry-run             Rank leads without processing');
    process.exit(1);
  }

  if (!fs.existsSync(opts.csvPath)) {
    console.error(`CSV not found: ${opts.csvPath}`);
    process.exit(1);
  }

  const outDir     = opts.outDir;
  const storageDir = path.join(outDir, 'storage');

  log.info('═══════════════════════════════════════════════════');
  log.info('  LEAD INTELLIGENCE + PREVIEW GENERATION FACTORY');
  log.info('═══════════════════════════════════════════════════');
  log.info(`CSV:         ${opts.csvPath}`);
  log.info(`Output:      ${outDir}`);
  log.info(`Screenshots: ${opts.noScreenshots ? 'disabled' : 'enabled'}`);

  // ── Initialize artifact store ──────────────────────────────────────────────
  const store = new ArtifactStore(storageDir);
  await store.init();

  // ── Parse and normalize leads ──────────────────────────────────────────────
  const rows = parseCSV(opts.csvPath);
  log.info(`Loaded ${rows.length} rows from CSV`);

  let leads = rows.map(row => {
    try { return normalizeLead(csvRowToRawLead(row)); }
    catch (e) { log.warn(`Normalize failed: ${e.message}`); return null; }
  }).filter(Boolean);

  if (opts.single) {
    leads = leads.filter(l =>
      (l.business_name || '').toLowerCase().includes(opts.single.toLowerCase())
    );
    log.info(`Filtered to ${leads.length} lead(s) matching "${opts.single}"`);
  }

  if (leads.length === 0) {
    log.err('No valid leads to process.');
    process.exit(1);
  }

  // ── Rank leads and assign tiers ────────────────────────────────────────────
  const ranked = rankLeads(leads, {});
  for (const { lead, ranking } of ranked) {
    lead.tier     = opts.forceTier || ranking.tier;
    lead.priority = ranking.score;
    log.dbg(`  ${lead.business_name}: tier=${lead.tier} score=${ranking.score}`);
  }

  // ── Write lead artifacts ───────────────────────────────────────────────────
  for (const lead of leads) {
    await store.write('lead', lead.lead_id, lead);
    await store.updateStageStatus(lead.lead_id, 'imported', 'complete');
  }

  if (opts.dryRun) {
    log.info('Dry run complete. Leads ranked:');
    for (const { lead, ranking } of ranked) {
      log.info(`  ${lead.business_name} → Tier ${lead.tier} (score: ${ranking.score})`);
    }
    process.exit(0);
  }

  // ── Build pipeline queue ───────────────────────────────────────────────────
  const conc = opts.concurrency;
  const pipeline = new PipelineQueue({
    store,
    autoChain: true,
    concurrency: conc ? {
      audit_site:            conc,
      build_brief:           conc,
      generate_schema:       conc,
      render_preview:        conc,
      capture_screenshots:   Math.min(conc, 5),
      build_outreach_packet: conc,
    } : undefined,
  });

  // ── Register stage handlers ────────────────────────────────────────────────
  pipeline.process('audit_site',            auditWorkerHandler);
  pipeline.process('build_brief',           briefWorkerHandler);
  pipeline.process('generate_schema',       schemaWorkerHandler);
  pipeline.process('render_preview',        renderWorkerHandler);
  pipeline.process('capture_screenshots',
    opts.noScreenshots
      ? async (job) => ({ lead_id: job.lead_id, skipped: true, reason: 'no_screenshots_flag' })
      : screenshotWorkerHandler
  );
  pipeline.process('build_outreach_packet', outreachWorkerHandler);

  // ── Progress tracking ──────────────────────────────────────────────────────
  //
  // A lead is counted as:
  //   completed       — build_outreach_packet succeeded
  //   partial         — pipeline completed a stage but a later stage failed/dead
  //                     (e.g. preview rendered but screenshot failed)
  //   needs_review    — screenshot worker flagged generated_needs_review=true
  //   failed          — any stage hit the dead-letter queue
  //
  // This ensures a lead that renders a preview but fails screenshots is NOT
  // invisible in the summary (the previous bug: completed=0, failed=0).

  let completed = 0, failed = 0, partial = 0, needsReview = 0;
  const t0 = Date.now();

  // Track which lead_ids have reached each terminal state
  const _completedIds   = new Set();
  const _failedIds      = new Set();
  const _partialIds     = new Set();
  const _needsReviewIds = new Set();

  // Track the furthest stage each lead reached (for partial detection)
  const _leadProgress = {}; // lead_id → last completed stage
  const TERMINAL_STAGE = 'build_outreach_packet';
  const STAGE_ORDER = [
    'audit_site', 'build_brief', 'generate_schema',
    'render_preview', 'capture_screenshots', 'build_outreach_packet',
  ];

  pipeline.on('job.completed', (job) => {
    log.dbg(`  ✓ ${job.job_type} → ${job.lead_id}`);
    _leadProgress[job.lead_id] = job.job_type;

    if (job.job_type === TERMINAL_STAGE) {
      if (!_completedIds.has(job.lead_id)) {
        completed++;
        _completedIds.add(job.lead_id);
        log.ok(`Done [${completed}/${leads.length}]: ${job.lead_id}`);
      }
    }

    // Check for screenshot needs_review flag
    if (job.job_type === 'capture_screenshots' && job.result) {
      if (job.result.generated_needs_review) {
        if (!_needsReviewIds.has(job.lead_id)) {
          needsReview++;
          _needsReviewIds.add(job.lead_id);
          log.warn(`Needs review (screenshot): ${job.lead_id}`);
        }
      }
    }
  });

  pipeline.on('job.retry', (job, err) => {
    log.warn(`Retry [${job.attempts}/${job.max_retries}]: ${job.job_type} → ${job.lead_id}: ${err.message}`);
  });

  pipeline.on('job.dead', (job, err) => {
    if (!_failedIds.has(job.lead_id)) {
      failed++;
      _failedIds.add(job.lead_id);
    }
    log.err(`DEAD: ${job.job_type} → ${job.lead_id}: ${err.message || err}`);
  });

  // ── Import leads into pipeline ─────────────────────────────────────────────
  log.info(`Processing ${leads.length} leads through ${opts.noScreenshots ? '5' : '6'} pipeline stages...`);
  // Inject storage_dir into each lead so all stage workers can find artifacts
  const leadsWithStorage = leads.map(l => ({ ...l, _storage_dir: storageDir }));
  pipeline.importLeads(leadsWithStorage, { storage_dir: storageDir });

  // ── Wait for all queues to drain ───────────────────────────────────────────
  await pipeline.drainAll();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  log.info(`Pipeline complete in ${elapsed}s`);

  // ── Detect partial leads ─────────────────────────────────────────────────────
  // A lead is "partial" if it made progress through the pipeline but did NOT
  // reach the terminal stage AND was NOT already counted as failed (dead-letter).
  for (const lead of leads) {
    const lastStage = _leadProgress[lead.lead_id];
    const isComplete = _completedIds.has(lead.lead_id);
    const isFailed   = _failedIds.has(lead.lead_id);
    if (lastStage && lastStage !== TERMINAL_STAGE && !isComplete && !isFailed) {
      if (!_partialIds.has(lead.lead_id)) {
        partial++;
        _partialIds.add(lead.lead_id);
        log.warn(`Partial (stopped at ${lastStage}): ${lead.lead_id}`);
      }
    }
  }

  // ── Export results ─────────────────────────────────────────────────────────
  const exported = await exportResults(store, outDir, leads, log);

  // ── Campaign summary ───────────────────────────────────────────────────────
  const stats = await store.getCampaignStats();
  const throughput = Math.round((leads.length / parseFloat(elapsed)) * 3600);
  const summary = {
    ...stats,
    elapsed_seconds:       parseFloat(elapsed),
    leads_processed:       leads.length,
    leads_completed:       completed,
    leads_partial:         partial,
    leads_needs_review:    needsReview,
    leads_failed:          failed,
    throughput_per_hour:   throughput,
    generated_at:          new Date().toISOString(),
  };

  const summaryPath = path.join(outDir, 'campaign-summary.json');
  await fsP.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  log.info(`Summary:     ${summaryPath}`);

  // ── Final report ───────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  CAMPAIGN COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total leads:       ${leads.length}`);
  console.log(`  Completed:         ${completed}`);
  console.log(`  Partial:           ${partial}  ${partial > 0 ? '(preview rendered, later stage failed)' : ''}`);
  console.log(`  Needs review:      ${needsReview}  ${needsReview > 0 ? '(screenshot flagged — retry or manual review)' : ''}`);
  console.log(`  Failed:            ${failed}  ${failed > 0 ? '(dead-letter — see failed-leads.json)' : ''}`);
  console.log(`  Previews rendered: ${stats.previews_rendered}`);
  console.log(`  Screenshots:       ${stats.screenshots_generated}`);
  console.log(`  Outreach packets:  ${stats.outreach_built}`);
  console.log(`  Dead letter:       ${stats.dead_letter_count}`);
  console.log(`  Elapsed:           ${elapsed}s`);
  console.log(`  Throughput:        ~${throughput.toLocaleString()} leads/hour`);
  console.log('─────────────────────────────────────────────────────');
  console.log(`  Output dir:        ${outDir}`);
  console.log(`  JSONL export:      ${exported.jsonlPath}`);
  console.log(`  CSV export:        ${exported.csvPath}`);
  console.log(`  Preview URLs:      ${exported.urlsPath}`);
  console.log(`  Failed leads:      ${exported.failedPath}`);
  console.log(`  Summary:           ${summaryPath}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('[FATAL]', err.message || err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
