'use strict';
/**
 * screenshot-provider.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Selects and wraps the active screenshot provider based on the
 * SCREENSHOT_PROVIDER environment variable.
 *
 * Supported providers:
 *   local        – Playwright headless Chromium (default; works with file:// URLs)
 *   browserless  – Browserless.io remote API (http/https URLs only)
 *
 * Provider modules must export:
 *   capture(url, outputPath, options?) → Promise<{success, path, provider, error}>
 *   providerName  (string)
 *
 * Result shape written by takeScreenshot():
 *   {
 *     success:  boolean,
 *     path:     string | null,
 *     provider: string,   // canonical provider name
 *     error:    string | null,
 *   }
 *
 * Provider name resolution:
 *   result.provider is set to provider.providerName if available on the module,
 *   otherwise falls back to the providerName string used to load the module.
 */

const path = require('path');

const PROVIDER_MAP = {
  local:       () => require('./screenshot-service'),
  browserless: () => require('./providers/browserless'),
};

/**
 * getProvider()
 * Returns the active provider module based on SCREENSHOT_PROVIDER env var.
 * Defaults to "local".
 */
function getProvider() {
  const key = (process.env.SCREENSHOT_PROVIDER || 'local').toLowerCase().trim();
  const loader = PROVIDER_MAP[key];
  if (!loader) {
    throw new Error(
      `Unknown SCREENSHOT_PROVIDER="${key}". Valid options: ${Object.keys(PROVIDER_MAP).join(', ')}`
    );
  }
  return { module: loader(), key };
}

/**
 * takeScreenshot(url, outputPath, options?)
 *
 * Captures a single screenshot using the active provider.
 * Normalises the result so that result.provider is always set correctly:
 *   - Uses provider.providerName if the module exports it
 *   - Falls back to the environment key used to load the provider
 *
 * @param {string} url
 * @param {string} outputPath
 * @param {object} [options]
 * @returns {Promise<{success:boolean, path:string|null, provider:string, error:string|null}>}
 */
async function takeScreenshot(url, outputPath, options = {}) {
  const { module: provider, key: providerKey } = getProvider();

  // Resolve the canonical provider name: prefer module.providerName, else env key
  const resolvedProviderName = provider.providerName || providerKey;

  let result;
  if (typeof provider.capture === 'function') {
    result = await provider.capture(url, outputPath, options);
  } else if (typeof provider.captureSingleUrl === 'function') {
    // Compatibility shim for screenshot-service.js (local provider)
    result = await provider.captureSingleUrl(url, outputPath, options);
  } else {
    return {
      success:  false,
      path:     null,
      provider: resolvedProviderName,
      error:    `Provider "${resolvedProviderName}" does not export a capture() or captureSingleUrl() function.`,
    };
  }

  // Ensure result.provider is set to the canonical name
  return {
    ...result,
    provider: resolvedProviderName,
  };
}

module.exports = { takeScreenshot, getProvider };
