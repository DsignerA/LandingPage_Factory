'use strict';

// Minimal HTTP server for preview delivery using plain Node http
// - GET /health -> 200 with JSON { status: 'ok' }
// - GET /p/:slug -> looks up preview via preview-index and serves HTML from record.file_path
//   Returns 404 if the preview does not exist.
//
// Exports:
// - start(port?, options?): starts the server, returns a Promise { server, port, host }
// - createServer(options?): returns an http.Server instance (not listening)
//
// Assumptions:
// - Single-process, local filesystem storage
// - preview-index records contain a trusted absolute file_path

const http = require('http');
const { URL } = require('url');
const fs = require('fs/promises');
const previewIndex = require('../preview/preview-index');
const { logEvent } = require('../preview/preview-events');

function isValidSlug(s) {
  return /^[a-z0-9-]+$/.test(String(s || ''));
}

function sendJson(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function sendHtml(res, code, html) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(html);
}

function notFound(res) { sendJson(res, 404, { error: 'not_found' }); }
function badRequest(res, msg) { sendJson(res, 400, { error: 'bad_request', message: msg || 'invalid_request' }); }
function serverError(res) { sendJson(res, 500, { error: 'server_error' }); }

function getClientIp(req) {
  const xf = (req.headers['x-forwarded-for'] || '').toString();
  if (xf) {
    const first = xf.split(',')[0].trim();
    if (first) return first;
  }
  const ra = (req.socket && req.socket.remoteAddress) || '';
  // Normalize IPv6-mapped IPv4
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ra);
  return m ? m[1] : ra;
}

function createServer(options = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      const method = (req.method || 'GET').toUpperCase();
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname || '/';

      // Health
      if (method === 'GET' && pathname === '/health') {
        return sendJson(res, 200, { status: 'ok' });
      }

      // Preview by slug: /p/:slug
      if (method === 'GET' && pathname.startsWith('/p/')) {
        const slug = pathname.slice(3).replace(/\/+$/, '').toLowerCase();
        if (!isValidSlug(slug)) return badRequest(res, 'invalid_slug');

        const rec = await previewIndex.getBySlug(slug);
        if (!rec || !rec.file_path) return notFound(res);

        // Log preview_viewed event (best-effort)
        try {
          await logEvent({
            event: 'preview_viewed',
            slug: rec.slug || slug,
            lead_id: rec.lead_id || '',
            timestamp: new Date().toISOString(),
            ip: getClientIp(req),
            user_agent: (req.headers['user-agent'] || '').toString(),
            referrer: (req.headers['referer'] || req.headers['referrer'] || '').toString()
          });
        } catch {}

        try {
          const html = await fs.readFile(rec.file_path, 'utf8');
          return sendHtml(res, 200, html);
        } catch (e) {
          if (e && e.code === 'ENOENT') return notFound(res);
          return serverError(res);
        }
      }

      // Fallback 404
      return notFound(res);
    } catch (err) {
      return serverError(res);
    }
  });

  return server;
}

function start(port, options = {}) {
  const listenPort = Number(port || process.env.PORT || 3000);
  const host = options.host || process.env.HOST || '0.0.0.0';
  const server = createServer(options);

  return new Promise((resolve, reject) => {
    server.listen(listenPort, host, () => resolve({ server, port: listenPort, host }));
    server.on('error', reject);
  });
}

module.exports = { createServer, start };
