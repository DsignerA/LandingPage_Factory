# Vendored: Open Design

This entire `open-design/` directory was vendored from
[nexu-io/open-design](https://github.com/nexu-io/open-design) on 2026-05-14.

## License

The vendored code is © the Open Design contributors and licensed under the
[Apache License, Version 2.0](./LICENSE).

## What was stripped

The original repository ships across web, desktop, packaged, telemetry, and
video/audio generation surfaces. For this project's headless landing-page
factory use case, the following were removed before vendoring:

- `apps/desktop`             — Electron shell (we don't ship a desktop app)
- `apps/landing-page`        — their marketing site
- `apps/packaged`            — Electron packaging entry
- `apps/telemetry-worker`    — PostHog telemetry forwarder
- `tools/pack`               — desktop release packager (mac/win/linux)
- `prompt-templates/video`   — video generation prompts
- `skills/` (video / audio): `sora`, `fal-kling-o3`, `fal-lip-sync`,
  `fal-realtime`, `fal-video-edit`, `remotion`, `slack-gif-creator`,
  `stitch-loop`, `8-bit-orbit-video-template`, `swiss-user-research-video-template`,
  `venice-audio-music`, `venice-audio-speech`, `venice-video`,
  `video-downloader`, `youtube-clipper`, `gif-sticker-maker`, `ai-music-album`,
  `minimax-pdf`, `nanobanana-ppt`, `speech`

What remains: `apps/daemon` (Node + Express + SQLite), `apps/web` (Next.js
canvas), `packages/contracts|platform|sidecar|sidecar-proto`, `tools/dev`,
`tools/pr`, 89 web/design/image skills, `craft/`, `prompt-templates/image`,
`design-templates/`.

## How this project uses it

The parent project (`LandingPage_Factory`) is a CommonJS Node pipeline that
scrapes leads' websites and produces personalized landing-page previews. It
treats this vendored open-design as a *generation runtime*: the bridge in
`../src/data/open-design-bridge.js` (Phase B, in progress) composes the
scraper's brief + slug-picked design system + landing-page skill into
open-design's chat protocol, the daemon spawns whichever coding-agent CLI
is on `PATH` (Claude Code / Codex / Cursor / etc.), and the returned
artifact replaces our deterministic `upgrade` provider's HTML.

## Install + run

Standalone (matches upstream behavior):

```bash
cd open-design
pnpm install
pnpm tools-dev              # starts daemon + web canvas
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

From the project root, shortcuts in `../package.json`:

```bash
npm run od:install
npm run od:dev
```

## Upgrading the vendor

To pull upstream changes:

```bash
cd ../open-design-ref
git pull
cd ../LandingPage_Factory
# Re-run the vendor + strip pass; never edit files inside open-design/ directly.
```

Required directories the daemon expects at runtime (must be copied in addition
to `apps/`, `packages/`, `tools/`, etc.):

- `design-systems/` — scanned by `apps/daemon/src/design-systems.ts`. Without
  this directory the `/api/design-systems` endpoint returns an empty list and
  the canvas's design-system picker shows only "None — freeform".
- `skills/` — scanned by the skill registry.
- `craft/` — referenced by skills via `od.craft.requires`.
- `prompt-templates/image` — referenced by image-generation skills.
- `design-templates/` — referenced by the templates picker.

Any local diffs against upstream live in `../open-design-patches/` (Phase B
will add this when the bridge needs to teach the daemon a new chat shape).
