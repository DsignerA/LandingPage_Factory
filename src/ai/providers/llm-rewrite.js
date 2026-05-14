'use strict';

/**
 * llm-rewrite.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Optional LLM pass that rewrites hero/subtitle/value-prop copy in the brand's
 * voice. Sits ON TOP of the deterministic upgrade provider — the schema is
 * already built; this pass mutates copy fields in place.
 *
 * Activates when ANTHROPIC_API_KEY is set. Silently skips otherwise so the
 * pipeline stays deterministic and zero-cost by default.
 *
 * Usage in generate-preview.js:
 *   const schema = generatePageSchema(brief, { provider: 'upgrade' });
 *   await rewriteCopyInVoice(schema, brief);   // mutates in place, non-fatal
 */

const VOICE_MODEL = process.env.LANDING_BUILDER_LLM_MODEL || 'claude-sonnet-4-6';
const VOICE_MAX_TOKENS = 1500;
const VOICE_TIMEOUT_MS = 25000;

function findSection(schema, type) {
  if (!Array.isArray(schema)) return null;
  return schema.find(s => s && s.type === type) || null;
}

function distinctBrandVoiceSample(brief) {
  // Stitch together everything we know about the brand's voice from scraping.
  const si = (brief && brief.siteIdentity) || {};
  const parts = [];
  if (si.heroHeadline) parts.push(si.heroHeadline);
  if (si.heroTagline)  parts.push(si.heroTagline);
  if (si.aboutStory)   parts.push(si.aboutStory);
  return parts.join(' • ').slice(0, 1800);
}

async function callAnthropic(prompt, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: VOICE_MODEL,
        max_tokens: VOICE_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Anthropic HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = (data.content || []).map(b => b.text || '').join('').trim();
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Rewrite hero title/subtitle/value-props in the brand's voice using whatever
 * scraped voice signal we have. Mutates the schema in place. Non-fatal — any
 * error reverts to the deterministic original.
 */
async function rewriteCopyInVoice(schema, brief) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { skipped: 'no ANTHROPIC_API_KEY' };
  }
  const hero = findSection(schema, 'hero');
  if (!hero || !hero.props) return { skipped: 'no hero section' };

  const voiceSample = distinctBrandVoiceSample(brief);
  if (!voiceSample || voiceSample.length < 60) {
    return { skipped: 'no scraped voice sample' };
  }

  const brandName = (brief.brand && brief.brand.name) || '';
  const niche = brief.niche || '';
  const goal  = brief.primary_goal || '';
  const original = {
    title: hero.props.title || '',
    subtitle: hero.props.subtitle || ''
  };

  // When the brief carries an active design system preset, include its body in
  // the prompt so the rewrite matches the aesthetic (e.g. 'editorial-burgundy'
  // yields literary phrasing; 'sleek' yields punchy tech phrasing).
  const ds = brief.designSystem;
  const designSystemBlock = ds && ds.body
    ? `\nDESIGN AESTHETIC (${ds.title}). Match the tone, vocabulary, and rhythm implied by this system. Do NOT contradict the voice sample.\n${ds.body.slice(0, 1800)}\n`
    : '';

  const prompt = `You are rewriting hero copy for a landing page in the *exact voice* of the client.

CLIENT VOICE SAMPLE (scraped from their site — match this tone, vocabulary, and rhythm):
"${voiceSample}"
${designSystemBlock}
BRAND: ${brandName}
NICHE: ${niche}
PRIMARY GOAL: ${goal}

Rewrite the hero copy below. Keep it punchy (title ≤ 70 chars, subtitle ≤ 180 chars). Do NOT invent facts not present in the voice sample. Preserve any specific landmarks, history, or accolades the sample mentions.

ORIGINAL TITLE: ${original.title}
ORIGINAL SUBTITLE: ${original.subtitle}

Return ONLY valid JSON, no commentary:
{ "title": "...", "subtitle": "..." }`;

  try {
    const out = await callAnthropic(prompt, apiKey);
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return { skipped: 'no JSON in response' };
    const parsed = JSON.parse(m[0]);
    if (parsed.title    && typeof parsed.title    === 'string') hero.props.title    = parsed.title.trim();
    if (parsed.subtitle && typeof parsed.subtitle === 'string') hero.props.subtitle = parsed.subtitle.trim();
    return { rewrote: true, model: VOICE_MODEL };
  } catch (err) {
    return { error: err && err.message };
  }
}

module.exports = { rewriteCopyInVoice };
