# Vendored Design Systems

The DESIGN.md files in subdirectories of `src/design-systems/` were vendored
from the [Open Design](https://github.com/nexu-io/open-design) project on
2026-05-14.

Each file is a prose design-system specification (palette, typography,
atmosphere, layout principles) authored by the Open Design contributors.
They are used here as both LLM-consumable design briefs and as a source of
programmatic palette presets parsed by `src/design-systems/parser.js`.

## License

Original work copyright the Open Design contributors,
licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

Each vendored DESIGN.md is unmodified from its upstream form. This NOTICE
satisfies Apache 2.0's attribution requirement.

For the unmodified upstream source, see:
- Repository: https://github.com/nexu-io/open-design
- License:    https://github.com/nexu-io/open-design/blob/main/LICENSE

## How they are used in this project

1. **Programmatic palette presets.** `parser.js` extracts the dominant hex
   colors and typography hints from each DESIGN.md and exposes them through
   `loadDesignSystem(name)`. Niche packs and individual leads can opt into a
   preset (e.g. `restaurant` + `claude-warm`, `lawyer` + `editorial-burgundy`)
   for additional aesthetic variation beyond the scraped brand DNA.

2. **LLM-consumable design briefs.** When the optional LLM rewrite pass runs
   (`ANTHROPIC_API_KEY` is set), the active design system's full DESIGN.md
   body is included in the prompt so the LLM emits copy whose voice matches
   the design aesthetic.

## Adding a new design system

Drop a `DESIGN.md` into a new subdirectory (e.g. `src/design-systems/my-brand/DESIGN.md`).
The parser will pick it up automatically. Follow the shape of the existing
files (`# Title`, `> Category:` line, prose sections, hex colors inline).
