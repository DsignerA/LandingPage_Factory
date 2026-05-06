#!/usr/bin/env node
'use strict';
/**
 * smoke-campaign.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Smoke test: runs a single lead from data/sample-leads.csv through the full
 * campaign pipeline (audit → brief → schema → render → screenshots → outreach)
 * and writes output to ./smoke-output.
 *
 * Usage:
 *   node src/tests/smoke-campaign.js
 *   npm run smoke
 *
 * Exit codes:
 *   0 — pipeline completed without fatal errors
 *   1 — pipeline crashed or lead processing failed
 *
 * Notes:
 *   - Uses the first lead in data/sample-leads.csv by default.
 *   - Screenshots are skipped (--no-screenshots) to keep the smoke test fast
 *     and dependency-free (no Playwright browser required).
 *   - Output is written to ./smoke-output and can be safely deleted.
 */

const path   = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const CSV_PATH     = path.join(PROJECT_ROOT, 'data', 'sample-leads.csv');
const OUT_DIR      = path.join(PROJECT_ROOT, 'smoke-output');
const CLI          = path.join(PROJECT_ROOT, 'src', 'cli', 'run-campaign.js');

// Pick the first lead name from the CSV for --single filtering
function getFirstLeadName(csvPath) {
  const fs = require('fs');
  try {
    const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;
    // Header row: lead_id,business_name,...
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
    const nameIdx = headers.indexOf('business_name');
    if (nameIdx === -1) return null;
    const firstRow = lines[1].split(',');
    return (firstRow[nameIdx] || '').replace(/^"|"$/g, '').trim();
  } catch {
    return null;
  }
}

function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  SMOKE TEST — landing-builder-factory campaign CLI   ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  const firstName = getFirstLeadName(CSV_PATH);
  if (!firstName) {
    console.error('[smoke] Could not determine first lead name from', CSV_PATH);
    process.exit(1);
  }

  console.log(`[smoke] CSV:      ${CSV_PATH}`);
  console.log(`[smoke] Lead:     "${firstName}"`);
  console.log(`[smoke] Out dir:  ${OUT_DIR}`);
  console.log('');

  const args = [
    CLI,
    CSV_PATH,
    '--single', firstName,
    '--out-dir', OUT_DIR,
    '--no-screenshots',
    '--verbose',
  ];

  console.log('[smoke] Running: node', args.join(' '));
  console.log('');

  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    cwd:   PROJECT_ROOT,
  });

  if (result.error) {
    console.error('[smoke] Failed to spawn process:', result.error.message);
    process.exit(1);
  }

  const code = result.status;
  console.log('');
  if (code === 0) {
    console.log('✅  Smoke test PASSED (exit 0)');
    console.log(`    Output: ${OUT_DIR}`);
  } else {
    console.error(`❌  Smoke test FAILED (exit ${code})`);
    process.exit(code || 1);
  }
}

main();
