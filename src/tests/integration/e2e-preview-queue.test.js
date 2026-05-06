'use strict';

const assert = require('assert');
const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const queue = require('../../jobs/preview-queue');
const previewIndex = require('../../preview/preview-index');

const QUEUE_FILE = path.resolve(__dirname, '../../storage/preview-queue.jsonl');

async function readQueueRecord(jobId) {
  try {
    const raw = await fs.readFile(QUEUE_FILE, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const rec = JSON.parse(line);
        if (rec && rec.job_id === jobId) return rec;
      } catch {}
    }
  } catch {}
  return null;
}

async function waitForCompletion(jobId, { timeoutMs = 10000, intervalMs = 200 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rec = await readQueueRecord(jobId);
    if (rec && rec.status === 'completed') return rec;
    if (rec && rec.status === 'failed') throw new Error('Job failed: ' + (rec.error || ''));
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Timed out waiting for job completion');
}

async function run() {
  // 1) Enqueue a job
  const rawLead = {
    business_name: 'Acme Dental',
    niche: 'dentist',
    city: 'Austin',
    state: 'Texas',
    offer_angle: 'Book more new patient appointments',
    notes: 'Weaknesses:\n- Few reviews\nOpportunities:\n- Online booking\n- FAQ improvements'
  };

  const job = await queue.enqueue({ payload: { rawLead } });
  assert.ok(job && job.job_id, 'queued job should have job_id');
  assert.strictEqual(job.status, 'queued');

  // 2) Start worker (child process) to process the job
  const workerPath = path.resolve(process.cwd(), 'src/workers/preview-worker.js');
  const worker = spawn(process.execPath, [workerPath], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, JOB_POLL_MS: '200' }
  });

  // 3) Wait for completion and collect record
  const completed = await waitForCompletion(job.job_id, { timeoutMs: 15000, intervalMs: 250 });

  // 4) Stop worker
  try { worker.kill(); } catch {}

  // 5) Verify completed job includes result metadata if available
  assert.ok(completed && completed.status === 'completed');
  assert.ok(completed.result && completed.result.preview, 'completed job should include preview result');

  const previewMeta = completed.result.preview;
  assert.strictEqual(typeof previewMeta.slug, 'string');
  assert.strictEqual(typeof previewMeta.path, 'string');

  // 6) Verify preview HTML file exists
  const st = await fs.stat(previewMeta.path);
  assert.ok(st.isFile(), 'preview HTML should be written');

  // 7) Verify preview index contains record by slug
  const rec = await previewIndex.getBySlug(previewMeta.slug);
  assert.ok(rec && rec.slug === previewMeta.slug, 'preview index should contain record by slug');
  assert.strictEqual(rec.file_path, previewMeta.path);

  // Cleanup only test artifact: the preview html file
  try { await fs.unlink(previewMeta.path); } catch {}

  console.log('E2E: preview queue pipeline passed.');
}

run().catch(err => {
  console.error('E2E: preview queue pipeline failed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
