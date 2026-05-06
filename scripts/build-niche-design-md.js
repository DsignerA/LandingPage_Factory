#!/usr/bin/env node
'use strict';

// scripts/build-niche-design-md.js
// Generate src/niches/{niche}/DESIGN.md for every shipped niche pack.
// The source of truth remains the niche pack data (config.js + the design
// modules); this script just serializes that decision into a DESIGN.md the
// linter and diff tools can consume.
//
// Run:  npm run design:build-niches
// CI:   npm run design:check-niches  (verifies committed files are up to date)

const path = require('path');
const fs = require('fs/promises');

const { fromNichePack } = require('../src/design/design-md');
const { lintDesignMd }  = require('../src/design/design-md-lint');
const { packs }         = require('../src/niches');

// Mapping from niche pack id → the canonical defaults used by the design
// director when picking from this pack's allowed variants. These mirror the
// rules in src/design/design-director.js and src/niches/{niche}/config.js so
// the niche DESIGN.md describes the *typical* identity, not an outlier.
const NICHE_DEFAULTS = {
  dentist:  { paletteCandidates: ['luxury_teal', 'clinical_blue'],   typographyKey: 'editorial_serif',  layoutKey: 'airy' },
  hvac:     { paletteCandidates: ['slate_orange', 'bold_orange'],    typographyKey: 'strong_sans',      layoutKey: 'compact' },
  lawyer:   { paletteCandidates: ['slate_refined', 'clinical_blue'], typographyKey: 'editorial_serif',  layoutKey: 'airy' },
  general:  { paletteCandidates: ['neutral_blue'],                   typographyKey: 'clean_system',     layoutKey: 'balanced' }
};

const nichesRoot = path.resolve(__dirname, '..', 'src', 'niches');

async function main() {
  const checkOnly = process.argv.includes('--check');
  let drift = false;

  for (const [name, pack] of Object.entries(packs)) {
    const opts = NICHE_DEFAULTS[name];
    if (!opts) {
      console.warn(`! skipping ${name}: no NICHE_DEFAULTS entry`);
      continue;
    }
    const md = fromNichePack(name, pack, opts);
    const report = await lintDesignMd(md);
    if (!report.ok) {
      console.error(`✖ ${name}: lint errors`);
      for (const f of report.findings) {
        if (f.severity === 'error') console.error(`    - ${f.path || ''} ${f.message}`);
      }
      process.exitCode = 1;
      continue;
    }

    const targetDir = path.join(nichesRoot, name);
    await fs.mkdir(targetDir, { recursive: true });
    const target = path.join(targetDir, 'DESIGN.md');

    if (checkOnly) {
      let existing = '';
      try { existing = await fs.readFile(target, 'utf8'); } catch (e) { /* missing */ }
      if (existing !== md) {
        drift = true;
        console.error(`✖ ${name}: DESIGN.md is stale. Run 'npm run design:build-niches'.`);
      } else {
        console.log(`✓ ${name}: DESIGN.md up to date (${report.warnings} warnings)`);
      }
    } else {
      await fs.writeFile(target, md, 'utf8');
      console.log(`✓ ${name}: wrote ${path.relative(process.cwd(), target)} (${report.warnings} warnings)`);
    }
  }

  if (checkOnly && drift) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
