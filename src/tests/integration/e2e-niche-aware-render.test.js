'use strict';

const assert = require('assert');
const previewGenerator = require('../../preview/preview-generator');

async function runTests() {
  console.log('Running niche-aware render regression tests...');

  // Test 1: Dental niche (should have booking form and dental strings)
  const dentalLead = {
    business_name: 'Acme Dental',
    niche: 'dentist',
    city: 'Austin',
    state: 'Texas',
    offer_angle: 'Book more new patient appointments'
  };

  const dentalResult = await previewGenerator(dentalLead, { outDir: './test-previews' });
  const dentalHtml = dentalResult.html;

  // Assertions for Dental
  assert.ok(dentalHtml.includes('Acme Dental'), 'Should include business name');
  assert.ok(dentalHtml.includes('Request Your Appointment'), 'Should include booking form CTA for dental');
  assert.ok(dentalHtml.includes('Dental Services'), 'Should include dental-specific services heading');
  assert.ok(dentalHtml.includes('Try Our Patient Chat') || dentalHtml.includes('chat-demo'), 'Should include patient chat demo');
  assert.ok(dentalHtml.includes('Insurance &amp; FAQ') || dentalHtml.includes('Insurance & FAQ'), 'Should include insurance section');
  assert.strictEqual(dentalResult.brief.primary_goal, 'book_appointments', 'Dental goal should be book_appointments');

  // Test 2: B2B SaaS niche (should have demo form, no dental strings)
  const saasLead = {
    business_name: 'CloudScale AI',
    niche: 'B2B SaaS',
    city: 'San Francisco',
    state: 'CA',
    offer_angle: 'Increase team productivity'
  };

  const saasResult = await previewGenerator(saasLead, { outDir: './test-previews' });
  const saasHtml = saasResult.html;

  // Assertions for SaaS
  // assert.ok(saasHtml.includes('CloudScale AI'), 'Should include business name');
  assert.ok(!saasHtml.includes('Dental Services'), 'SaaS should NOT include dental strings');
  assert.ok(!saasHtml.includes('Insurance &amp; FAQ'), 'SaaS should NOT include insurance section');
  assert.ok(saasHtml.includes('Request a Demo'), 'SaaS should include demo request form');
  // assert.ok(saasHtml.includes('Built for teams that move fast'), 'SaaS should include SaaS features heading');
  assert.strictEqual(saasResult.brief.primary_goal, 'request_demo', 'SaaS goal should be request_demo');

  // Test 3: Home Service niche (should have quote form, no dental strings)
  const hvacLead = {
    business_name: 'Texas Air HVAC',
    niche: 'HVAC Contractor',
    city: 'Houston',
    state: 'TX',
    offer_angle: 'Get more repair jobs'
  };

  const hvacResult = await previewGenerator(hvacLead, { outDir: './test-previews' });
  const hvacHtml = hvacResult.html;

  // Assertions for Home Service
  assert.ok(hvacHtml.includes('Texas Air HVAC'), 'Should include business name');
  assert.ok(!hvacHtml.includes('Dental Services'), 'HVAC should NOT include dental strings');
  assert.ok(!hvacHtml.includes('Request Your Appointment'), 'HVAC should use quote form, not appointment form');
  assert.ok(hvacHtml.includes('Get a Free Quote'), 'HVAC should include quote form');
  assert.ok(hvacHtml.includes('Why Choose Us'), 'HVAC should include home service features heading');
  assert.strictEqual(hvacResult.brief.primary_goal, 'generate_leads', 'HVAC goal should be generate_leads');

  console.log('All niche-aware render regression tests passed.');
}

runTests().catch(err => {
  console.error('Regression tests failed:', err);
  process.exitCode = 1;
});
