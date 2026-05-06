'use strict';

// src/data/local-proof.js
// Local Proof Injection — generates realistic local trust/proof signals from lead data and niche config.
//
// Outputs:
//   - hero trust badges (rating, review count, location)
//   - trust strip items
//   - review section header with local context
//   - footer local details
//   - location proof block content

const { resolveNichePack } = require('../niches/index');

/**
 * Generate local proof signals from a brief and niche pack.
 * @param {object} brief - The site brief
 * @param {object} [nichePack] - Optional pre-resolved niche pack
 * @returns {object} Local proof object
 */
function generateLocalProof(brief, nichePack) {
  const b = brief || {};
  const brand = b.brand || {};
  const pack = nichePack || resolveNichePack(b.niche);
  const proof = (pack && pack.proof) || {};

  const city = String(brand.city || '').trim();
  const state = String(brand.state || '').trim();
  const name = String(brand.name || '').trim();
  const niche = String(b.niche || '').trim();

  // Rating — use brief data if available, else niche-appropriate default
  const rating = brand.rating || _defaultRating(pack);
  const reviewCount = brand.review_count || _defaultReviewCount();
  const yearsInBusiness = brand.years_in_business || null;

  // Trust badges — start with niche pack badges, inject real data
  const trustBadges = _buildTrustBadges(proof.trustBadges || [], { rating, reviewCount, city, state, yearsInBusiness });

  // Reviews — use niche pack templates (they are generic enough to feel real)
  const reviews = (proof.reviewTemplates || []).slice(0, 4);

  // Local signals
  const localSignals = _buildLocalSignals({ city, state, name, reviewCount, niche, yearsInBusiness });

  // Trust strip items (shown below hero)
  const trustStrip = _buildTrustStrip(pack, { rating, reviewCount, city, state });

  // Footer local details
  const footerDetails = _buildFooterDetails(pack, brand);

  // Objection handlers from niche pack, with city/state interpolated
  const objectionHandlers = (proof.objectionHandlers || []).map(o => ({
    question: interpolate(o.question, { city, state, name }),
    answer: interpolate(o.answer, { city, state, name })
  }));

  return {
    rating,
    reviewCount,
    trustBadges,
    reviews,
    localSignals,
    trustStrip,
    footerDetails,
    objectionHandlers,
    city,
    state,
    name
  };
}

function _defaultRating(pack) {
  // Dental and legal tend to have higher displayed ratings
  const id = (pack && pack.config && pack.config.id) || 'general';
  if (id === 'dentist' || id === 'lawyer') return '4.9';
  return '4.8';
}

function _defaultReviewCount() {
  // Realistic range for a local business
  return String(Math.floor(Math.random() * 80 + 60)); // 60–140
}

function _buildTrustBadges(packBadges, { rating, reviewCount, city, state, yearsInBusiness }) {
  const badges = [];

  // Always lead with rating
  badges.push({ icon: '⭐', label: `${rating} Rating`, sublabel: `${reviewCount}+ Reviews` });

  // Add pack-specific badges (skip rating badge since we already added it)
  for (const badge of packBadges) {
    if (/rating/i.test(badge.label)) continue;
    badges.push(badge);
  }

  // Add years in business if available
  if (yearsInBusiness) {
    badges.push({ icon: '🏆', label: `${yearsInBusiness}+ Years`, sublabel: 'In Business' });
  }

  // Add local badge if city is available
  if (city) {
    badges.push({ icon: '📍', label: `Serving ${city}`, sublabel: state || '' });
  }

  return badges.slice(0, 4); // Cap at 4 badges
}

function _buildLocalSignals({ city, state, name, reviewCount, niche, yearsInBusiness }) {
  const signals = [];
  if (city) signals.push(`Serving ${city}${state ? ', ' + state : ''}`);
  if (reviewCount) signals.push(`${reviewCount}+ satisfied customers`);
  if (yearsInBusiness) signals.push(`${yearsInBusiness}+ years in business`);
  return signals;
}

function _buildTrustStrip(pack, { rating, reviewCount, city, state }) {
  const config = (pack && pack.config) || {};
  const items = [];

  if (rating) items.push({ icon: '⭐', text: `${rating} Star Rating`, sub: `${reviewCount}+ reviews` });

  // Add niche-specific trust items
  if (config.id === 'dentist') {
    items.push({ icon: '🛡️', text: 'Most Insurance Accepted', sub: 'PPO & more' });
    items.push({ icon: '📅', text: 'Same-Week Appointments', sub: 'New patients welcome' });
  } else if (config.id === 'hvac') {
    items.push({ icon: '🔧', text: 'Licensed & Insured', sub: 'Certified technicians' });
    items.push({ icon: '⚡', text: 'Same-Day Service', sub: 'Fast response' });
  } else if (config.id === 'lawyer') {
    items.push({ icon: '📋', text: 'Free Consultation', sub: 'No obligation' });
    items.push({ icon: '🏆', text: 'No Win, No Fee', sub: 'Contingency available' });
  } else {
    items.push({ icon: '✅', text: 'Verified Business', sub: 'Trusted & reviewed' });
    items.push({ icon: '⚡', text: 'Fast Response', sub: 'Quick turnaround' });
  }

  if (city) items.push({ icon: '📍', text: `Serving ${city}`, sub: state || 'Local & trusted' });

  return items.slice(0, 4);
}

function _buildFooterDetails(pack, brand) {
  const config = (pack && pack.config) || {};
  const details = [];

  if (brand.phone) details.push({ label: 'Phone', value: brand.phone });
  if (brand.city && brand.state) details.push({ label: 'Location', value: `${brand.city}, ${brand.state}` });
  if (brand.hours) details.push({ label: 'Hours', value: brand.hours });

  // Niche-specific footer items
  if (config.id === 'dentist') {
    details.push({ label: 'Insurance', value: 'Most PPO plans accepted' });
  } else if (config.id === 'hvac') {
    details.push({ label: 'Service Area', value: brand.city ? `${brand.city} & surrounding areas` : 'Local area' });
  } else if (config.id === 'lawyer') {
    details.push({ label: 'Consultation', value: 'Free initial consultation' });
  }

  return details;
}

function interpolate(str, vars) {
  return String(str || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`);
}

module.exports = { generateLocalProof, interpolate };
