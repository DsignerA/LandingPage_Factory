'use strict';

// ai-page-generator: exposes a provider interface for generating
// renderer-compatible page schemas. Defaults to the deterministic
// "noop" provider.
//
// Provider interface contract:
// - provider.name: string
// - provider.generate(brief?: object, options?: object): Array<section>
//   where section = { id?: string, type: string, props?: object }
//
// Usage:
//   // elsewhere in your codebase
//   const { generate, getProvider } = require('./src/ai/ai-page-generator');
//
//   // Default (noop) usage
//   const pageSections = generate(siteBrief);
//
//   // Or explicitly pick provider
//   const p = getProvider('noop');
//   const sections = p.generate(siteBrief);

const noopProvider = require('./providers/noop');
const upgradeProvider = require('./providers/upgrade');

const providers = Object.create(null);
providers.noop = noopProvider;
providers.upgrade = upgradeProvider;

function getProvider(name) {
  if (name && typeof name === 'string' && providers[name]) return providers[name];
  return providers.noop; // default
}

function registerProvider(name, provider) {
  if (!name || typeof name !== 'string') throw new Error('Provider name must be a non-empty string');
  if (!provider || typeof provider.generate !== 'function') throw new Error('Provider must implement generate(brief, options)');
  providers[name] = provider;
}

function generate(brief, options) {
  // Default to 'upgrade' provider which implements the full persuasive upgrade model.
  // Fall back to 'noop' only when explicitly requested.
  const providerName = options && options.provider ? String(options.provider) : 'upgrade';
  const p = getProvider(providerName);
  return p.generate(brief, options);
}

module.exports = {
  providers,
  getProvider,
  registerProvider,
  generate,
  defaultProvider: 'upgrade'
};

