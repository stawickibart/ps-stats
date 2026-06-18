# Architecture and runtime notes

## Runtime model

This app is intentionally a static browser app. It has no backend service, database, or authentication layer.

- UI: React + TypeScript + Vite
- Persistence: browser `localStorage`
- Video: YouTube iframe API
- Exports: browser-generated CSV files
- Hosting: GitHub Pages via GitHub Actions

Because storage is local to the browser, data is not shared between devices or users. Clearing browser storage removes local match history, knowledge-base records, edited stat definitions, edited play definitions, seeded-data edits, and saved rosters.

## Main data concepts

The current data model lives primarily in `src/App.tsx` and `src/stats.ts`.

- `MatchState`: active match setup, roster, video sync, current rater workflow state, local knowledge base, and event log.
- `StatDefinition`: editable stat metadata shown in settings and used to convert events into stat entries.
- `StatEvent`: normalized event log record. All event-form submissions ultimately create one or more `StatEvent` records.
- `PossessionSegment`: interval data for home possession, away possession, contested possession, and out-of-play time.
- `GameSnapshot`: frozen finished-game record stored in the local knowledge base.
- `TeamKnowledge` / `PlayerKnowledge`: local rollups generated from finished games.

## Why there is no database yet

The current product is optimized for quick single-rater use and easy GitHub Pages deployment. A backend should be added when the app needs:

- shared knowledge base across raters
- multi-device continuity
- user accounts or permissions
- audit-safe storage
- collaboration on the same game
- importing/exporting team databases at scale

Likely future backend options include Supabase, Firebase, or a small API with Postgres.

## Deployment

The workflow at `.github/workflows/deploy-pages.yml` builds and deploys the static app on pushes to `main`.

The GitHub Pages workflow uses:

- `npm ci`
- `npm test`
- `npm run build`
- `actions/upload-pages-artifact`
- `actions/deploy-pages`

Vite is configured with `base: "./"` so built assets work from a GitHub Pages subpath.

## Testing

Current tests focus on pure helper behavior:

- YouTube ID parsing
- clock parsing
- match-time derivation
- CSV escaping
- stat defaults and exclusions

Run:

```bash
npm test
```

Build verification:

```bash
npm run build
```

## Known implementation tradeoffs

- Seeded fake games are generated in-browser and are intended only to make admin views useful on first load.
- Quality scores are heuristic and directional, not official ratings.
- Role selection is UI-only. There is no profile, auth, or permission enforcement.
- The rater event form creates one or more stat records rather than storing a separate high-level event object. This keeps exports simple but means grouped event reconstruction depends on shared timestamp/note metadata.
