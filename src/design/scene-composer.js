'use strict';

// src/design/scene-composer.js
// Scene Composer — groups intent/variant blocks into scenes with surfaces and density.
//
// A scene is a visual and narrative moment on the page. Scenes control:
//   - background surface (paper, brand-soft, warm-light, etc.)
//   - spacing density (airy, balanced, dense)
//   - grouped block relationships
//   - visual pacing and narrative rhythm
//
// Scene types:
//   hero_scene       — Primary conversion moment, airy, brand surface
//   proof_scene      — Social and local proof, warm surface
//   services_scene   — Services/features, clean paper surface
//   objection_scene  — FAQ, objection handling, subtle surface
//   conversion_scene — Final CTA, high-contrast brand surface
//
// Output schema shape:
// {
//   scenes: [
//     {
//       scene: "hero_scene",
//       surface: "brand-soft",
//       density: "airy",
//       blocks: [
//         { intent: "drive_primary_conversion", variant: "split_booking_hero", content: {} },
//         { intent: "establish_trust", variant: "rating_trust_strip", content: {} }
//       ]
//     }
//   ]
// }

const { resolveNichePack } = require('../niches/index');

// Default scene grouping rules (intent → scene)
const INTENT_SCENE_MAP = {
  drive_primary_conversion: 'hero_scene',
  establish_trust:          'hero_scene',
  reinforce_authority:      'hero_scene',
  highlight_services:       'services_scene',
  explain_process:          'services_scene',
  show_social_proof:        'proof_scene',
  show_local_proof:         'proof_scene',
  reduce_objections:        'objection_scene',
  capture_lead:             'conversion_scene',
  secondary_cta_close:      'conversion_scene'
};

// Scene ordering (determines final page order)
const SCENE_ORDER = ['hero_scene', 'services_scene', 'proof_scene', 'objection_scene', 'conversion_scene'];

// Default surface and density per scene
const SCENE_DEFAULTS = {
  hero_scene:       { surface: 'brand-soft',       density: 'airy' },
  services_scene:   { surface: 'paper',             density: 'balanced' },
  proof_scene:      { surface: 'warm-light',        density: 'balanced' },
  objection_scene:  { surface: 'subtle-gradient',   density: 'balanced' },
  conversion_scene: { surface: 'brand-strong',      density: 'dense' }
};

/**
 * Compose a scene-based schema from an intent+variant plan.
 * @param {Array<{intent: string, variant: string}>} intentVariantPlan
 * @param {object} brief - The site brief
 * @param {object} [nichePack] - Optional pre-resolved niche pack
 * @returns {{ scenes: Array }} Scene-based schema
 */
function composeScenes(intentVariantPlan, brief, nichePack) {
  const pack = nichePack || resolveNichePack((brief || {}).niche);
  const packSceneMap = (pack.variants && pack.variants.sceneMap) || {};

  // Build a map of scene → blocks (preserving intent order within each scene)
  const sceneBlocks = {};
  const sceneOrder = [];

  for (const { intent, variant } of (intentVariantPlan || [])) {
    const sceneName = INTENT_SCENE_MAP[intent] || 'services_scene';

    if (!sceneBlocks[sceneName]) {
      sceneBlocks[sceneName] = [];
      sceneOrder.push(sceneName);
    }

    sceneBlocks[sceneName].push({ intent, variant, content: {} });
  }

  // Resolve surfaces and densities, preferring niche pack overrides
  const scenes = [];
  const orderedScenes = SCENE_ORDER.filter(s => sceneBlocks[s]);

  for (const sceneName of orderedScenes) {
    const packScene = packSceneMap[sceneName] || {};
    const defaults = SCENE_DEFAULTS[sceneName] || { surface: 'paper', density: 'balanced' };

    scenes.push({
      scene: sceneName,
      surface: packScene.surface || defaults.surface,
      density: packScene.density || defaults.density,
      blocks: sceneBlocks[sceneName]
    });
  }

  return { scenes };
}

/**
 * Flatten a scene schema back to a simple ordered block list (for renderers that don't support scenes natively).
 * @param {{ scenes: Array }} sceneSchema
 * @returns {Array<{intent: string, variant: string, surface: string, density: string, content: object}>}
 */
function flattenScenes(sceneSchema) {
  const blocks = [];
  for (const scene of (sceneSchema.scenes || [])) {
    for (const block of (scene.blocks || [])) {
      blocks.push({
        ...block,
        _scene: scene.scene,
        _surface: scene.surface,
        _density: scene.density
      });
    }
  }
  return blocks;
}

module.exports = { composeScenes, flattenScenes, INTENT_SCENE_MAP, SCENE_DEFAULTS, SCENE_ORDER };
