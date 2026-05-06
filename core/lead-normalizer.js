// lead-normalizer.js
// Deterministic lead normalization module (no external deps, no AI calls)

const STATE_MAP = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC'
};

function toStringSafe(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

function collapseSpaces(s) {
  return toStringSafe(s).replace(/\s+/g, ' ').trim();
}

function titleCase(s) {
  const str = collapseSpaces(s).toLowerCase();
  if (!str) return '';
  return str
    .split(/([\s\-\/]+)/)
    .map(part => {
      if (/[\s\-\/]+/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

function titleCaseLocation(s) {
  return titleCase(s);
}

function smartBusinessCase(s) {
  const str = collapseSpaces(s);
  if (!str) return '';

  const keepUpper = new Set([
    'AI', 'API', 'SEO', 'SEM', 'PPC', 'CRM', 'LLC', 'INC', 'LTD', 'PC', 'DDS', 'DMD',
    'MD', 'PA', 'DC', 'USA', 'US', 'ATM', 'HVAC'
  ]);

  return str
    .split(/(\s+|-|\/)/)
    .map(token => {
      if (/^(\s+|-|\/)$/.test(token)) return token;
      if (!token) return token;

      const upper = token.toUpperCase();
      if (keepUpper.has(upper)) return upper;
      if (/^[A-Z0-9&.]+$/.test(token) && token.length <= 5) return token;

      const lower = token.toLowerCase();

      if (lower.startsWith('mc') && lower.length > 2) {
        return 'Mc' + lower.charAt(2).toUpperCase() + lower.slice(3);
      }

      if (lower.startsWith("o'") && lower.length > 2) {
        return "O'" + lower.charAt(2).toUpperCase() + lower.slice(3);
      }

      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function normalizeState(input) {
  const s = collapseSpaces(input);
  if (!s) return '';

  const up = s.toUpperCase();
  if (/^[A-Z]{2}$/.test(up)) return up;

  const key = s.toLowerCase();
  if (STATE_MAP[key]) return STATE_MAP[key];

  const cleaned = key
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\b(state|of|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (STATE_MAP[cleaned]) return STATE_MAP[cleaned];

  return '';
}

function stripDiacritics(s) {
  return toStringSafe(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function slugify(s) {
  const ascii = stripDiacritics(s).toLowerCase();
  return ascii
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function safeUrlNormalize(urlStr) {
  const raw = toStringSafe(urlStr).trim();
  if (!raw) return null;

  let candidate = raw;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = 'https://' + candidate;
  }

  try {
    const u = new URL(candidate);
    const host = u.hostname.toLowerCase();
    const scheme = (u.protocol || 'https:').toLowerCase();
    const isDefaultPort =
      (scheme === 'https:' && u.port === '443') ||
      (scheme === 'http:' && u.port === '80');
    const portPart = isDefaultPort || !u.port ? '' : `:${u.port}`;
    return `${scheme}//${host}${portPart}`;
  } catch {
    return null;
  }
}

function extractHostname(urlStr) {
  const n = safeUrlNormalize(urlStr);
  if (!n) return '';
  try {
    const u = new URL(n);
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function fnv1a32(str) {
  const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const bytes = encoder
    ? encoder.encode(String(str))
    : Array.from(String(str)).map(ch => ch.charCodeAt(0) & 0xff);

  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function hostnameToBusinessName(fallbackHost) {
  if (!fallbackHost) return 'Unknown Business';

  const hostWithoutWww = fallbackHost.replace(/^www\./i, '');
  const parts = hostWithoutWww.split('.');
  const base = parts[0] || hostWithoutWww;
  const cleaned = base.replace(/[^a-z0-9]+/gi, ' ').trim();

  return smartBusinessCase(cleaned || 'Unknown Business');
}

function ensureBusinessName(rawName, fallbackHost) {
  const name = collapseSpaces(rawName);
  if (name) return smartBusinessCase(name);
  return hostnameToBusinessName(fallbackHost);
}

function buildLocation(city, state) {
  const c = collapseSpaces(city);
  const st = normalizeState(state);

  if (c && st) return `${titleCaseLocation(c)}, ${st}`;
  if (c) return titleCaseLocation(c);
  if (st) return st;
  return '';
}

function splitToItems(s) {
  return toStringSafe(s)
    .replace(/\r/g, '')
    .split(/\n\s*-\s+|\n\s*\*\s+|\n|;|•/g)
    .map(x => x.trim())
    .filter(Boolean);
}

function parseNotes(notes) {
  const text = toStringSafe(notes).trim();
  const result = { weaknesses: [], opportunities: [] };
  if (!text) return result;

  const lower = text.toLowerCase();
  const wIdx = lower.indexOf('weaknesses:');
  const oIdx = lower.indexOf('opportunities:');

  const sections = {
    weaknesses: '',
    opportunities: ''
  };

  if (wIdx !== -1 || oIdx !== -1) {
    const wStart = wIdx !== -1 ? wIdx + 'weaknesses:'.length : -1;
    const oStart = oIdx !== -1 ? oIdx + 'opportunities:'.length : -1;

    if (wStart !== -1 && oStart !== -1) {
      if (wStart < oStart) {
        sections.weaknesses = text.slice(wStart, oIdx);
        sections.opportunities = text.slice(oStart);
      } else {
        sections.opportunities = text.slice(oStart, wIdx);
        sections.weaknesses = text.slice(wStart);
      }
    } else if (wStart !== -1) {
      sections.weaknesses = text.slice(wStart);
    } else if (oStart !== -1) {
      sections.opportunities = text.slice(oStart);
    }
  } else {
    const lines = text.split(/\r?\n/).map(l => l.trim());
    let mode = '';
    const w = [];
    const o = [];

    for (const line of lines) {
      const l = line.toLowerCase();
      if (/^weakness(es)?\b/.test(l)) {
        mode = 'w';
        continue;
      }
      if (/^opportunit(y|ies)\b/.test(l)) {
        mode = 'o';
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        if (mode === 'w') w.push(line.replace(/^[-*]\s+/, '').trim());
        else if (mode === 'o') o.push(line.replace(/^[-*]\s+/, '').trim());
      }
    }

    if (w.length || o.length) {
      result.weaknesses = w.filter(Boolean);
      result.opportunities = o.filter(Boolean);
      return result;
    }

    return result;
  }

  if (sections.weaknesses) result.weaknesses = splitToItems(sections.weaknesses);
  if (sections.opportunities) result.opportunities = splitToItems(sections.opportunities);

  return result;
}

function canonicalKey({ businessName, city, state, hostname, niche }) {
  const parts = [
    collapseSpaces(businessName).toLowerCase(),
    collapseSpaces(city).toLowerCase(),
    normalizeState(state).toLowerCase(),
    toStringSafe(hostname).toLowerCase(),
    collapseSpaces(niche).toLowerCase()
  ];
  return parts.join('|');
}

function buildLeadId(key) {
  return `lead_${fnv1a32(key)}`;
}

function buildSlug(businessName, city, state, canonical) {
  const baseParts = [businessName, city, state].filter(Boolean).join(' ');
  const base = slugify(baseParts).slice(0, 60);
  const h = fnv1a32(canonical).slice(0, 6);
  return base ? `${base}-${h}` : h;
}

function normalizeNiche(niche) {
  const n = collapseSpaces(niche);
  if (!n) return 'general';
  return n.toLowerCase();
}

function toIsoTimestamp(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function normalizeLead(rawLead, options = {}) {
  // Normalize core lead fields and preserve all other properties from rawLead.
  const o = Object(rawLead || {});
  const host = extractHostname(o.website_url || o.website || '');
  const website_url = safeUrlNormalize(o.website_url || o.website || '');

  // Normalize business/practice names
  const business_name = ensureBusinessName(o.business_name, host);
  // Some leads may include a more specific practice_name; preserve it
  const practice_name = collapseSpaces(o.practice_name || '') || null;

  // Normalize location fields separately
  const cityRaw = collapseSpaces(o.city);
  const stateRaw = collapseSpaces(o.state);
  const normalizedState = normalizeState(stateRaw);
  const niche = normalizeNiche(o.niche);
  const offer_angle = collapseSpaces(o.offer_angle);

  // Build location string for backward compatibility
  const location = buildLocation(cityRaw, normalizedState);

  // Build canonical identifiers
  const canonical = canonicalKey({
    businessName: business_name,
    city: cityRaw,
    state: normalizedState,
    hostname: host,
    niche
  });

  const lead_id = buildLeadId(canonical);
  const slug = buildSlug(business_name, cityRaw, normalizedState, canonical);

  // Parse notes into weaknesses/opportunities
  const parsed = parseNotes(o.notes);

  // Determine creation timestamp
  const createdAtFromInput = toIsoTimestamp(o.created_at);
  const createdAtFromOption = toIsoTimestamp(options.fixedTimestamp);
  const created_at = createdAtFromInput || createdAtFromOption || null;

  // Base canonical payload. Assign default nulls for absent fields.
  const canonicalLead = {
    lead_id,
    slug,
    business_name,
    practice_name,
    niche,
    address: collapseSpaces(o.address || ''),
    city: cityRaw,
    state: normalizedState,
    phone: collapseSpaces(o.phone || ''),
    // Preserve numeric rating fields strictly; accept alternative field names
    rating: (o.rating != null ? Number(o.rating) : (o.rating_score != null ? Number(o.rating_score) : null)),
    review_count: (o.review_count != null ? Number(o.review_count) : (o.reviews != null ? Number(o.reviews) : null)),
    website_url: website_url || null,
    google_maps_url: toStringSafe(o.google_maps_url) || null,
    place_id: o.place_id || null,
    website_status: o.website_status || null,
    ownership_signal: o.ownership_signal || null,
    lead_angle: o.lead_angle || null,
    score: o.score != null ? o.score : null,
    tier: o.tier != null ? o.tier : null,
    hours_summary: o.hours_summary || null,
    business_status: o.business_status || null,
    audit_results: o.audit_results || null,
    website_quality: o.website_quality || null,
    // Always preserve array fields if provided; convert non-arrays to an array
    website_weaknesses: Array.isArray(o.website_weaknesses)
      ? o.website_weaknesses
      : (o.website_weaknesses != null ? [ String(o.website_weaknesses) ] : null),
    // Preserve booleans exactly — don't convert false to null
    appointment_booking_present: (o.appointment_booking_present !== undefined ? o.appointment_booking_present : null),
    chat_present: (o.chat_present !== undefined ? o.chat_present : null),
    clear_primary_cta_present: (o.clear_primary_cta_present !== undefined ? o.clear_primary_cta_present : null),
    google_ads_detected: (o.google_ads_detected !== undefined ? o.google_ads_detected : null),
    // Preserve ad evidence array if provided; wrap strings into array
    ad_evidence: Array.isArray(o.ad_evidence)
      ? o.ad_evidence
      : (o.ad_evidence != null ? [ String(o.ad_evidence) ] : null),
    location,
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
    offer_angle,
    created_at
  };

  // Preserve any additional fields from the raw lead that are not already set.
  // This ensures downstream stages have access to all discovered/enriched data.
  for (const key of Object.keys(o)) {
    if (!(key in canonicalLead)) {
      canonicalLead[key] = o[key];
    }
  }
  return canonicalLead;
}

module.exports = {
  normalizeLead,
  _internal: {
    collapseSpaces,
    titleCase,
    smartBusinessCase,
    normalizeState,
    slugify,
    safeUrlNormalize,
    extractHostname,
    parseNotes,
    canonicalKey,
    buildLeadId,
    buildSlug,
    toIsoTimestamp
  }
};