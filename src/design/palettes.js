'use strict';

// src/design/palettes.js
// Named color palettes for the design token system.
// Each palette defines the full set of semantic color roles used by the render engine
// and components. All values are deterministic and do not change at runtime.
//
// Roles:
//   bg         – page background
//   surface    – card / section surface
//   surfaceAlt – alternate surface (zebra rows, subtle panels)
//   primary    – brand primary (buttons, links, highlights)
//   primaryHover – primary on hover
//   primaryLight – tinted primary background (badges, chips)
//   primaryRing  – focus ring color
//   secondary  – secondary brand color (used sparingly)
//   accent     – accent / decorative color (borders, icons, highlights)
//   border     – default border color
//   text       – primary body text
//   textMuted  – secondary / muted text
//   textInverse – text on dark/primary backgrounds

const PALETTES = {

  // ── Healthcare / Dental ────────────────────────────────────────────────────

  luxury_teal: {
    bg: '#faf9f6',
    surface: '#ffffff',
    surfaceAlt: '#f4f7f7',
    primary: '#1a6b6b',
    primaryHover: '#155858',
    primaryLight: '#e8f4f4',
    primaryRing: '#7bbfbf',
    secondary: '#2d8c8c',
    accent: '#c4922a',
    border: '#d8e4e4',
    text: '#0f1c1c',
    textMuted: '#4a6464',
    textInverse: '#ffffff'
  },

  clinical_blue: {
    bg: '#f8fafc',
    surface: '#ffffff',
    surfaceAlt: '#f0f5fb',
    primary: '#1e5fa8',
    primaryHover: '#174d8c',
    primaryLight: '#ddeaf8',
    primaryRing: '#7ab0e0',
    secondary: '#2d7dd2',
    accent: '#f0a500',
    border: '#cddcee',
    text: '#0d1f33',
    textMuted: '#4a6480',
    textInverse: '#ffffff'
  },

  // ── Home Service ──────────────────────────────────────────────────────────

  slate_orange: {
    bg: '#f8f8f7',
    surface: '#ffffff',
    surfaceAlt: '#f3f3f1',
    primary: '#1e293b',
    primaryHover: '#0f172a',
    primaryLight: '#e8eaed',
    primaryRing: '#94a3b8',
    secondary: '#334155',
    accent: '#ea580c',
    border: '#d1d5db',
    text: '#111827',
    textMuted: '#6b7280',
    textInverse: '#ffffff'
  },

  bold_orange: {
    bg: '#fffaf7',
    surface: '#ffffff',
    surfaceAlt: '#fff3eb',
    primary: '#c2410c',
    primaryHover: '#9a3412',
    primaryLight: '#ffedd5',
    primaryRing: '#fdba74',
    secondary: '#ea580c',
    accent: '#1e293b',
    border: '#f0d0bb',
    text: '#1c1008',
    textMuted: '#78350f',
    textInverse: '#ffffff'
  },

  // ── B2B SaaS ──────────────────────────────────────────────────────────────

  indigo_neutral: {
    bg: '#f9fafb',
    surface: '#ffffff',
    surfaceAlt: '#f3f4f6',
    primary: '#4338ca',
    primaryHover: '#3730a3',
    primaryLight: '#eef2ff',
    primaryRing: '#a5b4fc',
    secondary: '#6366f1',
    accent: '#0ea5e9',
    border: '#e0e7ff',
    text: '#111827',
    textMuted: '#6b7280',
    textInverse: '#ffffff'
  },

  purple_dark: {
    bg: '#0f0a1e',
    surface: '#1a1030',
    surfaceAlt: '#231540',
    primary: '#7c3aed',
    primaryHover: '#6d28d9',
    primaryLight: '#2d1b5e',
    primaryRing: '#c4b5fd',
    secondary: '#a855f7',
    accent: '#f59e0b',
    border: '#3b2d6b',
    text: '#f5f3ff',
    textMuted: '#a78bfa',
    textInverse: '#0f0a1e'
  },

  // ── Professional Service ──────────────────────────────────────────────────

  slate_refined: {
    bg: '#f8f9fa',
    surface: '#ffffff',
    surfaceAlt: '#f1f3f5',
    primary: '#1e3a5f',
    primaryHover: '#162d4a',
    primaryLight: '#dce8f5',
    primaryRing: '#93b4d8',
    secondary: '#2d5f8a',
    accent: '#b8860b',
    border: '#d0d8e0',
    text: '#1a2332',
    textMuted: '#5a6a7a',
    textInverse: '#ffffff'
  },

  // ── Restaurant / Food ─────────────────────────────────────────────────────

  warm_amber: {
    bg: '#fffbf5',
    surface: '#ffffff',
    surfaceAlt: '#fef3e2',
    primary: '#b45309',
    primaryHover: '#92400e',
    primaryLight: '#fef3c7',
    primaryRing: '#fcd34d',
    secondary: '#d97706',
    accent: '#dc2626',
    border: '#fde68a',
    text: '#1c0a00',
    textMuted: '#78350f',
    textInverse: '#ffffff'
  },

  // ── Ecommerce ─────────────────────────────────────────────────────────────

  teal_fresh: {
    bg: '#f0fdfa',
    surface: '#ffffff',
    surfaceAlt: '#ccfbf1',
    primary: '#0d9488',
    primaryHover: '#0f766e',
    primaryLight: '#ccfbf1',
    primaryRing: '#5eead4',
    secondary: '#14b8a6',
    accent: '#f97316',
    border: '#99f6e4',
    text: '#0f2027',
    textMuted: '#4a7c7c',
    textInverse: '#ffffff'
  },

  // ── General / Fallback ────────────────────────────────────────────────────

  neutral_blue: {
    bg: '#f8fafc',
    surface: '#ffffff',
    surfaceAlt: '#f1f5f9',
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryLight: '#eff6ff',
    primaryRing: '#93c5fd',
    secondary: '#3b82f6',
    accent: '#f59e0b',
    border: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#64748b',
    textInverse: '#ffffff'
  }
};

module.exports = PALETTES;
