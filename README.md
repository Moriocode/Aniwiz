# Aniwiz — AniStream

A dark-themed anime streaming front-end: trending/spotlight catalog, instant
search, genre filters, per-title episode lists, a 5-server player with
auto-failover, weekly airing schedule and local watch history.

## Quick start

Requires Node.js 20.11+.

```bash
npm install
npm run dev          # http://localhost:3000
```

No API keys or `.env` file are needed — every `/api/...` route the app calls is
served locally by the middleware in `vite.config.ts`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000 (bound to `0.0.0.0`) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build (API middleware included) |
| `npm run lint` | TypeScript typecheck (`tsc --noEmit`) |
| `npm run test:smoke` | Browser end-to-end smoke test (needs a running dev/preview server) |
| `npm run verify` | typecheck + build |

The smoke test drives a real headless Chromium and asserts 19 behaviours: page
boots without uncaught errors, catalog renders, genre/search/reset filtering,
the hero "Anime Info" toggle, opening a title, distinct episode numbers,
episode switching, back-navigation, watch history and the schedule modal. It
writes screenshots to `artifacts/` and fails on same-origin API errors.

On a machine where you cannot install browser libraries system-wide, run once:

```bash
./scripts/setup-browser.sh
source scripts/browser-env.sh
npm run test:smoke
```

## How it fits together

```
index.html            UI markup + the app controller (inline ES module)
  └─ imports          src/services/api/index.ts
src/services/api      Provider registry + 6 anime providers
                        anilist · aniwixi · hianime · anivexa · anikoto · anime-api
                        (cascaded with automatic fallback — see providerRegistry)
                        imageQuality.ts upgrades poster URLs from the low-res
                        `hd-1` CDN rendition to the high-definition `hd-4` one
server/               Shared /api middleware (anipmApiHandler.ts) — mounted by
                      the Vite plugin (dev/preview) and by the Vercel function
api/                  Vercel serverless catch-all ([...path].ts) serving the
                      same /api routes in production (no env vars required)
vite.config.ts        Vite config + plugin mounting the shared API middleware
src/index.css         Tailwind v4 theme (brand/dark palette), compiled at build
```

Data flow: `index.html` → `animeService` → provider cascade → `/api/*`
(shared middleware: Vite dev/preview locally, the Vercel function in
production) → upstream sources (AniList GraphQL, AniWixi, …). The grid only
renders live provider data; if the whole chain fails the UI shows an honest
error state with a Retry action — there is no bundled placeholder catalog.

## Notes

- Streaming happens in an `<iframe>` pointed at third-party embed hosts, so a
  given episode can 404 upstream even when the app itself is healthy — the
  player's "Auto-Fallback" toggle walks the other servers automatically.
- The project was originally exported from Google AI Studio (`metadata.json` is
  that manifest). The original export zip lives in git history.
- If you have a RapidAPI key that was previously committed in this project,
  rotate it — committed keys should be treated as exposed.
