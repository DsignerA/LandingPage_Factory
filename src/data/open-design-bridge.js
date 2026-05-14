'use strict';

/**
 * open-design-bridge.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Headless adapter from our scraper output to open-design's chat protocol.
 *
 * Flow:
 *   1. Ensure the daemon is running (spawn via `pnpm tools-dev start daemon`
 *      if /api/health fails).
 *   2. Compose a chat message from the scraped brief (brand DNA, palette,
 *      copy voice, address, hours, real photos, niche, primary goal).
 *   3. POST /api/chat with { agentId, message, skillId, designSystemId }.
 *      The daemon assembles the system prompt (base + skill + design system)
 *      and spawns the agent CLI on PATH.
 *   4. Read the SSE stream, concatenate text chunks, extract the
 *      <artifact>HTML</artifact> block as the generated page.
 *   5. Return { html, raw, agentId, skillId, designSystemId, usage }.
 *
 * No human in the loop. Falls back to the deterministic `upgrade` provider
 * when the daemon can't be reached or the agent yields no artifact.
 */

const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');

const DAEMON_URL = process.env.OD_DAEMON_URL || 'http://127.0.0.1:17456';
const OPEN_DESIGN_DIR = path.resolve(__dirname, '..', '..', 'open-design');
const DEFAULT_AGENT = process.env.LANDING_BUILDER_OD_AGENT || 'claude';
const DEFAULT_SKILL = process.env.LANDING_BUILDER_OD_SKILL || 'landing-page-factory';

// Pick a niche-specific skill when one exists; fall back to the generic.
// Auto-resolves at request time by asking the daemon for the live skill list.
const NICHE_SKILL_MAP = {
  restaurant: 'landing-page-factory-restaurant',
  cafe:       'landing-page-factory-restaurant',
  coffee:     'landing-page-factory-restaurant',
  bistro:     'landing-page-factory-restaurant',
  pizzeria:   'landing-page-factory-restaurant',
  steakhouse: 'landing-page-factory-restaurant',
  bakery:     'landing-page-factory-restaurant',
  bar:        'landing-page-factory-restaurant',
  tavern:     'landing-page-factory-restaurant',
  pub:        'landing-page-factory-restaurant',
  dentist:    'landing-page-factory-dentist',
  dental:     'landing-page-factory-dentist',
  orthodont:  'landing-page-factory-dentist',
  medical:    'landing-page-factory-dentist',
  clinic:     'landing-page-factory-dentist',
  chiro:      'landing-page-factory-dentist',
  hvac:       'landing-page-factory-hvac',
  plumb:      'landing-page-factory-hvac',
  roof:       'landing-page-factory-hvac',
  electric:   'landing-page-factory-hvac',
  pest:       'landing-page-factory-hvac',
  landscap:   'landing-page-factory-hvac',
  clean:      'landing-page-factory-hvac',
  contractor: 'landing-page-factory-hvac',
  law:        'landing-page-factory-lawyer',
  attorney:   'landing-page-factory-lawyer',
  legal:      'landing-page-factory-lawyer',
  account:    'landing-page-factory-lawyer',
  consult:    'landing-page-factory-lawyer',
  cpa:        'landing-page-factory-lawyer',
  agency:     'landing-page-factory-lawyer'
};

function pickNicheSkill(niche, availableIds) {
  const n = String(niche || '').toLowerCase();
  for (const [pattern, skillId] of Object.entries(NICHE_SKILL_MAP)) {
    if (n.includes(pattern) && availableIds.has(skillId)) return skillId;
  }
  return null;
}
const DEFAULT_TIMEOUT_MS = parseInt(process.env.LANDING_BUILDER_OD_TIMEOUT_MS, 10) || 240000;

// ─── Daemon lifecycle ──────────────────────────────────────────────────────────

async function daemonHealth() {
  try {
    const res = await fetch(`${DAEMON_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function listAvailableAgents() {
  try {
    const res = await fetch(`${DAEMON_URL}/api/agents`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.agents || []).filter(a => a.available);
  } catch { return []; }
}

async function listAvailableSkills() {
  try {
    const res = await fetch(`${DAEMON_URL}/api/skills`);
    if (!res.ok) return new Set();
    const data = await res.json();
    return new Set((data.skills || []).map(s => s && s.id).filter(Boolean));
  } catch { return new Set(); }
}

async function ensureDaemonRunning({ verbose = false } = {}) {
  let health = await daemonHealth();
  if (health) {
    if (verbose) console.log('[od-bridge] daemon already running at', DAEMON_URL);
    return { spawned: false };
  }

  if (verbose) console.log('[od-bridge] spawning daemon via tools-dev start daemon...');
  await new Promise((resolve, reject) => {
    const port = (DAEMON_URL.match(/:(\d+)/) || [])[1] || '17456';
    const child = spawn('pnpm', ['tools-dev', 'start', 'daemon', '--daemon-port', port], {
      cwd: OPEN_DESIGN_DIR,
      stdio: verbose ? 'inherit' : 'ignore'
    });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`tools-dev start exited ${code}`)));
    child.on('error', reject);
  });

  // Poll until ready (daemon takes a few seconds for tsx + Express startup).
  for (let i = 0; i < 30; i++) {
    health = await daemonHealth();
    if (health) {
      if (verbose) console.log('[od-bridge] daemon ready');
      return { spawned: true };
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('[od-bridge] daemon failed to come up within 15s');
}

// ─── Prompt composition ────────────────────────────────────────────────────────

function composeMessage(brief) {
  const brand    = brief.brand || {};
  const contact  = brief.contact || {};
  const trust    = brief.trust || {};
  const niche    = brief.niche || 'business';
  const location = brief.location || '';
  const goal     = brief.primary_goal || 'get_in_touch';

  const colors   = (brief.siteIdentity && brief.siteIdentity.brandColors) || {};
  const fonts    = (brief.siteIdentity && brief.siteIdentity.brandFonts)  || {};
  const aboutStory = (brief.siteIdentity && brief.siteIdentity.aboutStory) || '';
  const heroImg  = brand.heroImageUrl || '';
  const logoUrl  = brand.logoUrl || '';
  const lib      = (brief.siteIdentity && Array.isArray(brief.siteIdentity.imageLibrary))
    ? brief.siteIdentity.imageLibrary : [];
  const cardImages = lib
    .filter(o => o && o.src && o.src !== heroImg && /food|generic|interior|exterior/.test(o.category || ''))
    .slice(0, 6)
    .map(o => `- ${o.category}: ${o.src}${o.alt ? ` (alt: ${o.alt})` : ''}`);

  const reviewsBlock = Array.isArray(brief.placesReviews) && brief.placesReviews.length
    ? '\n\nReal customer reviews (use 3 verbatim, attributed):\n' +
      brief.placesReviews.slice(0, 5).map(r =>
        `- ${r.author} (${r.rating}★): "${r.text}"`).join('\n')
    : '';

  const hoursBlock = Array.isArray(brief.hoursWeekday) && brief.hoursWeekday.length
    ? '\n\nReal opening hours:\n' + brief.hoursWeekday.map(h => `- ${h}`).join('\n')
    : '';

  return [
    `Build a modern, single-page landing site for **${brand.name || 'this business'}** — a ${niche} ${location ? `in ${location}` : ''}.`,
    '',
    aboutStory && `## Brand story (use this voice; do not invent facts)\n${aboutStory}`,
    '',
    `## Conversion goal\n${goal} — make this the dominant CTA.`,
    '',
    `## Brand visuals (extracted from the live site)`,
    colors.primary   && `- Primary color: ${colors.primary}`,
    colors.secondary && `- Secondary color: ${colors.secondary}`,
    fonts.heading    && `- Heading font hint: ${fonts.heading}`,
    fonts.body       && `- Body font hint: ${fonts.body}`,
    logoUrl          && `- Logo URL: ${logoUrl} (use in nav header)`,
    heroImg          && `- Hero photo URL: ${heroImg} (use as primary hero background)`,
    cardImages.length && `- Additional photos (use for menu/gallery cards):\n${cardImages.join('\n')}`,
    '',
    contact.address && (contact.address.street || contact.address.city) &&
      `## Real address\n${[contact.address.street, contact.address.city, contact.address.state].filter(Boolean).join(', ')}`,
    contact.phone   && `## Real phone\n${contact.phone}`,
    trust.rating    && trust.review_count &&
      `## Real rating\n${trust.rating}★ from ${trust.review_count} reviews`,
    hoursBlock,
    reviewsBlock,
    '',
    `## Output contract`,
    `Wrap the final page in <artifact>…</artifact>. It must be a single self-contained HTML document using Tailwind via CDN (https://cdn.tailwindcss.com), inline <style> for any custom CSS, and inline event handlers only where strictly necessary. No external JS framework. No npm imports. The page must render correctly when opened as a static file. Use the real photo URLs above directly in <img src=…> tags — do not invent placeholder URLs.`
  ].filter(Boolean).join('\n');
}

// ─── SSE reader ────────────────────────────────────────────────────────────────

async function readSseStream(res, { onEvent, signal } = {}) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (signal && signal.aborted) throw new Error('aborted');
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE: events are blank-line-separated; each line is `field: value`.
    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const ev = parseSseChunk(chunk);
      if (ev && onEvent) onEvent(ev);
    }
  }
}

function parseSseChunk(chunk) {
  const lines = chunk.split('\n');
  let event = 'message';
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  const raw = dataLines.join('\n');
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  return { event, data };
}

// ─── Artifact extraction ───────────────────────────────────────────────────────

function extractArtifact(text) {
  // The agent emits <artifact>HTML</artifact>. Some agents prefix the tag with
  // attributes (e.g. <artifact identifier="landing">), so we tolerate that.
  const m = text.match(/<artifact[^>]*>([\s\S]*?)<\/artifact>/i);
  if (m) return m[1].trim();
  // Some skills omit the wrapper and just emit raw HTML — accept that too if it
  // looks like a full document.
  if (/<!doctype html|<html\b/i.test(text)) {
    const start = text.search(/<!doctype html|<html\b/i);
    return text.slice(start).trim();
  }
  return null;
}

// ─── Pull text out of streaming events ────────────────────────────────────────

function harvestTextFromEvent(ev) {
  // Different agents emit different event shapes through the daemon. We try
  // a small set of known fields and concatenate whatever string we find.
  // Anchored by `claude-stream.ts` and the codex/event-parser-based agents.
  if (!ev || ev.event !== 'agent') return '';
  const d = ev.data;
  if (!d || typeof d !== 'object') return '';
  if (typeof d.text === 'string') return d.text;
  if (typeof d.delta === 'string') return d.delta;
  if (d.type === 'text' && typeof d.value === 'string') return d.value;
  if (d.type === 'output_text_delta' && typeof d.delta === 'string') return d.delta;
  if (d.type === 'content_block_delta' && d.delta && typeof d.delta.text === 'string') return d.delta.text;
  if (Array.isArray(d.content)) {
    return d.content.map(c => (c && typeof c.text === 'string') ? c.text : '').join('');
  }
  return '';
}

// ─── Main entry ────────────────────────────────────────────────────────────────

/**
 * Generate a landing-page HTML artifact for the given brief by driving
 * open-design's daemon. Returns null on any failure so the caller can fall
 * back to the deterministic provider.
 *
 * @param {object} brief - normalized brief from buildSiteBrief.
 * @param {object} options
 * @param {string} [options.agentId]        Default 'claude'.
 * @param {string} [options.skillId]        Default 'web-prototype'.
 * @param {string} [options.designSystemId] Default brief.designSystem.name.
 * @param {number} [options.timeoutMs]      Default 240000.
 * @param {boolean} [options.verbose]
 */
async function generateArtifact(brief, options = {}) {
  const verbose = !!options.verbose;
  try {
    await ensureDaemonRunning({ verbose });
  } catch (err) {
    if (verbose) console.warn('[od-bridge]', err.message);
    return null;
  }

  // Verify the chosen agent is installed.
  const agents = await listAvailableAgents();
  const wantedAgent = options.agentId || DEFAULT_AGENT;
  const chosenAgent = agents.find(a => a.id === wantedAgent) || agents[0];
  if (!chosenAgent) {
    if (verbose) console.warn('[od-bridge] no agent CLI available on PATH; skipping');
    return null;
  }

  // Skill selection: explicit option > env override > niche-specific > generic
  let skillId = options.skillId || process.env.LANDING_BUILDER_OD_SKILL;
  if (!skillId) {
    const availableSkills = await listAvailableSkills();
    skillId = pickNicheSkill(brief.niche, availableSkills) || DEFAULT_SKILL;
  }
  const designSystemId = options.designSystemId ||
                         (brief.designSystem && brief.designSystem.name) ||
                         null;

  const message = composeMessage(brief);
  const body = {
    agentId: chosenAgent.id,
    message,
    skillId,
    ...(designSystemId ? { designSystemId } : {}),
  };

  if (verbose) {
    console.log('[od-bridge] POST /api/chat', { agent: chosenAgent.id, skill: skillId, designSystem: designSystemId || '(none)' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${DAEMON_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'text/event-stream', 'x-od-client': 'factory' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (verbose) console.warn('[od-bridge] POST failed:', err.message);
    return null;
  }

  if (!res.ok || !res.body) {
    clearTimeout(timer);
    const errText = await res.text().catch(() => '');
    if (verbose) console.warn('[od-bridge] daemon returned', res.status, errText.slice(0, 200));
    return null;
  }

  let fullText = '';
  let usage = null;
  let endStatus = null;
  let lastError = null;

  try {
    await readSseStream(res, {
      signal: controller.signal,
      onEvent: (ev) => {
        if (ev.event === 'agent') {
          const text = harvestTextFromEvent(ev);
          if (text) fullText += text;
          if (ev.data && ev.data.type === 'usage') usage = ev.data.usage;
        } else if (ev.event === 'end') {
          endStatus = ev.data;
        } else if (ev.event === 'error') {
          lastError = ev.data;
        }
      }
    });
  } catch (err) {
    if (verbose) console.warn('[od-bridge] stream read aborted:', err.message);
  } finally {
    clearTimeout(timer);
  }

  if (lastError) {
    if (verbose) console.warn('[od-bridge] agent error:', lastError);
    return null;
  }

  const html = extractArtifact(fullText);
  if (!html) {
    if (verbose) console.warn('[od-bridge] no <artifact> block found in agent output (length', fullText.length, ')');
    return null;
  }

  return {
    html,
    raw: fullText,
    agentId: chosenAgent.id,
    skillId,
    designSystemId,
    usage,
    endStatus,
  };
}

module.exports = {
  generateArtifact,
  ensureDaemonRunning,
  listAvailableAgents,
  composeMessage,
  extractArtifact,
  DAEMON_URL,
};
