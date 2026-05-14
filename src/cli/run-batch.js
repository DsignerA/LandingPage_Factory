#!/usr/bin/env node
'use strict';

/**
 * run-batch.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Run the full agentic factory pipeline over a CSV of leads.
 *
 * Usage:
 *   node src/cli/run-batch.js <csv-path>           [--concurrency=1] [--packet]
 *
 * CSV columns (header row required):
 *   business_name,niche,city,state,website_url[,offer_angle]
 *
 * The runner:
 *   - Reads the CSV, normalizes empty fields.
 *   - Runs runPreviewFor() per lead, serially by default (concurrency=1).
 *     Concurrency > 1 only makes sense if you're confident the daemon can
 *     handle multiple parallel agent CLI spawns; safest to leave at 1.
 *   - Maintains previews/_manifest.json with one entry per successful lead.
 *     The approval-queue UI reads this file.
 *   - Optionally bundles each preview as a sales packet (--packet flag).
 *   - Prints a final summary table.
 *
 * Exit code 0 even if some leads fail — failures are recorded in the
 * manifest with status: 'failed' and the error message.
 */

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { parse: parseCsv } = require('csv-parse/sync');
const { runPreviewFor } = require('./generate-preview');
const { buildPacket } = require('./build-packet');

const PREVIEWS_DIR = path.resolve(process.cwd(), 'previews');
const MANIFEST_PATH = path.join(PREVIEWS_DIR, '_manifest.json');

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { csvPath: null, concurrency: 1, packet: false };
  for (const a of args) {
    if (a.startsWith('--concurrency=')) opts.concurrency = Math.max(1, parseInt(a.split('=')[1], 10) || 1);
    else if (a === '--packet') opts.packet = true;
    else if (!a.startsWith('-')) opts.csvPath = a;
  }
  return opts;
}

function readManifest() {
  try { return JSON.parse(fsSync.readFileSync(MANIFEST_PATH, 'utf8')); }
  catch { return { generatedAt: null, leads: {} }; }
}

async function writeManifest(manifest) {
  manifest.generatedAt = new Date().toISOString();
  await fs.mkdir(PREVIEWS_DIR, { recursive: true });
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}

async function runOne(rawLead, { packet }) {
  const result = await runPreviewFor(rawLead);
  if (packet) {
    try { await buildPacket(result.slug); }
    catch (err) { console.warn(`[batch] packet bundling failed for ${result.slug}:`, err.message); }
  }
  return result;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.csvPath) {
    console.error('Usage: node src/cli/run-batch.js <csv-path> [--concurrency=N] [--packet]');
    process.exit(1);
  }

  const csv = await fs.readFile(opts.csvPath, 'utf8');
  const rows = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true });
  if (!rows.length) {
    console.error('[batch] CSV has no rows');
    process.exit(1);
  }
  console.log(`[batch] ${rows.length} leads from ${path.basename(opts.csvPath)} · concurrency=${opts.concurrency}${opts.packet ? ' · packet' : ''}`);

  const manifest = readManifest();
  const results = [];
  const startedAt = Date.now();

  // Concurrent worker pool. Each worker pulls the next index until the queue is empty.
  let nextIdx = 0;
  async function worker(workerId) {
    while (true) {
      const idx = nextIdx++;
      if (idx >= rows.length) return;
      const row = rows[idx];
      const label = `[${idx + 1}/${rows.length}] ${row.business_name || '(unnamed)'}`;
      console.log(`${label} — starting`);
      try {
        const t0 = Date.now();
        const result = await runOne(row, opts);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`${label} — ok (${elapsed}s) · ${result.provider}`);
        results.push({ idx, status: 'ok', row, result });
        manifest.leads[result.slug] = {
          status: 'pending-review',
          businessName: result.brief.brand && result.brief.brand.name,
          niche: result.brief.niche,
          location: result.brief.location,
          provider: result.provider,
          designSystem: result.brief.designSystem && result.brief.designSystem.name,
          qa: result.qa,
          generatedAt: new Date().toISOString(),
          htmlPath: path.relative(PREVIEWS_DIR, result.htmlPath),
          assetsPath: `${result.slug}.assets`,
          packetPath: opts.packet ? `${result.slug}.packet.zip` : null
        };
        await writeManifest(manifest);
      } catch (err) {
        console.error(`${label} — failed: ${err.message}`);
        results.push({ idx, status: 'failed', row, error: err.message });
        manifest.leads[`failed-${idx}-${Date.now()}`] = {
          status: 'failed',
          businessName: row.business_name,
          niche: row.niche,
          location: [row.city, row.state].filter(Boolean).join(', '),
          error: err.message,
          generatedAt: new Date().toISOString()
        };
        await writeManifest(manifest);
      }
    }
  }
  await Promise.all(Array.from({ length: opts.concurrency }, (_, i) => worker(i)));

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const ok = results.filter(r => r.status === 'ok').length;
  const fail = results.length - ok;
  console.log(`\n[batch] done in ${elapsed}s · ok ${ok} · failed ${fail}`);
  console.log(`[batch] manifest: ${path.relative(process.cwd(), MANIFEST_PATH)}`);
  console.log(`[batch] approval queue: npm run approvals`);
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
