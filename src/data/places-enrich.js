'use strict';

/**
 * places-enrich.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Reusable Google Places lookup for the preview pipeline.
 *
 * Given a lead (business_name, city, state, optional place_id), returns:
 *   {
 *     rating, review_count,
 *     reviews: [{ author, rating, text, time, relativeTime }],
 *     phone, address, hoursWeekday,
 *     google_maps_url, place_id, openingHoursOpenNow
 *   }
 *
 * Returns null on any failure (missing API key, no match, network error) so the
 * preview pipeline can keep running with deterministic placeholders.
 *
 * Required env: GOOGLE_MAPS_API_KEY (Places API enabled).
 */

const PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const PLACES_DETAILS_URL     = 'https://maps.googleapis.com/maps/api/place/details/json';

const DETAIL_FIELDS = [
  'place_id',
  'name',
  'formatted_address',
  'formatted_phone_number',
  'international_phone_number',
  'rating',
  'user_ratings_total',
  'reviews',
  'opening_hours',
  'url',
  'website'
].join(',');

function toStringSafe(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

async function textSearch(query, apiKey) {
  const params = new URLSearchParams({ query, key: apiKey });
  const res = await fetch(`${PLACES_TEXT_SEARCH_URL}?${params}`);
  if (!res.ok) throw new Error(`Places Text Search HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places Text Search status ${data.status}: ${data.error_message || ''}`);
  }
  return data.results || [];
}

async function placeDetails(placeId, apiKey) {
  const params = new URLSearchParams({ place_id: placeId, fields: DETAIL_FIELDS, key: apiKey });
  const res = await fetch(`${PLACES_DETAILS_URL}?${params}`);
  if (!res.ok) throw new Error(`Place Details HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'OK') {
    throw new Error(`Place Details status ${data.status}: ${data.error_message || ''}`);
  }
  return data.result || null;
}

/**
 * Enrich a lead with Google Places data.
 * @param {object} lead - { business_name, city, state, place_id? }
 * @param {object} options - { apiKey?, timeoutMs? }
 * @returns {Promise<object|null>}
 */
async function enrichWithPlaces(lead, options = {}) {
  const apiKey = options.apiKey || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    let placeId = toStringSafe(lead && lead.place_id);
    if (!placeId) {
      const name  = toStringSafe(lead && lead.business_name);
      const city  = toStringSafe(lead && lead.city);
      const state = toStringSafe(lead && lead.state);
      if (!name) return null;
      const query = [name, city, state].filter(Boolean).join(' ');
      const results = await textSearch(query, apiKey);
      if (!results.length) return null;
      placeId = results[0].place_id;
      if (!placeId) return null;
    }

    const detail = await placeDetails(placeId, apiKey);
    if (!detail) return null;

    const reviews = Array.isArray(detail.reviews)
      ? detail.reviews
          .filter(r => r && (r.text || '').trim().length >= 30)
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 5)
          .map(r => ({
            author:        toStringSafe(r.author_name).trim(),
            rating:        typeof r.rating === 'number' ? r.rating : 5,
            text:          toStringSafe(r.text).trim().slice(0, 360),
            time:          r.time || null,
            relativeTime:  toStringSafe(r.relative_time_description)
          }))
      : [];

    const hoursWeekday = (detail.opening_hours && Array.isArray(detail.opening_hours.weekday_text))
      ? detail.opening_hours.weekday_text
      : [];

    return {
      place_id:       toStringSafe(detail.place_id) || placeId,
      name:           toStringSafe(detail.name),
      address:        toStringSafe(detail.formatted_address),
      phone:          toStringSafe(detail.formatted_phone_number || detail.international_phone_number),
      rating:         typeof detail.rating === 'number' ? detail.rating : null,
      review_count:   typeof detail.user_ratings_total === 'number' ? detail.user_ratings_total : null,
      reviews,
      hoursWeekday,
      openingHoursOpenNow: detail.opening_hours && typeof detail.opening_hours.open_now === 'boolean' ? detail.opening_hours.open_now : null,
      google_maps_url: toStringSafe(detail.url),
      website:        toStringSafe(detail.website)
    };
  } catch (err) {
    console.warn('[places-enrich] failed:', err && err.message);
    return null;
  }
}

module.exports = { enrichWithPlaces };
