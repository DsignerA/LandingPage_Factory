Landing Builder Factory

An automated niche-aware landing page and outreach generation system.

Landing Builder Factory discovers local business leads, audits their websites, generates personalized landing page previews, and produces outreach-ready sales packets using a deterministic design + rendering pipeline.

The system is designed for:

* lead generation agencies
* local business outreach
* cold email campaigns
* white-label preview generation
* automated website upgrade funnels

⸻

Core Idea

Instead of generating generic AI websites, Landing Builder Factory:

1. Finds real businesses
2. Audits their current website
3. Detects weaknesses and missing conversion systems
4. Builds a niche-aware replacement landing page
5. Generates outreach packets explaining the opportunity

The result is a scalable “website upgrade factory” for agencies and growth systems.

⸻

Features

Lead Discovery

* Google Places lead sourcing
* niche-aware discovery
* Google Ads detection
* website analysis
* lead ranking and scoring

Website Auditing

* homepage signal analysis
* conversion weakness scoring
* trust/proof detection
* CTA analysis
* mobile and UX heuristics

Design Intelligence

* palette systems
* typography systems
* motion systems
* intent-driven layouts
* niche-aware design rules
* scene composition pipeline

Landing Page Generation

* deterministic page generation
* responsive layouts
* Vue3 component rendering
* Tailwind-based styling
* strategy overlays
* conversion-focused section ordering

Outreach Automation

* personalized outreach packets
* email subjects/openers
* CRM-ready exports
* weakness summaries
* strategy summaries

Factory Pipeline

* queue-based pipeline
* stage workers
* artifact storage
* tier-gated processing
* screenshot generation
* outreach generation

⸻

Supported Niches

Current niche packs:

* Dentist
* HVAC
* Lawyer
* Generic fallback

Additional niches can be added by creating:

* config.js
* copy.js
* proof.js
* intents.js
* variants.js

inside src/niches/{niche}.

⸻

DESIGN.md Integration

The factory describes its design decisions using the [DESIGN.md format](https://github.com/google-labs-code/design.md).
This is a description / QA layer — it does not change the rendered UI.

What it gives us:

* `src/niches/{niche}/DESIGN.md` documents the canonical visual identity for each niche pack
* every generated preview emits a sibling `{slug}.design.md` describing the design profile that produced it
* the render pipeline lints each per-page DESIGN.md and flags broken refs, contrast failures, or orphaned tokens as `design_needs_review`
* CI diffs niche DESIGN.md files between PRs to catch unintended design drift
* `agents/prompts/design_director.txt` embeds the live spec so the LLM emits valid DESIGN.md output

Scripts:

```bash
npm run design:lint <file.md>       # lint a single DESIGN.md
npm run design:build-niches         # regenerate niche DESIGN.md files
npm run design:check-niches         # CI: fail if niche files are stale
npm run design:diff                 # diff niche DESIGN.md vs origin/main
npm run design:build-prompt         # regenerate the agent prompt from the spec
npm run design:check-prompt         # CI: fail if prompt is stale
npm run test:design-md              # round-trip: serializer → linter
```

Direct CLI access (via the package):

```bash
npx @google/design.md spec
npx @google/design.md export --format css-tailwind src/niches/dentist/DESIGN.md
```

⸻

Architecture Overview
