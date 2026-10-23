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
| `npm run test:seo` | Routes, per-page meta, sitemap and robots checks (needs a running server) |
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
src/services/api      Provider registry + 4 live providers
                        anilist · anipulse · aniwixi · openanime
                        (cascaded with automatic fallback — see providerRegistry)
                        anilistClient.ts / aniwixiClient.ts query the public APIs
                        directly (both send CORS headers) and fall back to the
                        local proxy, so the catalogue also works on a static
                        host and when the proxy is rate-limited
                        imageQuality.ts upgrades poster URLs from the low-res
                        `hd-1` CDN rendition to the high-definition `hd-4` one
server/               Shared /api middleware (anipmApiHandler.ts) — mounted by
                      the Vite plugin (dev/preview) and by the Vercel function
api/                  Vercel serverless catch-all ([...path].ts) serving the
                      same /api routes in production (no env vars required)
vite.config.ts        Vite config + plugin mounting the shared API middleware
src/index.css         Tailwind v4 theme (brand/dark palette), compiled at build
```

## Home layout

The home page is sectioned rather than one endless grid:

- the catalogue grid renders the whole filtered catalogue at once (the count
  badge reads "Showing all releases"); every filter change re-renders it
- below it sit a **Trending Anime** rail and a **New Anime** rail (12 cards
  each; the New rail sorts by the newest reported year and never repeats a
  title already on the Trending rail)
- each rail card is a bare `<a href="/anime/...">` so crawlers can discover
  more of the catalogue from the home page; the rails hide while a search or
  genre/tab filter is active

## Optional self-hosted Allanime source

One slot in the streaming cascade is the self-hosted [Allanime
API](https://github.com/mdtahseen7/Allanime-api) (search, details, episode
lists and a direct media URL per episode). Point the same-origin
`/api/allanime/*` proxy at an instance with `ALLANIME_API_BASE` (default
`http://127.0.0.1:5678`, that repository's own default port). When an
instance answers, the server picker gains **Server 5: Allanime (Direct)** and
its results join the search cascade; playback resolves per episode and plays
through the same-origin Range proxy (direct files) or hls.js (playlists).
With no instance running the proxy answers an honest 504, the probe keeps the
button out of the picker and the cascade skips the source — the default
four-server setup is unchanged.

Note: that project's episode-URL extraction currently fails upstream
(its own scraper log reports `AA_CRYPTO_MISSING` after allanime.day changed
its API); search and episode lists still work, and a failed extract just
fails over to the next server.

## Routes, SEO and crawlers

Two crawlable routes exist, both handled by the client router in `index.html`
(`history.pushState` is enough here because the app is a single document):

```
/anime/:slug                     e.g. /anime/cyberpunk-edgerunners-2
/anime/:slug/episode/:number     e.g. /anime/cyberpunk-edgerunners-2/episode/2
```

Cards, episode rows, search suggestions, history/My List entries and the
Prev/Next controls are real `<a href>` elements, so they can be opened in a new
tab and followed without JavaScript. A deep link (typed URL, refresh, Back,
Forward, shared link) resolves the slug against the live catalogue, falling
back to a provider search for titles outside the current 130-item page, then
opens that exact episode. Unknown slugs replace the URL with `/`.

`src/utils/slug.ts` is the single source of truth for slugs and paths. Both the
router and the sitemap route use it, so links on the page and `<loc>` entries
cannot drift apart.

Every route change updates the document title, meta description, robots
directive, canonical link, Open Graph/Twitter tags and a JSON-LD block
(`TVSeries` for a title, `TVEpisode` for an episode) in `index.html`.

`/sitemap.xml` and `/robots.txt` are generated on request by
`server/seoRoutes.ts` (mounted by `vite.config.ts` and by `api/seo.ts`). The
sitemap lists the home page, every catalogue title and its declared episodes
using the request's origin, so it needs no hardcoded domain. `SITE_URL` can
override the origin; on Vercel the deployment domain is detected from
`VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`. `vercel.json` rewrites those two
document paths to that function and sends `/anime/...` to `index.html`.

Limitation: the meta tags are applied by client-side JavaScript after the
catalogue loads. Googlebot renders JS and follows the sitemap, but link
preview bots and other non-JS crawlers only see the generic document head. For
fully server-rendered per-title HTML, add a prerender/SSR step in front of the
same routes — the URL and metadata contract above stays unchanged.

Data flow: `index.html` → `animeService` → provider cascade → upstream sources
(AniList GraphQL, AniWixi, …), with `/api/*` (shared middleware: Vite
dev/preview locally, the Vercel function in production) as the cached fallback
path. The catalogue merges AniList's trending, popular and top-rated lists
(~130 titles), and titles whose upstream listing omits artwork/metadata are
enriched from their AniList id so cards show a poster, score, type, runtime and
studio instead of "—" placeholders. The grid only renders live provider data;
if the whole chain fails the UI shows an honest error state with a Retry action
— there is no bundled placeholder catalog.

## Notes

- Streaming happens in an `<iframe>` pointed at third-party embed hosts, so a
  given episode can 404 upstream even when the app itself is healthy — the
  player's "Auto-Fallback" toggle walks the other servers automatically.
- The project was originally exported from Google AI Studio (`metadata.json` is
  that manifest). The original export zip lives in git history.
- If you have a RapidAPI key that was previously committed in this project,
  rotate it — committed keys should be treated as exposed.
