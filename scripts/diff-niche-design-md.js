#!/usr/bin/env node
'use strict';

// scripts/diff-niche-design-md.js
// Compare the current niche DESIGN.md files against a baseline (git ref or
// directory) using `npx @google/design.md diff`. Fails (exit 1) if any niche
// has an "after" report with more errors or warnings than its "before" report,
// or if the diff CLI itself signals a regression.
//
// Usage:
//   node scripts/diff-niche-design-md.js                # baseline = origin/main
//   node scripts/diff-niche-design-md.js --base main    # custom git ref
//   node scripts/diff-niche-design-md.js --base-dir tmp/baseline-design

const path = require('path');
const fs = require('fs/promises');
const fssync = require('fs');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const nichesRoot = path.join(repoRoot, 'src', 'niches');

function parseArgs(argv) {
  const args = { base: 'origin/main', baseDir: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') args.base = argv[++i];
    else if (a === '--base-dir') args.baseDir = argv[++i];
  }
  return args;
}

function listNicheDesignFiles() {
  const out = [];
  for (const entry of fssync.readdirSync(nichesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = path.join(nichesRoot, entry.name, 'DESIGN.md');
    if (fssync.existsSync(p)) out.push({ niche: entry.name, path: p });
  }
  return out;
}

function gitShow(ref, relPath) {
  // Returns the file contents at the given ref, or null if missing.
  const result = spawnSync('git', ['show', `${ref}:${relPath}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0) return null;
  return result.stdout;
}

async function materializeBaseline(args) {
  if (args.baseDir) return path.resolve(args.baseDir);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'design-md-baseline-'));
  for (const { niche, path: p } of listNicheDesignFiles()) {
    const rel = path.relative(repoRoot, p);
    const contents = gitShow(args.base, rel);
    if (contents == null) continue; // niche didn't exist at baseline
    const dest = path.join(tmpDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, contents, 'utf8');
  }
  return tmpDir;
}

function runDiffCli(beforePath, afterPath) {
  const stdout = execFileSync(
    'npx',
    ['--yes', '@google/design.md', 'diff', beforePath, afterPath, '--format', 'json'],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return JSON.parse(stdout);
}

async function main() {
  const args = parseArgs(process.argv);
  const baseRoot = await materializeBaseline(args);

  let regressed = false;
  for (const { niche, path: afterPath } of listNicheDesignFiles()) {
    const rel = path.relative(repoRoot, afterPath);
    const beforePath = path.join(baseRoot, rel);
    if (!fssync.existsSync(beforePath)) {
      console.log(`+ ${niche}: new DESIGN.md (no baseline to diff against)`);
      continue;
    }
    const report = runDiffCli(beforePath, afterPath);
    const before = report.findings.before;
    const after = report.findings.after;
    const worse =
      after.errors > before.errors ||
      after.warnings > before.warnings;

    const summary = `errors ${before.errors}→${after.errors}, warnings ${before.warnings}→${after.warnings}`;
    if (worse) {
      regressed = true;
      console.error(`✖ ${niche}: regression (${summary})`);
    } else {
      console.log(`✓ ${niche}: ok (${summary})`);
    }
  }

  if (regressed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
