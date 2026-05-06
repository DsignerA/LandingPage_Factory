// lead-normalizer.test.js
const assert = require('assert');
const { normalizeLead, _internal } = require('./lead-normalizer');

function runTests() {
  {
    const lead = normalizeLead({
      business_name: 'acme dental seo llc',
      city: 'richmond',
      state: 'virginia',
      website_url: 'www.acmedental.com/some/path?x=1',
      niche: 'Dentist',
      notes: 'Weaknesses: slow site; poor SEO. Opportunities: local SEO; after-hours chat.',
      offer_angle: 'capture missed calls',
      created_at: '2026-03-11'
    });

    assert.strictEqual(lead.business_name, 'Acme Dental SEO LLC');
    assert.strictEqual(lead.location, 'Richmond, VA');
    assert.strictEqual(lead.website_url, 'https://www.acmedental.com');
    assert.deepStrictEqual(lead.weaknesses, ['slow site', 'poor SEO.']);
    assert.deepStrictEqual(lead.opportunities, ['local SEO', 'after-hours chat.']);
    assert.strictEqual(lead.niche, 'dentist');
    assert.ok(lead.lead_id.startsWith('lead_'));
    assert.ok(lead.slug.includes('richmond'));
  }

  {
    const lead = normalizeLead({
      website: 'https://acme-plumbing.co.uk/services',
      city: 'norfolk',
      state: 'VA',
      niche: ''
    });

    assert.strictEqual(lead.business_name, 'Acme Plumbing');
    assert.strictEqual(lead.location, 'Norfolk, VA');
    assert.strictEqual(lead.website_url, 'https://acme-plumbing.co.uk');
    assert.strictEqual(lead.niche, 'general');
  }

  {
    const parsed = _internal.parseNotes(`
Weaknesses:
- outdated website
- no booking flow

Opportunities:
- add web chat
- improve page speed
`);

    assert.deepStrictEqual(parsed.weaknesses, ['outdated website', 'no booking flow']);
    assert.deepStrictEqual(parsed.opportunities, ['add web chat', 'improve page speed']);
  }

  {
    const parsed = _internal.parseNotes('Opportunities: after-hours booking; local SEO; missed-call capture');
    assert.deepStrictEqual(parsed.opportunities, [
      'after-hours booking',
      'local SEO',
      'missed-call capture'
    ]);
  }

  {
    assert.strictEqual(_internal.normalizeState('Virginia'), 'VA');
    assert.strictEqual(_internal.normalizeState('state of virginia'), 'VA');
    assert.strictEqual(_internal.normalizeState('Ontario'), '');
  }

  {
    const a = normalizeLead({
      business_name: 'Acme Dental',
      city: 'Richmond',
      state: 'VA',
      website_url: 'acmedental.com',
      niche: 'dentist'
    });

    const b = normalizeLead({
      business_name: 'Acme Dental',
      city: 'Richmond',
      state: 'Virginia',
      website_url: 'https://acmedental.com/',
      niche: 'dentist'
    });

    assert.strictEqual(a.lead_id, b.lead_id);
    assert.strictEqual(a.slug, b.slug);
  }

  {
    const lead = normalizeLead({}, { fixedTimestamp: '2026-03-11T12:00:00Z' });
    assert.strictEqual(lead.created_at, '2026-03-11T12:00:00.000Z');
    assert.strictEqual(lead.business_name, 'Unknown Business');
  }

  console.log('All tests passed.');
}

runTests();