// Agents: edit values only. Do not change the object shape unless explicitly asked.
// Components should own layout, classes, and behavior.
// This file is the safest place for automated page generation.
//
// Design keys and supported values (use only these unless instructed otherwise):
// - profile: 'dental_premium' | 'default'
// - theme: 'blue_clinical' | 'slate' | 'zinc' | 'emerald'
// - motionProfile: 'calm_interactive' | 'static' | 'expressive'
// - heroStyle: 'split' | 'centered'
// - featureStyle: 'cards' | 'icon_cards'
// - pricingStyle: 'highlighted_middle' | 'simple'
// - ctaStyle: 'glow_button' | 'solid'
// - backgroundEffect: 'mesh_gradient' | 'none'
// - density: 'spacious' | 'comfortable' | 'compact'

window.pageData = {
  schemaVersion: 1,
  design: {
    profile: "dental_premium",
    theme: "blue_clinical",
    motionProfile: "calm_interactive",
    heroStyle: "split",
    featureStyle: "cards",
    pricingStyle: "highlighted_middle",
    ctaStyle: "glow_button",
    backgroundEffect: "mesh_gradient",
    density: "spacious"
  },
  hero: {
    title: "Never Miss Another New Patient Call",
    subtitle: "OraCall answers 24/7, handles common questions, and helps dental offices capture more booked appointments without overwhelming the front desk.",
    primaryCta: { label: "Try the Demo", href: "#cta" },
    secondaryCta: { label: "See Pricing", href: "#pricing" },
    logos: []
  },
features: {
  heading: "Built for dental offices that want more booked patients",
    subheading: "See how modern call automation helps practices grow.",
  items: [
      { icon: "phone", title: "24/7 Answering", description: "Capture calls after hours and during busy front-desk moments." },
      { icon: "calendar", title: "Appointment Requests", description: "Help patients move toward scheduling without sending them to voicemail." },
      { icon: "shield", title: "Insurance & FAQ Help", description: "Answer common questions around office hours, insurance, and services." }
    ]
    },
  pricing: {
    defaultCycle: "monthly",
    plans: [
      {
        id: "starter",
        name: "Starter",
        price: { monthly: "$297", yearly: "$2,970" },
        features: ["Basic call capture", "Common dental FAQs", "Email summaries"],
        cta: { label: "Choose Starter", href: "#cta" }
      },
      {
        id: "growth",
        name: "Growth",
        price: { monthly: "$497", yearly: "$4,970" },
        features: ["Everything in Starter", "Stronger scheduling flow", "After-hours lead capture", "Priority support"],
        cta: { label: "Choose Growth", href: "#cta" },
        popular: true
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: { monthly: "Custom", yearly: "Custom" },
        features: ["Custom scripting", "Advanced integrations", "White-glove setup"],
        cta: { label: "Talk to Sales", href: "#cta" }
      }
    ]
  },
  cta: {
    heading: "Hear how OraCall handles patient calls",
    subheading: "See how your practice can capture more opportunities without adding front-desk pressure.",
    primaryCta: { label: "Try the Live Demo", href: "#" }
  }
}

