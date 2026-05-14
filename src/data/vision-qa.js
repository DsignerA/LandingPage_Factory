'use strict';

/**
 * vision-qa.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Shared vision-QA scoring used by both `scripts/vision-qa.js` (manual)
 * and the auto-retry loop in `src/cli/generate-preview.js`.
 *
 * Given (lead screenshot, our preview screenshot), asks Claude vision to score
 * brand fidelity, modernity, and conversion strength on a 1-10 scale and
 * return what was kept / missed / one suggested improvement.
 *
 * Returns:
 *   {
 *     scores: { brandFidelity, modernity, conversionStrength },
 *     average,
 *     kept:     [string, …],
 *     missed:   [string, …],
 *     suggest:  string,
 *     model:    string,
 *     skipped?: string  // when ANTHROPIC_API_KEY is missing
 *   }
 */

const fs = require('fs/promises');

const DEFAULT_MODEL = process.env.LANDING_BUILDER_LLM_MODEL || 'claude-sonnet-4-6';
const PROMPT = (
  'Two screenshots of restaurant landing pages.\n' +
  '1. LEAD: the business\'s current website.\n' +
  '2. OURS: the modernized version we generated.\n\n' +
  'Score OURS (1-10 each) on: brandFidelity (uses the same colors/logo/imagery/tone), ' +
  'modernity (cleaner, better hierarchy, mobile-friendly look), ' +
  'conversionStrength (clear primary CTA, trust signals, easy reservation/order path).\n' +
  'Also list: kept (what we preserved well from the lead), missed (what brand DNA we dropped), ' +
  'suggest (the single highest-impact improvement).\n\n' +
  'Return ONLY valid JSON with this shape:\n' +
  '{ "scores": { "brandFidelity": N, "modernity": N, "conversionStrength": N }, ' +
  '"kept": [..], "missed": [..], "suggest": "..." }'
);

async function callAnthropicVision({ leadPng, ourPng, apiKey, model, timeoutMs }) {
  const [leadB, ourB] = await Promise.all([fs.readFile(leadPng), fs.readFile(ourPng)]);
  const body = {
    model: model || DEFAULT_MODEL,
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: PROMPT },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: leadB.toString('base64') } },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: ourB.toString('base64')  } }
      ]
    }]
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 45000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Anthropic HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = (data.content || []).map(b => b.text || '').join('').trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no JSON in vision response');
    return JSON.parse(m[0]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Score a preview. Returns null on missing key, throws on real failures so
 * the caller can decide whether to retry or skip.
 */
async function scorePreview({ leadPng, ourPng, apiKey, model }) {
  apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { skipped: 'no ANTHROPIC_API_KEY' };
  const result = await callAnthropicVision({ leadPng, ourPng, apiKey, model });
  const scores = result.scores || {};
  const arr = [scores.brandFidelity, scores.modernity, scores.conversionStrength]
    .filter(n => typeof n === 'number');
  const average = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return {
    scores,
    average,
    kept: Array.isArray(result.kept) ? result.kept : [],
    missed: Array.isArray(result.missed) ? result.missed : [],
    suggest: typeof result.suggest === 'string' ? result.suggest : '',
    model: model || DEFAULT_MODEL
  };
}

module.exports = { scorePreview, DEFAULT_MODEL };
