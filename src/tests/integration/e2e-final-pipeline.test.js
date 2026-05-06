'use strict';

const path = require('path');
const previewGenerator = require('../../preview/preview-generator');

async function run() {
  console.log('--- Running Final Pipeline E2E Test ---');

  const lead = {
    lead_id: 'test-hvac-123',
    business_name: 'Frosty Air Heating & Cooling',
    niche: 'HVAC Contractor',
    city: 'Austin',
    state: 'TX',
    phone: '512-555-0199',
    website: 'http://frostyair-fake.com',
    notes: { weaknesses: ['no reviews', 'outdated design'] }
  };

  try {
    const result = await previewGenerator(lead, {
      outDir: path.resolve(__dirname, '../../../previews'),
      assetPrefix: '../',
      skipAI: true
    });

    console.log('✅ Pipeline completed successfully');
    console.log(`✅ Niche resolved: ${result.nichePack ? result.nichePack.config.id : 'none'}`);
    console.log(`✅ Design profile: ${result.design ? result.design.profile : 'none'}`);
    console.log(`✅ Intent plan generated (${result.intentPlan ? result.intentPlan.length : 0} intents)`);
    console.log(`✅ Scene schema generated (${result.sceneSchema ? result.sceneSchema.scenes.length : 0} scenes)`);
    console.log(`✅ Validation errors: ${result.validationErrors.length}`);
    
    if (result.validationErrors.length > 0) {
      console.log(result.validationErrors);
    }

    if (result.html && result.html.includes('Strategy Preview')) {
      console.log('✅ Strategy panel injected into HTML');
    } else {
      console.error('❌ Strategy panel missing from HTML');
    }

    if (result.html && result.html.includes('surface-brand-soft')) {
      console.log('✅ Surface CSS injected into HTML');
    } else {
      console.error('❌ Surface CSS missing from HTML');
    }

    console.log(`\nPreview saved to: ${result.preview.filepath}`);
    
  } catch (err) {
    console.error('❌ Pipeline failed:', err);
    process.exit(1);
  }
}

run();
