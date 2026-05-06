'use strict';

// src/design/motion.js
// Motion profile definitions for the design token system.
// Each profile defines CSS animation values and JavaScript behavior flags.
// Motion is injected into the HTML shell by the render engine.
//
// Profiles: static | calm_interactive | expressive

const MOTION = {

  // No animations — professional services, print-like pages
  static: {
    enableScrollReveal: false,
    enableCardStagger: false,
    enableHoverElevation: false,
    enableSmoothScroll: true,
    transitionDuration: '0ms',
    transitionEasing: 'linear',
    revealTranslateY: '0px',
    revealDuration: '0ms',
    staggerDelay: '0ms',
    hoverTranslateY: '0px',
    hoverShadowMultiplier: 1
  },

  // Subtle, polished — healthcare, B2B SaaS, most pages
  calm_interactive: {
    enableScrollReveal: true,
    enableCardStagger: true,
    enableHoverElevation: true,
    enableSmoothScroll: true,
    transitionDuration: '200ms',
    transitionEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    revealTranslateY: '20px',
    revealDuration: '600ms',
    revealEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    staggerDelay: '80ms',
    hoverTranslateY: '-3px',
    hoverShadowMultiplier: 1.5
  },

  // More pronounced — ecommerce, restaurant, expressive brands
  expressive: {
    enableScrollReveal: true,
    enableCardStagger: true,
    enableHoverElevation: true,
    enableSmoothScroll: true,
    transitionDuration: '250ms',
    transitionEasing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    revealTranslateY: '32px',
    revealDuration: '700ms',
    revealEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    staggerDelay: '100ms',
    hoverTranslateY: '-5px',
    hoverShadowMultiplier: 2
  }
};

module.exports = MOTION;
