'use strict';

/**
 * job-queue.js
 * ──────────────────────────────────────────────────────────────────────────────
 * In-process, event-driven job queue for the scale pipeline.
 *
 * Supports:
 *   - Multiple named queues (one per stage)
 *   - Configurable concurrency per queue
 *   - Automatic retry with exponential backoff
 *   - Dead-letter queue for exhausted jobs
 *   - Event emission on job lifecycle (enqueued, started, completed, failed, dead)
 *   - Priority ordering (higher priority processed first)
 *   - Pause/resume per queue
 *
 * Job types:
 *   audit_site | build_brief | generate_schema | render_preview |
 *   capture_screenshots | build_outreach_packet
 *
 * This is a single-process implementation designed to run within Node.js
 * worker_threads or child_process pools. For true multi-machine scale,
 * replace the queue backend with Redis/BullMQ while keeping the same interface.
 */

const EventEmitter = require('events');

// ── Constants ────────────────────────────────────────────────────────────────

const JOB_TYPES = [
  'audit_site',
  'build_brief',
  'generate_schema',
  'render_preview',
  'capture_screenshots',
  'build_outreach_packet',
];

// Stage → next stage mapping (defines the event-driven chain)
const NEXT_STAGE = {
  audit_site:            'build_brief',
  build_brief:           'generate_schema',
  generate_schema:       'render_preview',
  render_preview:        'capture_screenshots',
  capture_screenshots:   'build_outreach_packet',
  build_outreach_packet: null, // terminal
};

// Stage → event name mapping
const STAGE_EVENT = {
  audit_site:            'audit.completed',
  build_brief:           'brief.completed',
  generate_schema:       'schema.generated',
  render_preview:        'preview.rendered',
  capture_screenshots:   'screenshots.completed',
  build_outreach_packet: 'outreach.completed',
};

// Default concurrency per stage
const DEFAULT_CONCURRENCY = {
  audit_site:            20,
  build_brief:           10,
  generate_schema:       10,
  render_preview:        20,
  capture_screenshots:    5,
  build_outreach_packet: 10,
};

const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;

// ── Job class ────────────────────────────────────────────────────────────────

class Job {
  constructor({ job_type, lead_id, payload = {}, priority = 5, max_retries = DEFAULT_MAX_RETRIES }) {
    if (!JOB_TYPES.includes(job_type)) {
      throw new Error(`Unknown job_type: ${job_type}. Valid: ${JOB_TYPES.join(', ')}`);
    }
    this.job_id      = `${job_type}:${lead_id}:${Date.now()}`;
    this.job_type    = job_type;
    this.lead_id     = lead_id;
    this.payload     = payload;
    this.priority    = priority;
    this.max_retries = max_retries;
    this.attempts    = 0;
    this.status      = 'pending'; // pending | running | completed | failed | dead
    this.created_at  = new Date().toISOString();
    this.started_at  = null;
    this.ended_at    = null;
    this.duration_ms = null;
    this.error       = null;
    this.result      = null;
  }
}

// ── StageQueue class ─────────────────────────────────────────────────────────

class StageQueue extends EventEmitter {
  constructor(stage, { concurrency, maxRetries, store } = {}) {
    super();
    this.stage       = stage;
    this.concurrency = concurrency || DEFAULT_CONCURRENCY[stage] || 10;
    this.maxRetries  = maxRetries  || DEFAULT_MAX_RETRIES;
    this.store       = store || null; // ArtifactStore instance (optional)
    this._queue      = [];   // pending jobs (sorted by priority desc)
    this._running    = 0;
    this._paused     = false;
    this._handler    = null; // async function(job) → result
    this._stats      = {
      enqueued: 0, started: 0, completed: 0,
      failed: 0, dead: 0, total_ms: 0,
    };
  }

  // ── Register handler ───────────────────────────────────────────────────────

  process(handler) {
    this._handler = handler;
    this._drain();
    return this;
  }

  // ── Enqueue ────────────────────────────────────────────────────────────────

  enqueue(job) {
    if (!(job instanceof Job)) throw new Error('Must enqueue a Job instance');
    this._queue.push(job);
    this._queue.sort((a, b) => b.priority - a.priority);
    this._stats.enqueued++;
    this.emit('job.enqueued', job);
    setImmediate(() => this._drain());
    return job;
  }

  enqueueRaw(opts) {
    return this.enqueue(new Job({
      ...opts,
      job_type:    opts.job_type || this.stage,
      max_retries: opts.max_retries || this.maxRetries,
    }));
  }

  // ── Drain ──────────────────────────────────────────────────────────────────

  _drain() {
    if (this._paused || !this._handler) return;
    while (this._running < this.concurrency && this._queue.length > 0) {
      const job = this._queue.shift();
      this._execute(job);
    }
  }

  // ── Execute ────────────────────────────────────────────────────────────────

  async _execute(job) {
    this._running++;
    job.status     = 'running';
    job.started_at = new Date().toISOString();
    job.attempts++;
    this._stats.started++;
    this.emit('job.started', job);

    // Update artifact store status
    if (this.store) {
      await this.store.updateStageStatus(job.lead_id, this.stage, 'running', {
        started_at: job.started_at,
      }).catch(() => {});
    }

    const t0 = Date.now();
    try {
      const result = await this._handler(job);
      const ms = Date.now() - t0;

      job.status      = 'completed';
      job.ended_at    = new Date().toISOString();
      job.duration_ms = ms;
      job.result      = result;
      this._stats.completed++;
      this._stats.total_ms += ms;

      // Update artifact store status
      if (this.store) {
        await this.store.updateStageStatus(job.lead_id, this.stage, 'complete', {
          ended_at:    job.ended_at,
          duration_ms: ms,
        }).catch(() => {});
      }

      this.emit('job.completed', job);
      this.emit(STAGE_EVENT[this.stage] || `${this.stage}.completed`, job);

    } catch (err) {
      const ms = Date.now() - t0;
      job.ended_at    = new Date().toISOString();
      job.duration_ms = ms;
      job.error       = err instanceof Error ? err.message : String(err);
      this._stats.failed++;

      if (job.attempts < job.max_retries) {
        // Retry with exponential backoff
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, job.attempts - 1);
        job.status = 'pending';
        this.emit('job.retry', job, err);
        setTimeout(() => {
          this._queue.unshift(job); // re-insert at front
          this._drain();
        }, delay);
      } else {
        // Dead letter
        job.status = 'dead';
        this._stats.dead++;
        this.emit('job.dead', job, err);

        if (this.store) {
          await this.store.writeDeadLetter(job, err).catch(() => {});
          await this.store.updateStageStatus(job.lead_id, this.stage, 'failed', {
            ended_at: job.ended_at,
            error:    job.error,
          }).catch(() => {});
        }
      }
    } finally {
      this._running--;
      this._drain();
    }
  }

  // ── Control ────────────────────────────────────────────────────────────────

  pause()  { this._paused = true; }
  resume() { this._paused = false; this._drain(); }

  get size()    { return this._queue.length; }
  get running() { return this._running; }

  get stats() {
    return {
      ...this._stats,
      pending:  this._queue.length,
      running:  this._running,
      avg_ms:   this._stats.completed > 0
        ? Math.round(this._stats.total_ms / this._stats.completed)
        : 0,
    };
  }

  // Wait until queue is empty and all jobs are done
  drain() {
    return new Promise(resolve => {
      const check = () => {
        if (this._queue.length === 0 && this._running === 0) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }
}

// ── PipelineQueue class ──────────────────────────────────────────────────────
// Orchestrates all stage queues and wires the event-driven chain.

class PipelineQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.store      = options.store || null;
    this.concurrency = options.concurrency || {};
    this.maxRetries  = options.maxRetries  || DEFAULT_MAX_RETRIES;
    this._queues     = {};
    this._autoChain  = options.autoChain !== false; // default: true

    // Create a StageQueue for each job type
    for (const stage of JOB_TYPES) {
      const q = new StageQueue(stage, {
        concurrency: this.concurrency[stage] || DEFAULT_CONCURRENCY[stage],
        maxRetries:  this.maxRetries,
        store:       this.store,
      });

      // Bubble events up
      q.on('job.enqueued',  job => this.emit('job.enqueued',  job));
      q.on('job.started',   job => this.emit('job.started',   job));
      q.on('job.completed', job => this.emit('job.completed', job));
      q.on('job.retry',     (job, err) => this.emit('job.retry', job, err));
      q.on('job.dead',      (job, err) => this.emit('job.dead',  job, err));

      // Auto-chain: on completion, enqueue the next stage
      if (this._autoChain) {
        const nextStage = NEXT_STAGE[stage];
        if (nextStage) {
          q.on('job.completed', (job) => {
            // Only auto-chain if the lead has a tier that allows the next stage
            const tier = job.payload && job.payload.tier;
            if (this._shouldRunStage(nextStage, tier)) {
              this.enqueue({
                job_type: nextStage,
                lead_id:  job.lead_id,
                payload:  { ...job.payload, prev_result: job.result },
                priority: job.priority,
              });
            }
          });
        }
      }

      this._queues[stage] = q;
    }
  }

  // ── Tier-based stage gating ────────────────────────────────────────────────

  _shouldRunStage(stage, tier) {
    if (!tier) return true; // no tier = run everything
    const tierA = ['audit_site', 'build_brief', 'generate_schema', 'render_preview', 'capture_screenshots', 'build_outreach_packet'];
    const tierB = ['audit_site', 'build_brief', 'generate_schema', 'render_preview'];
    const tierC = ['audit_site'];
    const allowed = tier === 'A' ? tierA : tier === 'B' ? tierB : tierC;
    return allowed.includes(stage);
  }

  // ── Register handlers ──────────────────────────────────────────────────────

  process(stage, handler) {
    const q = this._queues[stage];
    if (!q) throw new Error(`Unknown stage: ${stage}`);
    q.process(handler);
    return this;
  }

  // ── Enqueue ────────────────────────────────────────────────────────────────

  enqueue(opts) {
    const stage = opts.job_type;
    const q = this._queues[stage];
    if (!q) throw new Error(`Unknown stage: ${stage}`);
    return q.enqueueRaw(opts);
  }

  // ── Bulk import ────────────────────────────────────────────────────────────

  importLeads(leads, extraPayload = {}) {
    const jobs = [];
    for (const lead of leads) {
      const job = this.enqueue({
        job_type: 'audit_site',
        lead_id:  lead.lead_id,
        payload:  { lead, tier: lead.tier || 'A', ...extraPayload },
        priority: lead.priority || 5,
      });
      jobs.push(job);
    }
    this.emit('leads.imported', { count: leads.length });
    return jobs;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  get stats() {
    const result = { stages: {} };
    for (const [stage, q] of Object.entries(this._queues)) {
      result.stages[stage] = q.stats;
    }
    result.total_enqueued  = Object.values(this._queues).reduce((s, q) => s + q.stats.enqueued, 0);
    result.total_completed = Object.values(this._queues).reduce((s, q) => s + q.stats.completed, 0);
    result.total_failed    = Object.values(this._queues).reduce((s, q) => s + q.stats.failed, 0);
    result.total_dead      = Object.values(this._queues).reduce((s, q) => s + q.stats.dead, 0);
    return result;
  }

  // ── Drain all queues ───────────────────────────────────────────────────────
  // Sequentially drains each stage in pipeline order to handle chained jobs.

  async drainAll() {
    // Drain in pipeline order so chained jobs complete before we check the next stage
    for (const stage of JOB_TYPES) {
      await this._queues[stage].drain();
    }
    // Second pass to catch any late-arriving chained jobs
    for (const stage of JOB_TYPES) {
      await this._queues[stage].drain();
    }
  }

  // ── Pause/resume all ──────────────────────────────────────────────────────

  pauseAll()  { Object.values(this._queues).forEach(q => q.pause()); }
  resumeAll() { Object.values(this._queues).forEach(q => q.resume()); }

  queue(stage) { return this._queues[stage]; }
}

module.exports = { PipelineQueue, StageQueue, Job, JOB_TYPES, NEXT_STAGE, STAGE_EVENT };
