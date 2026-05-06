// data/page-example.js
// Example page schema usable by PageRenderer.
// AI-ready schemas:
// - hero section
//   {
//     id?: string,
//     type: 'hero',
//     props: {
//       title?: string,
//       subtitle?: string,
//       primaryCta?: { label?: string, href?: string },
//       secondaryCta?: { label?: string, href?: string },
//       logos?: Array<string | { src: string, alt?: string }>
//     }
//   }
// - features section
//   {
//     id?: string,
//     type: 'features',
//     props: {
//       heading?: string,
//       subheading?: string,
//       items?: Array<{ title: string, description: string, href?: string }>
//     }
//   }
// - pricing section
//   {
//     id?: string,
//     type: 'pricing',
//     props: {
//       defaultCycle?: 'monthly' | 'yearly',
//       pricingStyle?: 'highlighted_middle' | 'simple',
//       sectionPad?: string,
//       plans?: Array<{
//         name: string,
//         monthly?: number | string,
//         yearly?: number | string,
//         price?: { monthly?: number | string, yearly?: number | string },
//         features?: string[],
//         popular?: boolean,
//         cta?: { label?: string, href?: string }
//       }>
//     }
//   }

if (typeof window !== 'undefined') {
  window.pageSections = [
    {
      id: 'hero-1',
      type: 'hero',
      props: {
        title: 'AI Landing Builder',
        subtitle: 'Generate landing pages instantly with reusable sections.',
        primaryCta: { label: 'Get Started', href: '#pricing' },
        secondaryCta: { label: 'See Pricing', href: '#pricing' },
        logos: []
      }
    },
    {
      id: 'features-1',
      type: 'features',
      props: {
        heading: 'Everything you need',
        subheading: 'Composable sections that are easy to render and extend.',
        items: [
          { title: 'Reusable sections', description: 'Build once and reuse everywhere.' },
          { title: 'Schema-driven', description: 'Render pages from structured JSON.' },
          { title: 'AI-ready', description: 'Generate safe pages with predictable props.' }
        ]
      }
    },
    {
      id: 'pricing-1',
      type: 'pricing',
      props: {
        defaultCycle: 'monthly',
        pricingStyle: 'highlighted_middle',
        plans: [
          {
            name: 'Starter',
            monthly: 29,
            yearly: 290,
            features: ['1 site', 'Basic analytics', 'Email support'],
            cta: { label: 'Choose Starter', href: '#cta-starter' }
          },
          {
            name: 'Pro',
            popular: true,
            monthly: 79,
            yearly: 790,
            features: ['5 sites', 'Advanced analytics', 'Priority support'],
            cta: { label: 'Choose Pro', href: '#cta-pro' }
          },
          {
            name: 'Enterprise',
            monthly: 'Custom',
            yearly: 'Custom',
            features: ['Unlimited sites', 'Custom integrations', 'Dedicated support'],
            cta: { label: 'Contact Sales', href: '#contact-sales' }
          }
        ]
      }
    }
  ]
}
