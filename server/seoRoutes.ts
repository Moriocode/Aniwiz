import type { IncomingMessage, ServerResponse } from 'node:http';

import { buildAnimeSlugMap, animeEpisodePath, animePath } from '../src/utils/slug.ts';

/**
 * SEO routes shared by every runtime:
 *
 *   GET /sitemap.xml  — live catalogue + episode URLs
 *   GET /robots.txt   — allow-all policy with the absolute sitemap URL
 *
 * The routes are generated instead of checked in because the sitemap's <loc>
 * values have to be absolute and must match the origin the site is actually
 * served from. Deriving the origin from the request (with SITE_URL as an
 * override) means the same code is correct on localhost, a Vercel preview and
 * production, with no placeholder domain to remember to replace.
 *
 * Mounted by vite.config.ts for `vite dev` / `vite preview` and by api/seo.ts
 * (see vercel.json) in production.
 */

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const UPSTREAM_TIMEOUT_MS = 9000;
const CATALOG_TTL_MS = 30 * 60 * 1000;
const MAX_EPISODES_PER_TITLE = 100;

/** Mirrors the catalogue order in AniListProvider.fetchBrowse(). */
const CATALOG_QUERY = `
  query {
    trending: Page(page: 1, perPage: 50) {
      media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { id title { romaji english } episodes }
    }
    popular: Page(page: 1, perPage: 50) {
      media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) { id title { romaji english } episodes }
    }
    topRated: Page(page: 1, perPage: 50) {
      media(sort: SCORE_DESC, type: ANIME, isAdult: false) { id title { romaji english } episodes }
    }
  }
`;

interface CatalogueEntry {
  id: string;
  title: string;
  episodes: number;
}

interface CatalogueCache {
  at: number;
  items: CatalogueEntry[];
}

let catalogueCache: CatalogueCache | null = null;
let inFlight: Promise<CatalogueEntry[]> | null = null;

export type SeoNext = (err?: unknown) => void;
export type SeoMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: SeoNext
) => void;

async function fetchCatalogue(): Promise<CatalogueEntry[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: CATALOG_QUERY }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AniList responded ${response.status}`);

    const payload: any = await response.json();
    const lists: any[][] = [
      payload?.data?.trending?.media || [],
      payload?.data?.popular?.media || [],
      payload?.data?.topRated?.media || [],
    ];

    const seen = new Set<string>();
    const items: CatalogueEntry[] = [];
    for (const list of lists) {
      for (const media of list) {
        if (!media?.id || seen.has(String(media.id))) continue;
        seen.add(String(media.id));
        items.push({
          id: String(media.id),
          title: media.title?.english || media.title?.romaji || 'Unknown Anime',
          episodes: Math.max(0, Math.min(Number(media.episodes) || 0, MAX_EPISODES_PER_TITLE)),
        });
      }
    }

    if (items.length === 0) throw new Error('AniList returned an empty catalogue');
    return items;
  } finally {
    clearTimeout(timer);
  }
}

/** Cached catalogue; concurrent cold requests share one upstream call. */
async function getCatalogue(): Promise<CatalogueEntry[]> {
  if (catalogueCache && Date.now() - catalogueCache.at < CATALOG_TTL_MS) {
    return catalogueCache.items;
  }
  if (!inFlight) {
    inFlight = fetchCatalogue()
      .then((items) => {
        catalogueCache = { at: Date.now(), items };
        return items;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveOrigin(req: IncomingMessage): string {
  // Explicit override wins; otherwise use the deployment's own domain (Vercel
  // exposes it even when a proxy rewrites the incoming Host header).
  const configured = [
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ]
    .map((value) => (value || '').trim())
    .find(Boolean);
  if (configured) return configured.replace(/\/+$/, '');

  const rawHost = String(
    req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000'
  ).split(',')[0].trim();
  const host = /^[a-z0-9.-]+(:\d+)?$/i.test(rawHost) ? rawHost : 'localhost:3000';

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  const proto = forwardedProto === 'http' || forwardedProto === 'https'
    ? forwardedProto
    : isLocal
      ? 'http'
      : 'https';

  return `${proto}://${host}`;
}

/** Build the sitemap; exported for tests and snapshot scripts. */
export function buildSitemapXml(items: CatalogueEntry[], origin: string): string {
  const base = origin.replace(/\/+$/, '');
  const slugMap = buildAnimeSlugMap(items);
  const urls: string[] = [`${base}/`];

  for (const item of items) {
    const slug = slugMap.get(item.id);
    if (!slug) continue;
    urls.push(`${base}${animePath(slug)}`);
    for (let episode = 1; episode <= item.episodes; episode += 1) {
      urls.push(`${base}${animeEpisodePath(slug, episode)}`);
    }
  }

  const body = urls
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
    '',
  ].join('\n');
}

function send(res: ServerResponse, status: number, type: string, body: string, cache = 'public, max-age=1800, s-maxage=3600'): void {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cache);
  res.end(body);
}

/** Handles /sitemap.xml and /robots.txt, otherwise calls next(). */
export const seoMiddleware: SeoMiddleware = (req, res, next) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const file = url.searchParams.get('file');
  const pathname = url.pathname.replace(/\/+$/, '');

  const wantsSitemap = file === 'sitemap' || pathname === '/sitemap.xml' || pathname === '/sitemap';
  const wantsRobots = file === 'robots' || pathname === '/robots.txt' || pathname === '/robots';
  if (!wantsSitemap && !wantsRobots) {
    next();
    return;
  }

  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end('Method Not Allowed');
    return;
  }

  const origin = resolveOrigin(req);

  if (wantsRobots) {
    const body = [
      'User-agent: *',
      'Allow: /',
      '',
      '# Full URLs for every series and episode are listed in the sitemap.',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n');
    send(res, 200, 'text/plain; charset=utf-8', body);
    return;
  }

  getCatalogue()
    .then((items) => {
      send(res, 200, 'application/xml; charset=utf-8', buildSitemapXml(items, origin));
    })
    .catch((error) => {
      console.error('[seo] sitemap generation failed:', error);
      // A stale-but-valid catalogue is better than telling crawlers the site is gone.
      if (catalogueCache?.items.length) {
        send(res, 200, 'application/xml; charset=utf-8', buildSitemapXml(catalogueCache.items, origin));
        return;
      }
      res.setHeader('Retry-After', '600');
      send(res, 503, 'text/plain; charset=utf-8', 'Sitemap temporarily unavailable', 'no-store');
    });
};
