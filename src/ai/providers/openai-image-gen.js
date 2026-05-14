'use strict';

/**
 * openai-image-gen.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Optional image generator backed by OpenAI's gpt-image-2 (released
 * 2026-04-21, snapshot `gpt-image-2-2026-04-21`). Used as a fallback when
 * the scraper finds no usable hero / card photos for a lead.
 *
 * Gated entirely on OPENAI_API_KEY. Without the key, every export silently
 * returns null and the pipeline falls back to niche-pack stock photos.
 *
 * Usage:
 *   const { generateImage } = require('./openai-image-gen');
 *   const buf = await generateImage({
 *     prompt: 'A warm, candlelit Richmond steakhouse interior...',
 *     size: '1536x1024',
 *     quality: 'high'
 *   });
 *   if (buf) await fs.writeFile(outPath, buf);
 *
 * Returns a Buffer (PNG bytes) on success, null on any failure.
 */

// OpenAI's current state-of-the-art image model (April 2026). Override via env
// when newer snapshots ship (e.g. LANDING_BUILDER_IMAGE_MODEL=gpt-image-2-2026-08-12).
const DEFAULT_MODEL = process.env.LANDING_BUILDER_IMAGE_MODEL || 'gpt-image-2';
const DEFAULT_TIMEOUT_MS = 60000;

const VALID_SIZES = new Set([
  '1024x1024', '1024x1536', '1536x1024', 'auto'
]);
const VALID_QUALITIES = new Set(['low', 'medium', 'high', 'auto']);

async function callOpenAIImages({ prompt, model, size, quality, n, apiKey, signal }) {
  const body = {
    model: model || DEFAULT_MODEL,
    prompt: String(prompt),
    size: VALID_SIZES.has(size) ? size : '1536x1024',
    quality: VALID_QUALITIES.has(quality) ? quality : 'high',
    n: typeof n === 'number' ? n : 1
  };
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI Images HTTP ${res.status}: ${errText.slice(0, 240)}`);
  }
  const data = await res.json();
  if (!data || !Array.isArray(data.data)) {
    throw new Error('OpenAI Images: unexpected response shape');
  }
  return data.data;
}

/**
 * Generate one image. Returns a PNG Buffer on success, null on any failure or
 * missing API key.
 *
 * @param {object} opts
 * @param {string} opts.prompt       Required. The image prompt.
 * @param {string} [opts.size]       '1024x1024' | '1024x1536' | '1536x1024' | 'auto'
 * @param {string} [opts.quality]    'low' | 'medium' | 'high' | 'auto'
 * @param {string} [opts.apiKey]     Override env OPENAI_API_KEY
 * @param {number} [opts.timeoutMs]
 */
async function generateImage(opts) {
  const apiKey = opts.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || DEFAULT_TIMEOUT_MS);
  try {
    const items = await callOpenAIImages({
      prompt: opts.prompt,
      model:  opts.model,
      size:   opts.size,
      quality:opts.quality,
      n: 1,
      apiKey,
      signal: controller.signal
    });
    const first = items[0];
    if (!first) return null;
    // gpt-image-2 returns base64 in `b64_json` by default; url is not provided.
    if (first.b64_json) {
      return Buffer.from(first.b64_json, 'base64');
    }
    if (first.url) {
      // Some snapshots return a URL — fetch the bytes.
      const r = await fetch(first.url, { signal: controller.signal });
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    }
    return null;
  } catch (err) {
    console.warn('[openai-image-gen] failed:', err && err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build a brand-aware image prompt from the brief. Used by the pipeline when
 * scraping yielded no usable hero photo. Aims for photorealistic, on-brand,
 * editorial-tone imagery — no overlaid text or logos (those come from the
 * rendered HTML).
 */
function buildHeroPrompt(brief) {
  const brand    = (brief && brief.brand) || {};
  const niche    = (brief && brief.niche) || 'business';
  const location = (brief && brief.location) || '';
  const story    = (brief && brief.siteIdentity && brief.siteIdentity.aboutStory) || '';
  const colors   = (brief && brief.siteIdentity && brief.siteIdentity.brandColors) || {};
  const palette  = [colors.primary, colors.secondary].filter(Boolean).join(', ') || 'warm, naturally-lit tones';

  let subject = 'a beautiful local business interior';
  if (/restaurant|cafe|bistro|eatery|steakhouse|bar|pub|tavern|brasserie|brewery|bakery|diner/i.test(niche)) {
    subject = 'an inviting dining room with hand-crafted plates on a candlelit table';
  } else if (/dentist|dental|medical|clinic|chiro|therapy|spa/i.test(niche)) {
    subject = 'a calm, modern healthcare reception with natural light';
  } else if (/hvac|plumb|roof|electric|contractor|cleaning|landscap/i.test(niche)) {
    subject = 'a professional service technician in clean uniform at a residential home';
  } else if (/law|attorney|legal|consult|coach|agency|accounting/i.test(niche)) {
    subject = 'a modern professional office with warm lighting and considered details';
  }

  return [
    `Photorealistic editorial photograph of ${subject}`,
    location ? `set in ${location}` : null,
    story ? `Brand voice: ${story.slice(0, 180)}` : null,
    `Tasteful palette featuring ${palette}`,
    'Shallow depth of field, natural light, magazine-quality composition',
    'No text, no logos, no watermarks, no people facing camera'
  ].filter(Boolean).join('. ');
}

/**
 * Build an image prompt for a single menu/services card. `topic` is the card
 * title (e.g. "Starters", "Wine List", "Crowns & Bridges").
 */
function buildCardPrompt(brief, topic) {
  const niche = (brief && brief.niche) || 'business';
  const colors = (brief && brief.siteIdentity && brief.siteIdentity.brandColors) || {};
  const palette = [colors.primary, colors.secondary].filter(Boolean).join(', ') || 'warm, naturally-lit tones';
  let subject = `a representative photograph of ${topic}`;
  if (/restaurant|cafe|bistro|eatery|steakhouse|bar/i.test(niche)) {
    subject = `a beautifully plated ${topic.replace(/^(our|the)\s+/i, '')} dish, restaurant editorial style`;
  }
  return [
    `Photorealistic close-up of ${subject}`,
    `Tasteful palette featuring ${palette}`,
    'Shallow depth of field, natural light, food-magazine composition',
    'No text, no logos, no watermarks'
  ].join('. ');
}

module.exports = {
  generateImage,
  buildHeroPrompt,
  buildCardPrompt,
  DEFAULT_MODEL
};
