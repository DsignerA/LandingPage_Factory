'use strict';

// Minimal JSONL-based preview job queue
// - Queue file: src/storage/preview-queue.jsonl
// - Single-process safe (no locking). Production-minded but simple.
// - API: enqueue(job), getNextJob(), markCompleted(jobId, result?), markFailed(jobId, error?)

const fs = require('fs/promises');
const path = require('path');

const QUEUE_DIR = path.resolve(__dirname, '..', 'storage');
const QUEUE_PATH = path.join(QUEUE_DIR, 'preview-queue.jsonl');

function toStringSafe(v) { return v == null ? '' : String(v); }
function collapseSpaces(s) { return toStringSafe(s).replace(/\s+/g, ' ').trim(); }

function fnv1a32(str) {
  const s = toStringSafe(str);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function jobIdFromPayload(payload) {
  const canonical = JSON.stringify(payload || {});
  return 'job_' + fnv1a32(canonical);
}

async function ensureQueue() {
  await fs.mkdir(QUEUE_DIR, { recursive: true });
  try { await fs.access(QUEUE_PATH); }
  catch { await fs.writeFile(QUEUE_PATH, '', 'utf8'); }
}

async function readAllLines() {
  await ensureQueue();
  const raw = await fs.readFile(QUEUE_PATH, 'utf8');
  return raw.split(/\r?\n/).filter(Boolean);
}

async function writeAllRecords(records) {
  // records: array of plain objects; write as JSONL atomically
  const lines = records.map(r => JSON.stringify(r));
  const tmp = QUEUE_PATH + '.tmp';
  await fs.writeFile(tmp, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  await fs.rename(tmp, QUEUE_PATH);
}

async function readAllRecords() {
  const lines = await readAllLines();
  const recs = [];
  for (const line of lines) {
    try { recs.push(JSON.parse(line)); } catch {}
  }
  return recs;
}

function nowIso() {
  try { return new Date().toISOString(); } catch { return null; }
}

async function enqueue(job) {
  const payload = job && job.payload ? job.payload : job;
  const created_at = collapseSpaces(job && job.created_at) || nowIso();
  const job_id = collapseSpaces(job && job.job_id) || jobIdFromPayload(payload);

  const rec = { job_id, status: 'queued', payload, created_at, updated_at: created_at };

  const records = await readAllRecords();
  // de-dupe by job_id
  if (records.find(r => r && r.job_id === job_id)) {
    return records.find(r => r && r.job_id === job_id);
  }
  records.push(rec);
  await writeAllRecords(records);
  return rec;
}

async function getNextJob() {
  const records = await readAllRecords();
  const idx = records.findIndex(r => r && r.status === 'queued');
  if (idx === -1) return null;
  records[idx] = { ...records[idx], status: 'processing', updated_at: nowIso() };
  await writeAllRecords(records);
  return records[idx];
}

async function markCompleted(jobId, result) {
  const records = await readAllRecords();
  const idx = records.findIndex(r => r && r.job_id === jobId);
  if (idx === -1) return false;
  records[idx] = { ...records[idx], status: 'completed', result: result || null, updated_at: nowIso() };
  await writeAllRecords(records);
  return true;
}

async function markFailed(jobId, error) {
  const records = await readAllRecords();
  const idx = records.findIndex(r => r && r.job_id === jobId);
  if (idx === -1) return false;
  records[idx] = { ...records[idx], status: 'failed', error: toStringSafe(error && error.message ? error.message : error), updated_at: nowIso() };
  await writeAllRecords(records);
  return true;
}

module.exports = {
  enqueue,
  getNextJob,
  markCompleted,
  markFailed
};
