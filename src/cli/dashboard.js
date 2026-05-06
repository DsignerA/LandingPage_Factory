#!/usr/bin/env node
'use strict';

/**
 * dashboard.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Campaign Dashboard CLI — real-time metrics and progress monitoring
 *
 * Usage:
 *   node src/cli/dashboard.js [options]
 *
 * Options:
 *   --out-dir <dir>     Campaign output directory to inspect (default: ./campaign-output)
 *   --watch             Refresh every 3 seconds (live mode)
 *   --interval <n>      Refresh interval in seconds (default: 3, requires --watch)
 *   --tier <A|B|C>      Filter display to a specific tier
 *   --failed            Show only failed / dead-letter leads
 *   --json              Output raw JSON instead of formatted table
 *
 * What it shows:
 *   - Pipeline stage completion counts (audit / brief / schema / render / screenshot / outreach)
 *   - Lead tier distribution (A / B / C)
 *   - Site score distribution (0-40 / 41-70 / 71-100)
 *   - Top weaknesses across all leads
 *   - Dead-letter queue contents
 *   - Throughput estimate
 *   - Per-lead status table (last 20 leads)
 */

const path  = require('path');
const fs    = require('fs');
const fsP   = require('fs/promises');

// ── CLI argument parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    outDir:   path.resolve(process.cwd(), 'campaign-output'),
    watch:    false,
    interval: 3,
    tier:     null,
    failed:   false,
    json:     false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out-dir')        opts.outDir   = path.resolve(args[++i]);
    else if (a === '--watch')     opts.watch    = true;
    else if (a === '--interval')  opts.interval = parseInt(args[++i], 10) || 3;
    else if (a === '--tier')      opts.tier     = args[++i];
    else if (a === '--failed')    opts.failed   = true;
    else if (a === '--json')      opts.json     = true;
  }

  return opts;
}

// ── Storage reader ────────────────────────────────────────────────────────────

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function listDir(dirPath) {
  try { return fs.readdirSync(dirPath); } catch { return []; }
}

// ── Metrics collector ─────────────────────────────────────────────────────────

async function collectMetrics(outDir) {
  const storageDir = path.join(outDir, 'storage');

  // ── Lead state files ───────────────────────────────────────────────────────
  const stateDir  = path.join(storageDir, 'state');
  const stateFiles = listDir(stateDir).filter(f => f.endsWith('.json'));

  const leads = stateFiles.map(f => {
    const state = readJsonFile(path.join(stateDir, f));
    if (!state) return null;
    const leadId = f.replace('.json', '');

    // Read audit for tier/score
    const audit = readJsonFile(path.join(storageDir, 'audits', `${leadId}.json`));
    // Read lead for name/niche
    const lead  = readJsonFile(path.join(storageDir, 'leads',  `${leadId}.json`));
    // Read outreach for email subject
    const outreach = readJsonFile(path.join(storageDir, 'outreach', `${leadId}.json`));

    return {
      lead_id:       leadId,
      business_name: lead ? lead.business_name : leadId,
      niche:         lead ? lead.niche : '',
      tier:          audit ? audit.tier : (lead ? lead.tier : '?'),
      site_score:    audit && audit.scoring ? audit.scoring.site_score : null,
      weakness_count: audit && audit.scoring ? audit.scoring.site_score : null,
      stages:        state.stages || {},
      updated_at:    state.updated_at,
      email_subject: outreach && outreach.packet && outreach.packet.email
        ? outreach.packet.email.subject : null,
    };
  }).filter(Boolean);

  // ── Dead-letter queue ──────────────────────────────────────────────────────
  const deadDir   = path.join(storageDir, 'dead_letter');
  const deadFiles = listDir(deadDir).filter(f => f.endsWith('.json'));
  const deadJobs  = deadFiles.map(f => readJsonFile(path.join(deadDir, f))).filter(Boolean);

  // ── Campaign summary ───────────────────────────────────────────────────────
  const summary = readJsonFile(path.join(outDir, 'campaign-summary.json'));

  // ── Stage completion counts ────────────────────────────────────────────────
  const STAGES = ['audit_site', 'build_brief', 'generate_schema', 'render_preview',
                  'capture_screenshots', 'build_outreach_packet'];
  const stageCounts = {};
  for (const stage of STAGES) {
    stageCounts[stage] = { complete: 0, running: 0, failed: 0, pending: 0 };
  }
  for (const lead of leads) {
    for (const stage of STAGES) {
      const status = lead.stages[stage] || 'pending';
      if (stageCounts[stage][status] !== undefined) stageCounts[stage][status]++;
      else stageCounts[stage].pending++;
    }
  }

  // ── Tier distribution ──────────────────────────────────────────────────────
  const tierDist = { A: 0, B: 0, C: 0, '?': 0 };
  for (const lead of leads) {
    tierDist[lead.tier] = (tierDist[lead.tier] || 0) + 1;
  }

  // ── Site score distribution ────────────────────────────────────────────────
  const scoreDist = { low: 0, mid: 0, high: 0 };
  for (const lead of leads) {
    if (lead.site_score === null) continue;
    if (lead.site_score <= 40)       scoreDist.low++;
    else if (lead.site_score <= 70)  scoreDist.mid++;
    else                             scoreDist.high++;
  }

  // ── Weakness frequency ─────────────────────────────────────────────────────
  const weaknessFreq = {};
  for (const f of listDir(path.join(storageDir, 'audits'))) {
    const audit = readJsonFile(path.join(storageDir, 'audits', f));
    if (!audit || !audit.scoring || !audit.scoring.weaknesses) continue;
    for (const w of audit.scoring.weaknesses.slice(0, 3)) {
      const key = w.category || w.description || 'unknown';
      weaknessFreq[key] = (weaknessFreq[key] || 0) + 1;
    }
  }
  const topWeaknesses = Object.entries(weaknessFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    leads,
    stageCounts,
    tierDist,
    scoreDist,
    topWeaknesses,
    deadJobs,
    summary,
    total:      leads.length,
    completed:  leads.filter(l => l.stages['build_outreach_packet'] === 'complete').length,
    failed:     deadJobs.length,
  };
}

// ── Formatters ────────────────────────────────────────────────────────────────

function bar(count, total, width = 20) {
  if (total === 0) return '─'.repeat(width);
  const filled = Math.round((count / total) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function pad(str, len) {
  const s = String(str || '');
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function rpad(str, len) {
  const s = String(str || '');
  return s.length >= len ? s.slice(0, len) : ' '.repeat(len - s.length) + s;
}

const STAGE_LABELS = {
  audit_site:            'Audit Site      ',
  build_brief:           'Build Brief     ',
  generate_schema:       'Generate Schema ',
  render_preview:        'Render Preview  ',
  capture_screenshots:   'Screenshots     ',
  build_outreach_packet: 'Outreach Packet ',
};

function renderDashboard(metrics, opts) {
  const { leads, stageCounts, tierDist, scoreDist, topWeaknesses, deadJobs, summary } = metrics;
  const total = metrics.total;
  const now   = new Date().toLocaleTimeString();

  const lines = [];
  const hr    = '─'.repeat(72);

  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════════════════╗');
  lines.push('║   LANDING BUILDER — CAMPAIGN DASHBOARD                              ║');
  lines.push(`║   ${pad(now, 20)}  ${pad(opts.outDir.slice(-44), 44)}  ║`);
  lines.push('╚══════════════════════════════════════════════════════════════════════╝');
  lines.push('');

  // ── Overall progress ───────────────────────────────────────────────────────
  const pct = total > 0 ? Math.round((metrics.completed / total) * 100) : 0;
  lines.push(`  OVERALL PROGRESS   ${bar(metrics.completed, total, 30)}  ${metrics.completed}/${total} (${pct}%)`);
  if (summary) {
    lines.push(`  Elapsed: ${summary.elapsed_seconds}s   Throughput: ~${(summary.throughput_per_hour || 0).toLocaleString()} leads/hr`);
  }
  lines.push('');

  // ── Stage pipeline ─────────────────────────────────────────────────────────
  lines.push('  PIPELINE STAGES');
  lines.push(`  ${'Stage'.padEnd(20)} ${'Done'.padStart(5)} ${'Running'.padStart(8)} ${'Failed'.padStart(7)} ${'Progress'.padStart(24)}`);
  lines.push(`  ${hr}`);
  for (const [stage, counts] of Object.entries(stageCounts)) {
    const label = STAGE_LABELS[stage] || stage;
    const done  = counts.complete || 0;
    const run   = counts.running  || 0;
    const fail  = counts.failed   || 0;
    lines.push(`  ${label} ${rpad(done, 5)} ${rpad(run, 8)} ${rpad(fail, 7)}  ${bar(done, total, 20)}`);
  }
  lines.push('');

  // ── Tier distribution ──────────────────────────────────────────────────────
  lines.push('  LEAD TIERS');
  lines.push(`  Tier A (hot):   ${rpad(tierDist.A, 4)}  ${bar(tierDist.A, total, 20)}`);
  lines.push(`  Tier B (warm):  ${rpad(tierDist.B, 4)}  ${bar(tierDist.B, total, 20)}`);
  lines.push(`  Tier C (cold):  ${rpad(tierDist.C, 4)}  ${bar(tierDist.C, total, 20)}`);
  lines.push('');

  // ── Site score distribution ────────────────────────────────────────────────
  lines.push('  SITE SCORES');
  lines.push(`  Low  (0-40):   ${rpad(scoreDist.low, 4)}  ${bar(scoreDist.low,  total, 20)}  (high opportunity)`);
  lines.push(`  Mid  (41-70):  ${rpad(scoreDist.mid, 4)}  ${bar(scoreDist.mid,  total, 20)}`);
  lines.push(`  High (71-100): ${rpad(scoreDist.high, 4)}  ${bar(scoreDist.high, total, 20)}  (lower priority)`);
  lines.push('');

  // ── Top weaknesses ─────────────────────────────────────────────────────────
  if (topWeaknesses.length > 0) {
    lines.push('  TOP WEAKNESSES ACROSS LEADS');
    for (const [cat, count] of topWeaknesses) {
      lines.push(`  ${pad(cat, 30)}  ${rpad(count, 4)} leads  ${bar(count, total, 16)}`);
    }
    lines.push('');
  }

  // ── Dead-letter queue ──────────────────────────────────────────────────────
  if (deadJobs.length > 0) {
    lines.push(`  DEAD-LETTER QUEUE (${deadJobs.length} failed jobs)`);
    for (const job of deadJobs.slice(0, 5)) {
      lines.push(`  ✗ ${pad(job.job_type || '?', 24)} → ${pad(job.lead_id || '?', 36)} ${job.last_error || ''}`);
    }
    if (deadJobs.length > 5) lines.push(`  ... and ${deadJobs.length - 5} more`);
    lines.push('');
  }

  // ── Per-lead status table ──────────────────────────────────────────────────
  let displayLeads = leads;
  if (opts.tier)   displayLeads = displayLeads.filter(l => l.tier === opts.tier);
  if (opts.failed) displayLeads = displayLeads.filter(l =>
    Object.values(l.stages).some(s => s === 'failed')
  );

  const recent = displayLeads
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    .slice(0, 20);

  if (recent.length > 0) {
    lines.push(`  RECENT LEADS (${recent.length} shown)`);
    lines.push(`  ${'Business Name'.padEnd(28)} ${'Niche'.padEnd(12)} ${'Tier'.padEnd(5)} ${'Score'.padEnd(6)} ${'Stage'.padEnd(22)}`);
    lines.push(`  ${hr}`);
    for (const lead of recent) {
      const lastStage = Object.entries(lead.stages)
        .filter(([, v]) => v === 'complete')
        .map(([k]) => k)
        .pop() || 'pending';
      const score = lead.site_score !== null ? String(lead.site_score) : '—';
      lines.push(`  ${pad(lead.business_name, 28)} ${pad(lead.niche, 12)} ${pad(lead.tier, 5)} ${rpad(score, 6)} ${pad(lastStage, 22)}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);

  if (!fs.existsSync(opts.outDir)) {
    console.error(`Output directory not found: ${opts.outDir}`);
    console.error('Run a campaign first: node src/cli/run-campaign.js <leads.csv>');
    process.exit(1);
  }

  async function render() {
    const metrics = await collectMetrics(opts.outDir);

    if (opts.json) {
      console.log(JSON.stringify(metrics, null, 2));
      return;
    }

    if (opts.watch) {
      // Clear terminal
      process.stdout.write('\x1Bc');
    }

    console.log(renderDashboard(metrics, opts));
  }

  await render();

  if (opts.watch) {
    setInterval(render, opts.interval * 1000);
  }
}

main().catch(err => {
  console.error('[FATAL]', err.message || err);
  process.exit(1);
});
