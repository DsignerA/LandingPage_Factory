#!/usr/bin/env node
'use strict';

/**
 * build-approval-queue.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Tiny review dashboard for the outbound team. Runs a local Express server
 * on port 17900 (configurable via APPROVAL_PORT) that serves a static
 * `previews/index.html` listing every lead in `previews/_manifest.json` and
 * accepts approve/reject decisions via POST.
 *
 * Decisions move the artifacts into `previews/approved/` or
 * `previews/rejected/` subfolders and update the manifest entry's status.
 *
 * Usage:
 *   npm run approvals          # boots server + opens browser
 *   APPROVAL_PORT=18000 ...    # custom port
 *
 * Stop with Ctrl-C. Decisions are file-system-driven, so safe to run
 * multiple instances or kill mid-review.
 */

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const express = require('express');
const { spawn } = require('child_process');
const { buildPacket } = require('./build-packet');

const PORT = parseInt(process.env.APPROVAL_PORT, 10) || 17900;
const PREVIEWS_DIR = path.resolve(process.cwd(), 'previews');
const MANIFEST_PATH = path.join(PREVIEWS_DIR, '_manifest.json');

function readManifest() {
  try { return JSON.parse(fsSync.readFileSync(MANIFEST_PATH, 'utf8')); }
  catch { return { generatedAt: null, leads: {} }; }
}

async function writeManifest(m) {
  m.generatedAt = new Date().toISOString();
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(m, null, 2), 'utf8');
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderIndex(manifest) {
  const entries = Object.entries(manifest.leads || {});
  // Newest first
  entries.sort(([, a], [, b]) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')));

  const grouped = {
    'pending-review': [],
    'approved': [],
    'rejected': [],
    'failed': []
  };
  for (const [slug, entry] of entries) {
    const status = entry.status || 'pending-review';
    (grouped[status] || grouped['pending-review']).push({ slug, ...entry });
  }

  function leadCard({ slug, businessName, niche, location, provider, designSystem, qa, status, htmlPath, packetPath }) {
    const thumb = htmlPath && htmlPath.endsWith('.html')
      ? `<iframe src="/preview/${escapeHtml(slug)}" loading="lazy" sandbox="allow-same-origin"></iframe>`
      : '<div class="thumb-placeholder">(no preview)</div>';
    const qaBadge = qa && typeof qa.score === 'number'
      ? `<span class="qa-badge" data-score="${qa.score.toFixed(0)}">QA ${qa.score.toFixed(1)}</span>`
      : '';
    const actionRow = status === 'pending-review' ? `
        <div class="actions">
          <a class="btn btn-preview" href="/preview/${escapeHtml(slug)}" target="_blank">Open Full</a>
          <button class="btn btn-approve" data-slug="${escapeHtml(slug)}" data-action="approve">Approve</button>
          <button class="btn btn-reject" data-slug="${escapeHtml(slug)}" data-action="reject">Reject</button>
          <button class="btn btn-packet" data-slug="${escapeHtml(slug)}" data-action="packet">Build Packet</button>
        </div>` : `
        <div class="actions">
          <a class="btn btn-preview" href="/preview/${escapeHtml(slug)}" target="_blank">Open Full</a>
          ${packetPath ? `<a class="btn btn-packet" href="/file/${escapeHtml(packetPath)}" download>Download Packet</a>` : ''}
          ${status !== 'pending-review' ? `<button class="btn btn-revert" data-slug="${escapeHtml(slug)}" data-action="revert">Move back to review</button>` : ''}
        </div>`;
    return `
      <article class="card status-${escapeHtml(status)}">
        <div class="thumb">${thumb}</div>
        <div class="meta">
          <header>
            <h2>${escapeHtml(businessName || slug)}</h2>
            <div class="sub">${escapeHtml([niche, location].filter(Boolean).join(' · '))}</div>
          </header>
          <dl>
            <dt>Provider</dt><dd>${escapeHtml(provider || '?')}</dd>
            <dt>Design system</dt><dd>${escapeHtml(designSystem || '—')}</dd>
            ${qa && qa.suggest ? `<dt>QA suggestion</dt><dd>${escapeHtml(qa.suggest)}</dd>` : ''}
            ${qaBadge ? `<dt>QA score</dt><dd>${qaBadge}</dd>` : ''}
          </dl>
          ${actionRow}
        </div>
      </article>`;
  }

  function section(title, items, emptyText) {
    return `
      <section>
        <h1>${escapeHtml(title)} <span class="count">${items.length}</span></h1>
        ${items.length ? items.map(leadCard).join('\n') : `<div class="empty">${escapeHtml(emptyText)}</div>`}
      </section>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Approval Queue · Landing Page Factory</title>
  <style>
    :root {
      --bg: #0f172a; --surface: #1e293b; --surface-2: #334155;
      --text: #f8fafc; --muted: #94a3b8; --border: rgba(255,255,255,0.08);
      --ok: #16a34a; --bad: #dc2626; --warn: #f59e0b; --accent: #38bdf8;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .topbar { padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .topbar h1 { font-size: 1.125rem; margin: 0; }
    .topbar .meta { color: var(--muted); font-size: 0.8125rem; }
    section { padding: 1.5rem; }
    section > h1 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 0 0 1rem; }
    .count { color: var(--accent); margin-left: 0.5rem; font-weight: 700; }
    .empty { color: var(--muted); font-style: italic; padding: 0.5rem 0 1rem; }
    .card { display: grid; grid-template-columns: 420px 1fr; gap: 1.25rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 1.25rem; overflow: hidden; }
    .card.status-approved { border-left: 3px solid var(--ok); }
    .card.status-rejected { border-left: 3px solid var(--bad); opacity: 0.65; }
    .card.status-failed   { border-left: 3px solid var(--warn); }
    .thumb { background: white; min-height: 320px; max-height: 480px; overflow: hidden; }
    .thumb iframe { width: 100%; height: 100%; min-height: 320px; border: 0; transform: scale(0.5); transform-origin: top left; width: 200%; height: 200%; }
    .thumb-placeholder { display: flex; align-items: center; justify-content: center; height: 320px; color: #888; }
    .meta { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .meta header h2 { margin: 0 0 0.15rem; font-size: 1.125rem; }
    .meta header .sub { color: var(--muted); font-size: 0.8125rem; }
    .meta dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 0.875rem; font-size: 0.8125rem; }
    .meta dt { color: var(--muted); }
    .meta dd { margin: 0; }
    .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid var(--border); }
    .btn { padding: 0.5rem 0.875rem; border-radius: 6px; border: 0; cursor: pointer; font-weight: 600; font-size: 0.8125rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem; }
    .btn-preview { background: var(--surface-2); color: var(--text); }
    .btn-approve { background: var(--ok); color: white; }
    .btn-reject  { background: var(--bad); color: white; }
    .btn-packet  { background: var(--accent); color: #0f172a; }
    .btn-revert  { background: var(--surface-2); color: var(--text); border: 1px solid var(--border); }
    .btn:hover { filter: brightness(1.1); }
    .qa-badge { background: var(--surface-2); padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 600; }
    .qa-badge[data-score="9"], .qa-badge[data-score="10"] { background: rgba(22,163,74,0.25); color: #4ade80; }
    .qa-badge[data-score="6"], .qa-badge[data-score="7"], .qa-badge[data-score="8"] { background: rgba(56,189,248,0.2); color: #67e8f9; }
    .qa-badge[data-score="4"], .qa-badge[data-score="5"] { background: rgba(245,158,11,0.2); color: #fbbf24; }
    .qa-badge[data-score="0"], .qa-badge[data-score="1"], .qa-badge[data-score="2"], .qa-badge[data-score="3"] { background: rgba(220,38,38,0.25); color: #fca5a5; }
    @media (max-width: 900px) { .card { grid-template-columns: 1fr; } .thumb iframe { transform: scale(0.7); width: 142%; height: 142%; } }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>Landing Page Factory · Approval Queue</h1>
    <div class="meta">${escapeHtml(entries.length)} leads · last updated ${escapeHtml(manifest.generatedAt || 'never')}</div>
  </div>
  ${section('Pending review', grouped['pending-review'], 'No leads waiting on review.')}
  ${section('Approved',       grouped['approved'],       'No approved leads yet.')}
  ${section('Rejected',       grouped['rejected'],       'No rejected leads.')}
  ${section('Failed',         grouped['failed'],         'No failed leads.')}
  <script>
    async function decide(slug, action) {
      const res = await fetch('/api/' + action + '/' + slug, { method: 'POST' });
      if (!res.ok) { alert('Failed: ' + await res.text()); return; }
      location.reload();
    }
    document.querySelectorAll('button[data-slug]').forEach(btn => {
      btn.addEventListener('click', () => decide(btn.dataset.slug, btn.dataset.action));
    });
  </script>
</body>
</html>`;
}

async function moveLeadFiles(slug, toStatus) {
  const targetDir = path.join(PREVIEWS_DIR, toStatus);
  await fs.mkdir(targetDir, { recursive: true });
  // Move: {slug}.html, {slug}.assets/, {slug}.design.md, {slug}.qa.json, {slug}.packet.zip
  for (const suffix of ['.html', '.assets', '.design.md', '.qa.json', '.packet.zip']) {
    const src = path.join(PREVIEWS_DIR, slug + suffix);
    const dst = path.join(targetDir, slug + suffix);
    try { await fs.rename(src, dst); } catch {}
  }
}

async function revertLeadFiles(slug, fromStatus) {
  const srcDir = path.join(PREVIEWS_DIR, fromStatus);
  for (const suffix of ['.html', '.assets', '.design.md', '.qa.json', '.packet.zip']) {
    const src = path.join(srcDir, slug + suffix);
    const dst = path.join(PREVIEWS_DIR, slug + suffix);
    try { await fs.rename(src, dst); } catch {}
  }
}

function buildServer() {
  const app = express();

  app.get('/', (req, res) => {
    const manifest = readManifest();
    res.set('content-type', 'text/html');
    res.send(renderIndex(manifest));
  });

  // Serve a preview HTML (from either previews/ or previews/approved|rejected/)
  app.get('/preview/:slug', (req, res) => {
    const slug = req.params.slug;
    for (const sub of ['', 'approved', 'rejected']) {
      const candidate = path.join(PREVIEWS_DIR, sub, `${slug}.html`);
      if (fsSync.existsSync(candidate)) return res.sendFile(candidate);
    }
    res.status(404).send('not found');
  });

  // Serve any file under previews/ (assets, packet.zip)
  app.use('/file', express.static(PREVIEWS_DIR));

  // Decision endpoints
  app.post('/api/:action/:slug', async (req, res) => {
    const { action, slug } = req.params;
    const manifest = readManifest();
    const entry = manifest.leads[slug];
    if (!entry) return res.status(404).send('lead not in manifest');

    try {
      if (action === 'approve') {
        await moveLeadFiles(slug, 'approved');
        entry.status = 'approved';
        entry.decidedAt = new Date().toISOString();
      } else if (action === 'reject') {
        await moveLeadFiles(slug, 'rejected');
        entry.status = 'rejected';
        entry.decidedAt = new Date().toISOString();
      } else if (action === 'revert') {
        const current = entry.status;
        if (current === 'approved' || current === 'rejected') {
          await revertLeadFiles(slug, current);
          entry.status = 'pending-review';
          delete entry.decidedAt;
        }
      } else if (action === 'packet') {
        await buildPacket(slug);
        entry.packetPath = `${slug}.packet.zip`;
      } else {
        return res.status(400).send('unknown action');
      }
      await writeManifest(manifest);
      res.json({ ok: true, status: entry.status });
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  return app;
}

async function buildStaticIndex() {
  const manifest = readManifest();
  await fs.mkdir(PREVIEWS_DIR, { recursive: true });
  await fs.writeFile(path.join(PREVIEWS_DIR, 'index.html'), renderIndex(manifest), 'utf8');
}

async function main() {
  await buildStaticIndex();
  const app = buildServer();
  app.listen(PORT, () => {
    const url = `http://127.0.0.1:${PORT}/`;
    console.log(`[approvals] dashboard at ${url}`);
    // Best-effort browser open (macOS)
    spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
  });
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { buildServer, buildStaticIndex, renderIndex };
