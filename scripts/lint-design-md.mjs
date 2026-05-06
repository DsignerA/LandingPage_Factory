#!/usr/bin/env node
// scripts/lint-design-md.mjs
// CLI helper: lint a DESIGN.md file using the @google/design.md programmatic
// API. Used by the render pipeline (via spawn) and by the npm scripts.
//
// Usage:
//   node scripts/lint-design-md.mjs <path-to-DESIGN.md>
//   cat DESIGN.md | node scripts/lint-design-md.mjs -
//
// Exit code 1 if errors are found, 0 otherwise. Output is a JSON LintReport
// (without the resolved tailwind config blob, to keep stdout small).

import { readFile } from 'node:fs/promises';
import { lint } from '@google/design.md/linter';

async function readInput(arg) {
  if (!arg || arg === '-') {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  }
  return readFile(arg, 'utf8');
}

const arg = process.argv[2];
const content = await readInput(arg);
const report = lint(content);

const out = {
  source: arg && arg !== '-' ? arg : '<stdin>',
  summary: report.summary,
  findings: report.findings,
  sections: report.sections
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(report.summary.errors > 0 ? 1 : 0);
