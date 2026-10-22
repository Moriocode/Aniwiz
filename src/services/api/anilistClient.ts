import { AnimeItem } from './types';

/**
 * Shared AniList client.
 *
 * AniList's public GraphQL endpoint sends `Access-Control-Allow-Origin: *`, so
 * the browser can query it directly. That matters because the site is also
 * served from static hosts (GitHub ZIP / Android editors) where the local
 * `/api/...` middleware does not exist: direct requests keep the catalogue,
 * search and artwork working there.
 *
 * The local proxy is still tried afterwards, because it adds a short-lived
 * cache and can reach AniList from networks that block the browser's request.
 * Whichever path answers first with usable data wins; both return the same
 * media selection (the proxy's queries mirror `ANILIST_MEDIA_FIELDS`).
 */

const DIRECT_ENDPOINT = 'https://graphql.anilist.co';
const DIRECT_TIMEOUT_MS = 7000;
const PROXY_TIMEOUT_MS = 9000;

/**
 * Every catalogue/search/details query selects these fields, so a title shows
 * its poster, score, type, episode count, runtime, status and studio instead of
 * the "—" placeholders an incomplete selection produced.
 */
export const ANILIST_MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { extraLarge large medium color }
  bannerImage
  description
  episodes
  duration
  status
  seasonYear
  season
  format
  averageScore
  genres
  studios(isMain: true) { nodes { name } }
`;

const TYPE_MAP: Record<string, AnimeItem['type']> = {
  TV: 'TV',
  TV_SHORT: 'TV',
  MOVIE: 'Movie',
  OVA: 'OVA',
  ONA: 'ONA',
  SPECIAL: 'Special',
};

const STATUS_MAP: Record<string, AnimeItem['status']> = {
  FINISHED: 'Completed',
  RELEASING: 'Ongoing',
  HIATUS: 'Ongoing',
  NOT_YET_RELEASED: 'Upcoming',
  CANCELLED: 'Completed',
};

/** Map one AniList media node onto the shared AnimeItem contract. */
export function mapAniListMedia(item: any, rank = 1): AnimeItem | null {
  if (!item || !item.id) return null;

  const english = item.title?.english;
  const romaji = item.title?.romaji;
  const format = String(item.format || '').toUpperCase();

  // Preserve the native Japanese title in its own field — CJK text renders as
  // tofu on systems without Japanese fonts, so it never becomes the main line.
  const altTitle = english && romaji && romaji !== english ? romaji : undefined;

  return {
    id: String(item.id),
    anilistId: item.id,
    slug: (english || romaji || 'anime').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: english || romaji || 'Unknown Anime',
    altTitle,
    japaneseTitle: item.title?.native,
    synopsis: (item.description || '').replace(/<[^>]*>?/gm, '').trim(),
    poster: item.coverImage?.extraLarge || item.coverImage?.large || item.coverImage?.medium || undefined,
    banner: item.bannerImage || undefined,
    // Real AniList values only — missing fields stay undefined (rendered "—").
    rating: item.averageScore ? parseFloat((item.averageScore / 10).toFixed(1)) : undefined,
    score: item.averageScore ? `${item.averageScore}%` : undefined,
    quality: 'HD',
    type: TYPE_MAP[format],
    duration: item.duration ? `${item.duration}m` : undefined,
    year: item.seasonYear || undefined,
    season: item.season || undefined,
    status: STATUS_MAP[String(item.status || '').toUpperCase()],
    genres: item.genres && item.genres.length > 0 ? item.genres : [],
    studios: item.studios?.nodes?.map((s: any) => s.name) || [],
    totalEpisodes: item.episodes || undefined,
    subEpisodes: item.episodes || undefined,
    dubEpisodes: item.dubEpisodes || undefined,
    rank,
    isTrending: true,
    isPopular: true,
  };
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run one GraphQL query against AniList.
 *
 * Direct request first (works on static hosting and avoids a shared proxy IP
 * being rate-limited), then the local proxy when `proxyUrl` is supplied. The
 * proxy path is a GET route, so its query is fixed server-side and must mirror
 * the caller's selection.
 */
export async function requestAniListData(
  query: string,
  variables?: Record<string, unknown>,
  proxyUrl?: string
): Promise<any | null> {
  const direct = await fetchJson(
    DIRECT_ENDPOINT,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    },
    DIRECT_TIMEOUT_MS
  );
  if (direct?.data && !(Array.isArray(direct.errors) && direct.errors.length > 0)) {
    return direct.data;
  }

  if (proxyUrl) {
    const proxied = await fetchJson(proxyUrl, { headers: { Accept: 'application/json' } }, PROXY_TIMEOUT_MS);
    if (proxied?.data) return proxied.data;
  }

  return null;
}

/**
 * Look up full AniList media records for a batch of AniList ids.
 *
 * Used to fill in artwork and metadata for providers whose listing payload is
 * sparse (AniWixi returns `poster: false` and no type/duration for many
 * titles). Returns a Map keyed by numeric AniList id.
 */
export async function fetchAniListMediaByIds(ids: number[]): Promise<Map<number, AnimeItem>> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))].slice(0, 50);
  const result = new Map<number, AnimeItem>();
  if (unique.length === 0) return result;

  const data = await requestAniListData(
    `query ($ids: [Int]) {
      Page(page: 1, perPage: 50) {
        media(id_in: $ids, type: ANIME, isAdult: false) { ${ANILIST_MEDIA_FIELDS} }
      }
    }`,
    { ids: unique },
    `/api/anilist/by-ids?ids=${unique.join(',')}`
  );

  const media = data?.Page?.media;
  if (Array.isArray(media)) {
    media.forEach((item: any) => {
      const mapped = mapAniListMedia(item);
      if (mapped?.anilistId) result.set(mapped.anilistId, mapped);
    });
  }
  return result;
}
