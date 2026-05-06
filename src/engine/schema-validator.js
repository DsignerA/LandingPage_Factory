'use strict';

// src/engine/schema-validator.js
// Schema Validation — validates lead input and generated intermediate structures.
//
// Validates:
//   1. raw lead input
//   2. normalized brief
//   3. intent plan
//   4. scene schema
//   5. final render schema
//
// Returns: { valid: boolean, errors: string[] }

const { ALL_INTENTS } = require('../design/intent-map');

// ── Helpers ────────────────────────────────────────────────────────────────────

function isString(v) { return typeof v === 'string'; }
function isNonEmptyString(v) { return isString(v) && v.trim().length > 0; }
function isArray(v) { return Array.isArray(v); }
function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

function result(errors) {
  return { valid: errors.length === 0, errors };
}

// ── 1. Raw Lead Input ──────────────────────────────────────────────────────────

function validateRawLead(lead) {
  const errors = [];
  if (!isObject(lead)) {
    return result(['Lead input must be a non-null object']);
  }
  if (!isNonEmptyString(lead.business_name) && !isNonEmptyString(lead.name)) {
    errors.push('Lead must have a business_name or name field');
  }
  if (lead.niche !== undefined && !isString(lead.niche)) {
    errors.push('Lead.niche must be a string if provided');
  }
  return result(errors);
}

// ── 2. Normalized Brief ────────────────────────────────────────────────────────

function validateBrief(brief) {
  const errors = [];
  if (!isObject(brief)) {
    return result(['Brief must be a non-null object']);
  }
  if (!isNonEmptyString(brief.niche)) {
    errors.push('Brief.niche must be a non-empty string');
  }
  if (!isNonEmptyString(brief.primary_goal)) {
    errors.push('Brief.primary_goal must be a non-empty string');
  }
  if (!isObject(brief.brand)) {
    errors.push('Brief.brand must be an object');
  } else {
    if (!isNonEmptyString(brief.brand.name)) {
      errors.push('Brief.brand.name must be a non-empty string');
    }
  }
  if (!isObject(brief.messaging)) {
    errors.push('Brief.messaging must be an object');
  } else {
    if (!isNonEmptyString(brief.messaging.headline)) {
      errors.push('Brief.messaging.headline must be a non-empty string');
    }
  }
  if (!isObject(brief.ctas)) {
    errors.push('Brief.ctas must be an object');
  } else {
    if (!isObject(brief.ctas.primary)) {
      errors.push('Brief.ctas.primary must be an object with label and href');
    }
  }
  return result(errors);
}

// ── 3. Intent Plan ─────────────────────────────────────────────────────────────

function validateIntentPlan(intentPlan) {
  const errors = [];
  if (!isArray(intentPlan)) {
    return result(['Intent plan must be an array']);
  }
  if (intentPlan.length === 0) {
    errors.push('Intent plan must have at least one intent');
  }
  for (const [i, intent] of intentPlan.entries()) {
    if (!isNonEmptyString(intent)) {
      errors.push(`Intent plan[${i}] must be a non-empty string`);
    } else if (!ALL_INTENTS.includes(intent)) {
      errors.push(`Intent plan[${i}] "${intent}" is not a recognized intent`);
    }
  }
  if (!intentPlan.includes('drive_primary_conversion')) {
    errors.push('Intent plan must include "drive_primary_conversion"');
  }
  return result(errors);
}

// ── 4. Scene Schema ────────────────────────────────────────────────────────────

const VALID_SCENES = ['hero_scene', 'services_scene', 'proof_scene', 'objection_scene', 'conversion_scene'];
const VALID_SURFACES = ['paper', 'brand-soft', 'warm-light', 'subtle-gradient', 'contrast-dark', 'brand-strong'];
const VALID_DENSITIES = ['airy', 'balanced', 'dense'];

function validateSceneSchema(sceneSchema) {
  const errors = [];
  if (!isObject(sceneSchema)) {
    return result(['Scene schema must be a non-null object']);
  }
  if (!isArray(sceneSchema.scenes)) {
    return result(['Scene schema must have a scenes array']);
  }
  if (sceneSchema.scenes.length === 0) {
    errors.push('Scene schema must have at least one scene');
  }
  for (const [si, scene] of sceneSchema.scenes.entries()) {
    const prefix = `scenes[${si}]`;
    if (!isObject(scene)) { errors.push(`${prefix} must be an object`); continue; }
    if (!isNonEmptyString(scene.scene)) errors.push(`${prefix}.scene must be a non-empty string`);
    else if (!VALID_SCENES.includes(scene.scene)) errors.push(`${prefix}.scene "${scene.scene}" is not a recognized scene type`);
    if (!isNonEmptyString(scene.surface)) errors.push(`${prefix}.surface must be a non-empty string`);
    else if (!VALID_SURFACES.includes(scene.surface)) errors.push(`${prefix}.surface "${scene.surface}" is not a recognized surface`);
    if (!isNonEmptyString(scene.density)) errors.push(`${prefix}.density must be a non-empty string`);
    else if (!VALID_DENSITIES.includes(scene.density)) errors.push(`${prefix}.density "${scene.density}" is not a recognized density`);
    if (!isArray(scene.blocks)) { errors.push(`${prefix}.blocks must be an array`); continue; }
    for (const [bi, block] of scene.blocks.entries()) {
      const bprefix = `${prefix}.blocks[${bi}]`;
      if (!isObject(block)) { errors.push(`${bprefix} must be an object`); continue; }
      if (!isNonEmptyString(block.intent)) errors.push(`${bprefix}.intent must be a non-empty string`);
      if (!isNonEmptyString(block.variant)) errors.push(`${bprefix}.variant must be a non-empty string`);
    }
  }
  return result(errors);
}

// ── 5. Final Render Schema ─────────────────────────────────────────────────────

function validateRenderSchema(renderSchema) {
  const errors = [];
  if (!isObject(renderSchema)) {
    return result(['Render schema must be a non-null object']);
  }

  // Must have either scenes (new) or sections (legacy)
  const hasScenes = isArray(renderSchema.scenes) && renderSchema.scenes.length > 0;
  const hasSections = isArray(renderSchema.sections) && renderSchema.sections.length > 0;

  if (!hasScenes && !hasSections) {
    errors.push('Render schema must have either scenes or sections');
  }

  if (isObject(renderSchema.meta)) {
    if (renderSchema.meta.title !== undefined && !isString(renderSchema.meta.title)) {
      errors.push('renderSchema.meta.title must be a string if provided');
    }
  }

  return result(errors);
}

// ── Composite validator ────────────────────────────────────────────────────────

/**
 * Validate a pipeline stage by name.
 * @param {'lead'|'brief'|'intentPlan'|'sceneSchema'|'renderSchema'} stage
 * @param {*} data
 * @returns {{ valid: boolean, errors: string[], stage: string }}
 */
function validate(stage, data) {
  let r;
  switch (stage) {
    case 'lead':        r = validateRawLead(data); break;
    case 'brief':       r = validateBrief(data); break;
    case 'intentPlan':  r = validateIntentPlan(data); break;
    case 'sceneSchema': r = validateSceneSchema(data); break;
    case 'renderSchema':r = validateRenderSchema(data); break;
    default:
      r = { valid: false, errors: [`Unknown validation stage: "${stage}"`] };
  }
  return { ...r, stage };
}

module.exports = {
  validate,
  validateRawLead,
  validateBrief,
  validateIntentPlan,
  validateSceneSchema,
  validateRenderSchema
};
