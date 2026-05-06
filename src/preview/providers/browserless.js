'use strict';
/**
 * browserless.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Screenshot provider backed by the Browserless.io remote headless-browser API.
 *
 * Supported URLs: http:// and https:// only.
 *
 * ⚠️  file:// previews are NOT supported by this provider.
 *     Browserless runs in a remote sandbox and cannot access your local
 *     filesystem.  Attempting to screenshot a non-self-contained file:// URL
 *     via Browserless will produce a blank or broken capture.
 *
 *     Alternatives:
 *       • Set SCREENSHOT_PROVIDER=local  (uses Playwright on this machine)
 *       • Serve the preview via HTTP first (e.g. `npx serve ./previews`) and
 *         pass the resulting http://localhost URL instead.
 *
 * Environment variables:
 *   BROWSERLESS_TOKEN   – API token (required for http/https captures)
 *   BROWSERLESS_URL     – Base URL, defaults to https://chrome.browserless.io
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const providerName = 'browserless';

/**
 * Resolve the Browserless endpoint from environment.
 */
function getEndpoint() {
  const base  = (process.env.BROWSERLESS_URL || 'https://chrome.browserless.io').replace(/\/$/, '');
  const token = process.env.BROWSERLESS_TOKEN || '';
  return { base, token };
}

/**
 * capture(url, outputPath, options?)
 *
 * @param {string} url         – Public http/https URL to screenshot
 * @param {string} outputPath  – Absolute path to write the PNG
 * @param {object} [options]
 * @param {number} [options.viewportWidth=1280]
 * @param {number} [options.viewportHeight=800]
 * @param {boolean}[options.fullPage=true]
 * @returns {Promise<{success:boolean, path:string|null, provider:string, error:string|null}>}
 */
async function capture(url, outputPath, options = {}) {
  const {
    viewportWidth  = 1280,
    viewportHeight = 800,
    fullPage       = true,
  } = options;

  // ── Fail fast for file:// URLs ─────────────────────────────────────────────
  if (url && url.startsWith('file://')) {
    return {
      success:  false,
      path:     null,
      provider: providerName,
      error: [
        'Browserless cannot reliably capture non-self-contained file:// previews.',
        'The remote Browserless sandbox has no access to your local filesystem.',
        'Recommended fix: set SCREENSHOT_PROVIDER=local to use the local Playwright',
        'provider, or serve the preview via HTTP/HTTPS first (e.g. `npx serve ./previews`)',
        'and pass the resulting http:// URL.',
      ].join(' '),
    };
  }

  const { base, token } = getEndpoint();
  if (!token) {
    return {
      success:  false,
      path:     null,
      provider: providerName,
      error: 'BROWSERLESS_TOKEN is not set. Cannot call Browserless API.',
    };
  }

  const apiUrl = `${base}/screenshot?token=${encodeURIComponent(token)}`;
  const body   = JSON.stringify({
    url,
    options: {
      type:     'png',
      fullPage,
    },
    viewport: {
      width:  viewportWidth,
      height: viewportHeight,
    },
  });

  return new Promise((resolve) => {
    const parsed   = new URL(apiUrl);
    const lib      = parsed.protocol === 'https:' ? https : http;
    const reqOpts  = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control':  'no-cache',
      },
    };

    const req = lib.request(reqOpts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          const msg = Buffer.concat(chunks).toString('utf8').slice(0, 300);
          return resolve({
            success:  false,
            path:     null,
            provider: providerName,
            error: `Browserless API returned HTTP ${res.statusCode}: ${msg}`,
          });
        }
        try {
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(outputPath, Buffer.concat(chunks));
          resolve({ success: true, path: outputPath, provider: providerName, error: null });
        } catch (writeErr) {
          resolve({
            success:  false,
            path:     null,
            provider: providerName,
            error: `Failed to write screenshot: ${writeErr.message}`,
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success:  false,
        path:     null,
        provider: providerName,
        error: `Browserless request failed: ${err.message}`,
      });
    });

    req.write(body);
    req.end();
  });
}

module.exports = { capture, providerName };
