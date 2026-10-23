/**
 * Allanime provider — self-hosted github.com/mdtahseen7/Allanime-api.
 *
 * That API exposes search, details, episode lists and a per-episode media URL
 * for Allanime's catalogue, but no spotlight/trending endpoints, so this
 * provider only contributes to search, details, episodes and stream
 * resolution; the catalogue rails stay owned by AniList & friends and the
 * empty-list methods let the cascade move on instantly.
 *
 * All traffic goes through the same-origin `/api/allanime/*` proxy in
 * `server/anipmApiHandler.ts` (upstream: `ALLANIME_API_BASE`, default
 * http://127.0.0.1:5678). With no instance running the proxy answers 504 and
 * every method here fails fast — the provider is inert by default, exactly
 * like the optional OpenAnime instance.
 *
 * Ids this provider mints are prefixed `allanime:` so the service can tell
 * them apart from AniList's numeric ids (digits scraped out of an opaque
 * Allanime id would otherwise resolve to a random AniList title).
 */

import type { IAnimeProvider, AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode } from '../types';

const BASE_PATH = '/api/allanime';
const ID_PREFIX = 'allanime:';
const FETCH_TIMEOUT_MS = 8000;
const EPISODE_CACHE_TTL_MS = 10 * 60 * 1000;
const SHOW_ID_CACHE_TTL_MS = 30 * 60 * 1000;

async function requestAllanime<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_PATH}${path}`, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Map one Allanime show object (search or details) onto AnimeItem. */
function mapShow(raw: any): AnimeItem | null {
  if (!raw?.id || !raw?.title) return null;
  const poster = typeof raw.thumbnail_url === 'string' && /^https?:\/\//.test(raw.thumbnail_url)
    ? raw.thumbnail_url
    : undefined;
  const statusText = String(raw.status || '').toLowerCase();
  return {
    id: `${ID_PREFIX}${raw.id}`,
    title: String(raw.title),
    synopsis: typeof raw.synopsis === 'string' ? raw.synopsis : '',
    poster,
    quality: 'HD',
    status: statusText.includes('air') ? 'Ongoing' : statusText.includes('finish') || statusText.includes('complete') ? 'Completed' : undefined,
    studios: [],
    totalEpisodes: Number(raw.episodes_sub) || undefined,
    subEpisodes: Number(raw.episodes_sub) || undefined,
    dubEpisodes: Number(raw.episodes_dub) || undefined,
  };
}

export class AllanimeProvider implements IAnimeProvider {
  readonly id = 'allanime';
  readonly name = 'Allanime (self-hosted)';
  readonly version = '1.0.0';
  readonly website = 'https://github.com/mdtahseen7/Allanime-api';

  private episodeCache = new Map<string, { at: number; episodes: AnimeEpisode[] }>();
  private showIdByTitle = new Map<string, { at: number; id: string }>();

  /** No catalogue endpoints upstream — empty results move the cascade on. */
  async getSpotlight(): Promise<AnimeItem[]> { return []; }
  async getTrending(): Promise<AnimeItem[]> { return []; }
  async getTopAiring(): Promise<AnimeItem[]> { return []; }
  async getLatestEpisodes(): Promise<AnimeItem[]> { return []; }

  async search(query: string, _page = 1): Promise<{ results: AnimeItem[]; total: number }> {
    const raw = await requestAllanime<any[]>(`/search?query=${encodeURIComponent(query)}`);
    const results = (Array.isArray(raw) ? raw : [])
      .map(mapShow)
      .filter((item): item is AnimeItem => item !== null);
    return { results, total: results.length };
  }

  async getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster?: string; rating?: number }>> {
    const { results } = await this.search(query);
    return results.slice(0, 6).map((item) => ({ id: item.id, title: item.title, poster: item.poster }));
  }

  /** Only ids this provider minted (allanime:…) can resolve details. */
  async getAnimeDetails(id: string): Promise<AnimeItem | null> {
    if (!id.startsWith(ID_PREFIX)) return null;
    const rawId = id.slice(ID_PREFIX.length);
    const raw = await requestAllanime<any>(`/anime/${encodeURIComponent(rawId)}`);
    const item = mapShow(raw);
    if (!item) {
      // Search-only ids still deserve a details pass: the upstream /anime
      // route may not know them while /search does.
      return null;
    }
    return item;
  }

  /** Real episode numbers from the upstream (supports halves like 2.5). */
  async getEpisodes(id: string): Promise<AnimeEpisode[]> {
    if (!id.startsWith(ID_PREFIX)) return [];
    const rawId = id.slice(ID_PREFIX.length);

    const cached = this.episodeCache.get(rawId);
    if (cached && Date.now() - cached.at < EPISODE_CACHE_TTL_MS) return cached.episodes;

    const json = await requestAllanime<any>(`/episodes/${encodeURIComponent(rawId)}?mode=sub`);
    const numbers = (Array.isArray(json?.episodes) ? json.episodes : [])
      .map((value: any) => Number(value))
      .filter((n: number) => Number.isFinite(n) && n > 0)
      .sort((a: number, b: number) => a - b);

    const episodes: AnimeEpisode[] = numbers.map((n: number) => ({
      id: `${ID_PREFIX}${rawId}:${n}`,
      number: n,
      title: `Episode ${n}`,
      isFiller: false,
    }));
    this.episodeCache.set(rawId, { at: Date.now(), episodes });
    return episodes;
  }

  /** The server picker is owned by animeService — nothing to contribute. */
  async getServers(): Promise<{ sub: StreamServerOption[]; dub: StreamServerOption[] }> {
    return { sub: [], dub: [] };
  }

  async getStreamSource(): Promise<StreamSourceResult> {
    throw new Error('Allanime streams are resolved by animeService server 5.');
  }

  /**
   * Resolve a playable episode for a title: find the Allanime show id by
   * title search (cached for 30 minutes), then return the middleware's
   * normalized resolver URL. That endpoint answers { ok, url, playUrl };
   * the native player plays `url` through hls.js when it is a playlist, or
   * the same-origin Range proxy `playUrl` for direct files.
   */
  async resolveEpisodeResolverUrl(title: string, episodeNumber: number, audio: StreamAudioMode): Promise<string> {
    const showId = await this.findShowId(title);
    if (!showId) {
      throw new Error(`Allanime: no show matches "${title}".`);
    }
    const mode = audio === 'dub' ? 'dub' : 'sub';
    return `${BASE_PATH}/episode_url?show_id=${encodeURIComponent(showId)}&ep_no=${encodeURIComponent(String(episodeNumber))}&mode=${mode}&quality=best`;
  }

  /** Exact-title-first lookup so a sequel never streams in place of its target. */
  private async findShowId(title: string): Promise<string | null> {
    const wanted = title.trim().toLowerCase();
    if (!wanted) return null;

    const cached = this.showIdByTitle.get(wanted);
    if (cached && Date.now() - cached.at < SHOW_ID_CACHE_TTL_MS) return cached.id;

    const { results } = await this.search(title);
    const exact = results.find((item) => item.title.trim().toLowerCase() === wanted);
    const chosen = exact || results[0];
    const rawId = chosen ? chosen.id.slice(ID_PREFIX.length) : null;
    if (rawId) this.showIdByTitle.set(wanted, { at: Date.now(), id: rawId });
    return rawId;
  }
}
