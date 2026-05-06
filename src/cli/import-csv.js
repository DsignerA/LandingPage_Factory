#!/usr/bin/env node
'use strict';

// Import a CSV of leads and generate previews for each.
// Pipeline per lead:
//   normalizeLead(rawLead)
//   -> buildSiteBrief(lead)
//   -> generatePageSchema(brief)
//   -> render(schema)
//   -> store({ lead_id, slug, html })
// Outputs a CSV mapping leads to preview URLs at src/storage/preview-urls.csv
// Deterministic, minimal, and production-minded (atomic write, per-lead error handling)

const fs = require('fs/promises');
const path = require('path');

const { normalizeLead } = require('../../core/lead-normalizer');
const buildSiteBrief = require('../data/site-brief-builder');
const { generate: generatePageSchema } = require('../ai/ai-page-generator');
const { render } = require('../engine/render-engine');
const { storePreview } = require('../preview/preview-storage');
const queue = require('../jobs/preview-queue');

const STORAGE_DIR = path.resolve(__dirname, '..', 'storage');
const OUTPUT_CSV = path.join(STORAGE_DIR, 'preview-urls.csv');
const QUEUED_CSV = path.join(STORAGE_DIR, 'queued-jobs.csv');

// Optional lead loader hook (if available)
function getLeadLoader() {
  try {
    // eslint-disable-next-line import/no-unresolved, global-require
    const loader = require('../data/lead-loader');
    return loader;
  } catch {
    return null;
  }
}

function csvParseLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') { inQuotes = true; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(content) {
  const text = String(content || '').replace(/^\uFEFF/, ''); // strip BOM
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const headers = csvParseLine(lines[0]).map(h => String(h || '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = csvParseLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cols[j] != null ? cols[j] : '';
    }
    rows.push(obj);
  }
  return rows;
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }

async function importCsv(inputPath, options = {}) {
  const absInput = path.resolve(process.cwd(), inputPath);
  const content = await fs.readFile(absInput, 'utf8');

  // Load rows via optional loader if available
  const loader = getLeadLoader();
  let rows;
  if (loader) {
    try {
      if (typeof loader.load === 'function') rows = await loader.load(absInput);
      else if (typeof loader.loadCsv === 'function') rows = await loader.loadCsv(absInput);
      else if (typeof loader.loadLeads === 'function') rows = await loader.loadLeads(absInput);
    } catch {}
  }
  if (!Array.isArray(rows)) rows = parseCsv(content);

  await ensureDir(STORAGE_DIR);

  const mode = String(options.mode || '').toLowerCase() === 'queue' || /--mode=queue/.test(process.argv.slice(3).join(' '))
    ? 'queue'
    : 'direct';

  if (mode === 'queue') {
    const outLines = ['lead_id,business_name,location,slug,job_id'];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i] || {};
      try {
        // Normalize to derive deterministic lead_id and slug without generating preview now
        const lead = normalizeLead(raw, {});
        const job = await queue.enqueue({ payload: { rawLead: raw } });
        const row = [
          lead.lead_id || '',
          lead.business_name || '',
          lead.location || '',
          lead.slug || '',
          job && job.job_id || ''
        ].map(csvEscape).join(',');
        outLines.push(row);
        console.log(`[enq] ${i + 1}/${rows.length} job_id=${job && job.job_id} slug=${lead.slug}`);
      } catch (err) {
        console.error(`[err] ${i + 1}/${rows.length} enqueue - ${(err && err.message) || err}`);
        const leadId = (raw && raw.lead_id) || '';
        const business = (raw && raw.business_name) || '';
        const location = raw && (raw.location || (raw.city || '') + (raw.state ? (raw.city ? ', ' : '') + raw.state : '')) || '';
        const row = [leadId, business, location, '', ''].map(csvEscape).join(',');
        outLines.push(row);
      }
    }

    const tmpPath = QUEUED_CSV + '.tmp';
    await fs.writeFile(tmpPath, outLines.join('\n') + '\n', 'utf8');
    await fs.rename(tmpPath, QUEUED_CSV);
    return { filepath: QUEUED_CSV, count: outLines.length - 1, mode };
  } else {
    const outLines = ['lead_id,business_name,location,slug,preview_url'];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i] || {};
      try {
        const lead = normalizeLead(raw, {});
        const brief = buildSiteBrief(lead, {});
        const schema = generatePageSchema(brief, {});
        const html = render(schema, { assetPrefix: '../' });
        const saved = await storePreview({
          lead_id: lead.lead_id,
          slug: brief.slug,
          html,
          business_name: brief.brand && brief.brand.name,
          location: brief.location,
          created_at: lead.created_at,
          generator: 'noop',
          schema_version: 'schema-1'
        });
        const previewUrl = saved.url;
        const csvRow = [lead.lead_id, brief.brand && brief.brand.name || '', brief.location || '', saved.slug, previewUrl]
          .map(csvEscape).join(',');
        outLines.push(csvRow);
        console.log(`[ok] ${i + 1}/${rows.length} lead_id=${lead.lead_id} slug=${saved.slug}`);
      } catch (err) {
        console.error(`[err] ${i + 1}/${rows.length} - ${(err && err.message) || err}`);
        const leadId = (raw && raw.lead_id) || '';
        const business = (raw && raw.business_name) || '';
        const location = raw && (raw.location || (raw.city || '') + (raw.state ? (raw.city ? ', ' : '') + raw.state : '')) || '';
        const csvRow = [leadId, business, location, '', ''].map(csvEscape).join(',');
        outLines.push(csvRow);
      }
    }

    const tmpPath = OUTPUT_CSV + '.tmp';
    await fs.writeFile(tmpPath, outLines.join('\n') + '\n', 'utf8');
    await fs.rename(tmpPath, OUTPUT_CSV);

    return { filepath: OUTPUT_CSV, count: outLines.length - 1, mode };
  }
}

module.exports = importCsv;

if (require.main === module) {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node src/cli/import-csv.js <leads.csv> [--mode=queue|direct]');
    process.exit(1);
  }
  const modeArg = process.argv.find(a => /^--mode=/.test(a));
  const mode = modeArg ? modeArg.split('=')[1] : undefined;
  importCsv(input, { mode })
    .then(({ filepath, count, mode: usedMode }) => {
      console.log(`\nProcessed ${count} lead(s) in ${usedMode || 'direct'} mode. CSV written to: ${filepath}`);
    })
    .catch(err => {
      console.error('Failed to import CSV:', err && err.stack ? err.stack : err);
      process.exitCode = 1;
    });
}
