#!/usr/bin/env node
'use strict';

// scripts/build-design-director-prompt.js
// Regenerate agents/prompts/design_director.txt from
// agents/prompts/design_director.template.txt by substituting `{{SPEC}}` with
// the live output of `npx @google/design.md spec --rules`. Keeps the agent
// prompt locked to the version of the spec we ship in package-lock.json.
//
// Run:  npm run design:build-prompt
// CI:   npm run design:check-prompt

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const repoRoot   = path.resolve(__dirname, '..');
const templateP  = path.join(repoRoot, 'agents', 'prompts', 'design_director.template.txt');
const targetP    = path.join(repoRoot, 'agents', 'prompts', 'design_director.txt');

function fetchSpec() {
  return execFileSync('npx', ['--yes', '@google/design.md', 'spec', '--rules'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function build() {
  const template = fs.readFileSync(templateP, 'utf8');
  const spec = fetchSpec().trim();
  return template.replace('{{SPEC}}', spec);
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const next = build();
  if (checkOnly) {
    let existing = '';
    try { existing = fs.readFileSync(targetP, 'utf8'); } catch (e) { /* missing */ }
    if (existing !== next) {
      console.error(`✖ ${path.relative(repoRoot, targetP)} is stale. Run 'npm run design:build-prompt'.`);
      process.exit(1);
    }
    console.log(`✓ ${path.relative(repoRoot, targetP)} matches the live spec`);
    return;
  }
  fs.writeFileSync(targetP, next, 'utf8');
  console.log(`✓ wrote ${path.relative(repoRoot, targetP)} (${next.length} chars)`);
}

main();
