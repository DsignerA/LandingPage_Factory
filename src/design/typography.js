'use strict';

// src/design/typography.js
// Named typography scales for the design token system.
// Each scale defines font families and size/weight/line-height for every
// semantic text role used across components.
//
// Roles: Display, Hero, SectionHeading, Subheading, BodyLarge, Body, Caption, Label

const TYPOGRAPHY = {

  // Serif headline + clean sans body — premium, editorial feel (healthcare, professional)
  editorial_serif: {
    // Added googleFontsUrl: load Lora (600–700) and Inter (400–700) via Google Fonts
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Inter:wght@400;500;600;700&display=swap',
    fontFamilyHeading: '"Lora", Georgia, serif',
    fontFamilyBody: '"Inter", "Helvetica Neue", system-ui, sans-serif',
    Display:        { size: '4.5rem',  weight: '800', lineHeight: '1.05', letterSpacing: '-0.03em' },
    Hero:           { size: '3.25rem', weight: '700', lineHeight: '1.1',  letterSpacing: '-0.02em' },
    SectionHeading: { size: '2rem',    weight: '700', lineHeight: '1.2',  letterSpacing: '-0.01em' },
    Subheading:     { size: '1.25rem', weight: '500', lineHeight: '1.5',  letterSpacing: '0' },
    BodyLarge:      { size: '1.125rem',weight: '400', lineHeight: '1.7',  letterSpacing: '0' },
    Body:           { size: '1rem',    weight: '400', lineHeight: '1.65', letterSpacing: '0' },
    Caption:        { size: '0.8125rem',weight:'400', lineHeight: '1.5',  letterSpacing: '0.01em' },
    Label:          { size: '0.75rem', weight: '600', lineHeight: '1.4',  letterSpacing: '0.06em', textTransform: 'uppercase' }
  },

  // Modern grotesk — clean, tech-forward (B2B SaaS, agencies)
  modern_grotesk: {
    // Added googleFontsUrl: load DM Sans in multiple weights via Google Fonts
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800;900&display=swap',
    fontFamilyHeading: '"DM Sans", "Inter", system-ui, sans-serif',
    fontFamilyBody: '"DM Sans", "Inter", system-ui, sans-serif',
    Display:        { size: '5rem',    weight: '900', lineHeight: '1.0',  letterSpacing: '-0.04em' },
    Hero:           { size: '3.5rem',  weight: '800', lineHeight: '1.05', letterSpacing: '-0.03em' },
    SectionHeading: { size: '2.25rem', weight: '700', lineHeight: '1.15', letterSpacing: '-0.02em' },
    Subheading:     { size: '1.25rem', weight: '500', lineHeight: '1.5',  letterSpacing: '-0.01em' },
    BodyLarge:      { size: '1.125rem',weight: '400', lineHeight: '1.7',  letterSpacing: '0' },
    Body:           { size: '1rem',    weight: '400', lineHeight: '1.6',  letterSpacing: '0' },
    Caption:        { size: '0.8125rem',weight:'400', lineHeight: '1.5',  letterSpacing: '0.01em' },
    Label:          { size: '0.75rem', weight: '700', lineHeight: '1.4',  letterSpacing: '0.08em', textTransform: 'uppercase' }
  },

  // Strong sans — bold, high-contrast (home service, trades)
  strong_sans: {
    // Added googleFontsUrl: load Barlow Condensed (700–900) and Barlow (400–500) via Google Fonts
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500&display=swap',
    fontFamilyHeading: '"Barlow Condensed", "Roboto Condensed", system-ui, sans-serif',
    fontFamilyBody: '"Barlow", "Roboto", "Helvetica Neue", system-ui, sans-serif',
    Display:        { size: '4rem',    weight: '900', lineHeight: '1.05', letterSpacing: '-0.02em' },
    Hero:           { size: '2.75rem', weight: '800', lineHeight: '1.1',  letterSpacing: '-0.01em' },
    SectionHeading: { size: '1.875rem',weight: '700', lineHeight: '1.2',  letterSpacing: '0' },
    Subheading:     { size: '1.125rem',weight: '500', lineHeight: '1.5',  letterSpacing: '0' },
    BodyLarge:      { size: '1.0625rem',weight:'400', lineHeight: '1.65', letterSpacing: '0' },
    Body:           { size: '0.9375rem',weight:'400', lineHeight: '1.6',  letterSpacing: '0' },
    Caption:        { size: '0.8125rem',weight:'400', lineHeight: '1.5',  letterSpacing: '0.01em' },
    Label:          { size: '0.75rem', weight: '700', lineHeight: '1.4',  letterSpacing: '0.1em', textTransform: 'uppercase' }
  },

  // Warm humanist — approachable, friendly (restaurant, ecommerce)
  warm_humanist: {
    // Added googleFontsUrl: load Lora and Source Sans 3 via Google Fonts
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Source+Sans+3:wght@400;600&display=swap',
    fontFamilyHeading: '"Lora", "Merriweather", Georgia, serif',
    fontFamilyBody: '"Source Sans 3", "Open Sans", system-ui, sans-serif',
    Display:        { size: '4rem',    weight: '700', lineHeight: '1.1',  letterSpacing: '-0.02em' },
    Hero:           { size: '2.75rem', weight: '700', lineHeight: '1.15', letterSpacing: '-0.01em' },
    SectionHeading: { size: '1.875rem',weight: '600', lineHeight: '1.25', letterSpacing: '0' },
    Subheading:     { size: '1.125rem',weight: '400', lineHeight: '1.55', letterSpacing: '0' },
    BodyLarge:      { size: '1.0625rem',weight:'400', lineHeight: '1.7',  letterSpacing: '0' },
    Body:           { size: '1rem',    weight: '400', lineHeight: '1.65', letterSpacing: '0' },
    Caption:        { size: '0.8125rem',weight:'400', lineHeight: '1.5',  letterSpacing: '0.01em' },
    Label:          { size: '0.75rem', weight: '600', lineHeight: '1.4',  letterSpacing: '0.05em', textTransform: 'uppercase' }
  },

  // Clean system — neutral fallback
  clean_system: {
    // No Google Fonts loaded for clean_system
    googleFontsUrl: null,
    fontFamilyHeading: 'system-ui, -apple-system, sans-serif',
    fontFamilyBody: 'system-ui, -apple-system, sans-serif',
    Display:        { size: '4rem',    weight: '800', lineHeight: '1.05', letterSpacing: '-0.02em' },
    Hero:           { size: '2.75rem', weight: '700', lineHeight: '1.1',  letterSpacing: '-0.01em' },
    SectionHeading: { size: '1.875rem',weight: '700', lineHeight: '1.2',  letterSpacing: '0' },
    Subheading:     { size: '1.125rem',weight: '500', lineHeight: '1.5',  letterSpacing: '0' },
    BodyLarge:      { size: '1.0625rem',weight:'400', lineHeight: '1.65', letterSpacing: '0' },
    Body:           { size: '1rem',    weight: '400', lineHeight: '1.6',  letterSpacing: '0' },
    Caption:        { size: '0.8125rem',weight:'400', lineHeight: '1.5',  letterSpacing: '0.01em' },
    Label:          { size: '0.75rem', weight: '600', lineHeight: '1.4',  letterSpacing: '0.06em', textTransform: 'uppercase' }
  }
};

module.exports = TYPOGRAPHY;
