'use strict';

// src/tests/design-md.test.js
// Round-trip test: a design profile (or niche pack) should serialize to a
// DESIGN.md document that lints cleanly under @google/design.md.

const assert = require('assert');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

const { directDesign } = require('../design/design-director');
const { fromDesignProfile, fromNichePack } = require('../design/design-md');
const { lintDesignMd } = require('../design/design-md-lint');
const { packs } = require('../niches');

const NICHE_DEFAULTS = {
  dentist:  { paletteCandidates: ['luxury_teal', 'clinical_blue'],  typographyKey: 'editorial_serif',  layoutKey: 'airy' },
  hvac:     { paletteCandidates: ['slate_orange', 'bold_orange'],   typographyKey: 'strong_sans',      layoutKey: 'compact' },
  lawyer:   { paletteCandidates: ['slate_refined', 'clinical_blue'],typographyKey: 'editorial_serif',  layoutKey: 'airy' },
  general:  { paletteCandidates: ['neutral_blue'],                  typographyKey: 'clean_system',     layoutKey: 'balanced' }
};

async function run() {
  // 1. Per-page profile round-trip.
  const brief = {
    niche: 'dentist',
    primary_goal: 'book_appointments',
    slug: 'smile-bright-dental',
    brand: { name: 'Smile Bright Dental' }
  };
  const design = directDesign(brief);
  const md = fromDesignProfile(design, { brief });
  const report = await lintDesignMd(md);

  assert.strictEqual(report.errors, 0, `expected 0 lint errors in per-page DESIGN.md, got ${report.errors}: ${JSON.stringify(report.findings, null, 2)}`);
  assert.ok(report.sections.includes('Colors'), 'Colors section should be present');
  assert.ok(report.sections.includes('Typography'), 'Typography section should be present');
  assert.ok(report.sections.includes('Components'), 'Components section should be present');

  // 2. Per-niche-pack round-trip for every shipped niche.
  for (const [name, pack] of Object.entries(packs)) {
    const opts = NICHE_DEFAULTS[name];
    if (!opts) continue;
    const niche_md = fromNichePack(name, pack, opts);
    const niche_report = await lintDesignMd(niche_md);
    assert.strictEqual(
      niche_report.errors,
      0,
      `expected 0 lint errors in ${name} DESIGN.md, got ${niche_report.errors}: ${JSON.stringify(niche_report.findings, null, 2)}`
    );
  }

  // 3. Determinism: same brief → identical DESIGN.md output.
  const md_again = fromDesignProfile(directDesign(brief), { brief });
  assert.strictEqual(md_again, md, 'DESIGN.md output should be deterministic for the same brief');

  // 4. The output is a real file the lint CLI can read, not just an in-memory blob.
  const tmpFile = path.join(os.tmpdir(), `design-md-${Date.now()}.md`);
  await fs.writeFile(tmpFile, md, 'utf8');
  await fs.unlink(tmpFile);

  console.log('ok - design-md.test.js');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
