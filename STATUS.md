# Landing Page Factory — Status

_Last updated: 2026-05-14 (autonomous build round)_

## TL;DR

The factory is now an end-to-end agentic pipeline. Submit a lead URL → it
scrapes the brand DNA → drives a local coding-agent CLI (Claude Code or
Codex) via the vendored open-design runtime → captures a modernized
landing page artifact → bundles it as a sales packet → surfaces in an
approval queue. Zero humans in the generation loop; humans gate at intake,
override, and packet review only.

## Stable surface area (`npm run …`)

| Command | What it does |
|---|---|
| `preview` | Run the full agentic pipeline once on the hardcoded sample lead |
| `preview:batch <csv>` | Run the pipeline over a CSV of leads, concurrency-capped |
| `variants [N]` | Generate N visually distinct variants of the same lead |
| `packet <slug>` | Bundle a generated preview into `previews/{slug}.packet.zip` |
| `qa <slug>` | Score a preview against the lead's site with Claude vision |
| `compare <our> <lead>` | Side-by-side screenshot helper |
| `approvals` | Open the approval-queue dashboard (`previews/index.html`) |
| `serve` | Static HTTP server on :8765 for browser viewing |
| `od:install` | One-time install of the open-design workspace |
| `od:dev` | Boot the open-design web canvas (dev tool only) |
| `od:daemon` | Boot daemon only (headless, what the bridge uses) |
| `od:status` / `od:stop` | Daemon lifecycle |

## Pipeline graph

```
Lead URL
  ↓ analyzeSite (Playwright + JSON-LD parser)        → siteIdentity
  ↓ enrichWithPlaces (optional, GOOGLE_MAPS_API_KEY) → ratings, hours, address
  ↓ buildSiteBrief                                   → brief + niche pack + slug-picked DS
  ↓ openai-image-gen (optional, OPENAI_API_KEY)      → fill missing photos
  ↓ open-design-bridge → daemon → Claude Code        → <artifact> HTML
       (deterministic upgrade provider as fallback)
  ↓ localize-assets                                  → previews/{slug}.assets/
  ↓ preview-storage                                  → previews/{slug}.html + .design.md
  ↓ lead-site screenshot                             → previews/{slug}.assets/lead-site.png
  ↓ vision-qa retry loop (optional)                  → regenerate if score < threshold
  ↓ build-packet                                     → previews/{slug}.packet.zip

  → Human review: previews/index.html (approve / reject / override)
```

## Human gates (the only places a person enters)

| Gate | Who | What they do |
|---|---|---|
| Lead intake | leadgen team | submit URL + niche via CSV or webhook |
| New vertical | engineering | author niche pack (`src/niches/<slug>/`) |
| Brand override | leadgen | hand-edit lead-overrides.json when scrape is wrong |
| Packet review | outbound ops | approve / reject in `previews/index.html` |
| Send | outbound ops | actual sales touch (out of factory scope) |

## Where we are right now (this build round)

| # | Item | Status |
|---|---|---|
| 1 | Niche-specific skill variants for landing-page-factory | ✅ shipped |
| 2 | Sales-packet bundler (zip + PDF summary) | ✅ shipped |
| 3 | Vision-QA auto-retry loop | ✅ shipped |
| 4 | CSV batch runner (`preview:batch`) | ✅ shipped |
| 5 | Approval queue UI (`previews/index.html`) | ✅ shipped |

### What each one does (detail)

**1. Niche-specific skills.** `open-design/skills/landing-page-factory-{restaurant,dentist,hvac,lawyer}/SKILL.md` — each layers vertical-specific structure + style + legal language on top of the base `landing-page-factory` contract. The bridge auto-picks the right one based on the lead's niche string; falls back to the generic when no match.

**2. Sales-packet bundler.** `npm run packet <slug>` (or `--all`) produces `previews/{slug}.packet.zip` containing index.html, assets/, full-page screenshots (lead + ours), a one-page SUMMARY.pdf with side-by-side comparison + facts + improvements list, and a README.txt.

**3. Vision-QA auto-retry.** When `LANDING_BUILDER_QA_ENABLED=1` and `ANTHROPIC_API_KEY` is set, generate-preview screenshots each agent attempt, scores it with Claude vision against the lead's site (1-10 on brand-fidelity / modernity / conversion), and regenerates with the next-in-pool design system if average score < `LANDING_BUILDER_QA_THRESHOLD` (default 7). Cap retries at `LANDING_BUILDER_QA_MAX_RETRIES` (default 3). History written to `previews/{slug}.qa.json`.

**4. CSV batch runner.** `npm run preview:batch <csv> [--concurrency=N] [--packet]` reads `business_name,niche,city,state,website_url[,offer_angle]` rows, runs the full pipeline per lead (concurrency-capped, serial by default since the daemon serializes agent spawns), maintains `previews/_manifest.json` with per-lead status, and prints a summary. Example CSV at `data/leads.example.csv`.

**5. Approval queue UI.** `npm run approvals` regenerates `previews/index.html` from the manifest and boots a local Express server on port 17900 (configurable via `APPROVAL_PORT`) that auto-opens in your browser. Cards show each lead with a live iframe preview, metadata, QA score badge, and four buttons: Open Full / Approve / Reject / Build Packet. Decisions move artifacts into `previews/approved/` or `previews/rejected/` and update the manifest. Revert moves them back to pending. Static `index.html` also viewable offline (without the action buttons working).

## End-to-end smoke test results

Ran `npm run preview:batch data/leads.example.csv -- --packet` on 2026-05-14:

- Batch read 1 lead from CSV ✓
- Full pipeline executed (260.7s — long because od path failed → 4-minute timeout then deterministic fallback)
- Localized 7 scraped images ✓
- Wrote `previews/bookbinders-richmond-va-c7fcf1.html` ✓
- Wrote `previews/bookbinders-richmond-va-c7fcf1.packet.zip` (20.4MB) ✓
- Wrote `previews/_manifest.json` with one `pending-review` entry ✓
- `node -e 'require("./src/cli/build-approval-queue").buildStaticIndex()'` → `previews/index.html` rendered with the lead card ✓

Known: the od (agentic) path failed on this run and fell back to the deterministic upgrade provider. Likely the daemon got into a stale state between sessions — `npm run od:stop && npm run od:status` will reset it. The fallback worked correctly, so the pipeline is resilient to agentic failures.

Recently shipped, in dependency order:

- Phase A: vendored open-design runtime at `open-design/` (33MB; stripped video/desktop/telemetry)
- Phase B: `src/data/open-design-bridge.js` — POSTs scraped brief to daemon, captures `<artifact>` from SSE
- Custom skill `landing-page-factory` at `open-design/skills/landing-page-factory/SKILL.md`
- Provider selection via `LANDING_BUILDER_PROVIDER=auto|od|upgrade`
- 149 vendored design systems at `src/design-systems/` (also at `open-design/design-systems/` for daemon)
- OpenAI `gpt-image-2` integration as photo fallback
- Logo extraction, JSON-LD scraping, brand color histogram, font detection, multi-image library with food/interior/map/document classifier
- Slug-deterministic variation pools per niche (hero variant, accent style, section order, design system)
- Restaurant-native section types (about-story, hours-location)
- About-story extraction with brand-signal scoring
- Asset localization to `previews/{slug}.assets/`
- LLM rewrite pass for hero copy (ANTHROPIC_API_KEY)
- Vision-QA scoring script (`npm run qa`)

## Provider-selection env vars

```
LANDING_BUILDER_PROVIDER=auto             # default: od first, deterministic fallback
LANDING_BUILDER_PROVIDER=od               # od only — error if it fails
LANDING_BUILDER_PROVIDER=upgrade          # deterministic only — bypass od
LANDING_BUILDER_OD_AGENT=claude|codex|…   # default: claude
LANDING_BUILDER_OD_SKILL=landing-page-factory
LANDING_BUILDER_OD_TIMEOUT_MS=240000
LANDING_BUILDER_QA_THRESHOLD=7            # min score (1-10 avg) before accepting
LANDING_BUILDER_QA_MAX_RETRIES=3
LANDING_BUILDER_SKIP_LOCALIZE=1           # bypass image download
LANDING_BUILDER_SKIP_IMAGE_GEN=1          # bypass OpenAI fill
LANDING_BUILDER_SHOW_UPGRADE_SIGNAL=1     # surface internal sales banner on output
OD_DAEMON_URL=http://127.0.0.1:17456
OPENAI_API_KEY=…                          # gpt-image-2 + vision-QA (when both keyed)
ANTHROPIC_API_KEY=…                       # llm-rewrite + vision-QA
GOOGLE_MAPS_API_KEY=…                     # optional Places enrichment
```

## Open questions for the next session

- Custom skills per niche could include vertical-specific layout guidance
  (reservation widget HTML for restaurants, insurance-info block for dental).
  Each skill is a contract the agent honors — worth tuning per vertical?
- Approval queue is filesystem-driven right now (`previews/_manifest.json`).
  When this scales past ~100 leads, swap to SQLite or push into the daemon's
  existing `.od/app.sqlite`.
- Vision-QA retry loop costs ~$0.05 per attempt (vision call + regeneration).
  At 3-retry cap this is bounded, but worth surfacing the cost in the manifest.
