'use strict';

// src/design/design-md-lint.js
// CommonJS wrapper around the ESM-only @google/design.md linter API. Uses
// dynamic import so the rest of the (CommonJS) codebase can call lintDesignMd()
// synchronously-feeling via async/await.
//
// Returns a normalized report:
//   { errors, warnings, infos, findings, sections, ok }

let _linterPromise = null;
function loadLinter() {
  if (!_linterPromise) {
    _linterPromise = import('@google/design.md/linter');
  }
  return _linterPromise;
}

async function lintDesignMd(content) {
  const { lint } = await loadLinter();
  const report = lint(content);
  return {
    ok: report.summary.errors === 0,
    errors: report.summary.errors,
    warnings: report.summary.warnings,
    infos: report.summary.infos,
    findings: report.findings,
    sections: report.sections
  };
}

module.exports = { lintDesignMd };
