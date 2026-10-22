import {
  IAnimeProvider,
  AnimeItem,
  AnimeEpisode,
  StreamServerOption,
  StreamSourceResult,
  StreamAudioMode,
} from '../types';

/**
 * Open Anime API provider — https://github.com/Zcross091/Open-Anime-API
 *
 * That project is a self-hosted Express server (metadata via Jikan/AniList plus
 * on-demand stream resolution), so this provider talks to a running instance
 * through the local `/api/openanime/*` proxy. Point the proxy at an instance
 * with OPENANIME_API_URL (default http://localhost:3100).
 *
 * The instance is entirely optional: when it is not running the proxy answers
 * 504 immediately, every call here throws, and the provider cascade skips this
 * source without affecting the rest of the app.
 *
 * Contract (from their start.js):
 *   GET /api/trending              -> [ { id, title, image, ... } ]
 *   GET /api/search?q=             -> { source, results: [ { id, title, romajiTitle,
 *                                       image, episodes, score, status, synopsis } ] }
 *   GET /api/anime/:id             -> details object
 *   GET /api/stream?title=&episode -> { success, source, links: [ { type, url, source } ] }
 */
const BASE = '/api/openanime';

export class OpenAnimeProvider implements IAnimeProvider {
  public readonly name = 'Open Anime API (self-hosted)';
  public readonly id = 'openanime';
  public readonly version = '1.0.0';
  public readonly website = 'https://github.com/Zcross091/Open-Anime-API';

  /** Map their Jikan/AniList flavoured objects onto the shared AnimeItem. */
  private mapAnime(raw: any, rank = 1): AnimeItem | null {
    if (!raw) return null;

    // Their AniList tier nests titles, the Jikan tier returns flat strings.
    const title = typeof raw.title === 'string'
      ? raw.title
      : raw.title?.english || raw.title?.romaji;
    if (!title) return null;

    const rawScore = raw.score ?? raw.averageScore;
    const parsedScore = typeof rawScore === 'string' ? parseFloat(rawScore) : Number(rawScore);
    const rating = Number.isFinite(parsedScore)
      ? (parsedScore > 10 ? parseFloat((parsedScore / 10).toFixed(1)) : parsedScore)
      : 8.5;

    const episodes = Number(raw.episodes) || 12;
    const statusText = String(raw.status || '').toLowerCase();
    const status = statusText.includes('current') ? 'Ongoing'
      : statusText.includes('upcom') ? 'Upcoming'
      : 'Completed';

    return {
      id: `openanime-${raw.id}`,
      slug: raw.id != null ? String(raw.id) : undefined,
      title,
      altTitle: raw.romajiTitle && raw.romajiTitle !== title ? raw.romajiTitle : undefined,
      synopsis: raw.synopsis || raw.description || '',
      poster: raw.image || raw.coverImage?.extraLarge || raw.coverImage?.large || '',
      banner: raw.bannerImage,
      rating,
      score: `${Math.round(rating * 10)}%`,
      quality: 'HD',
      type: 'TV',
      duration: '24m',
      year: raw.year || new Date().getFullYear(),
      status,
      genres: Array.isArray(raw.genres) && raw.genres.length > 0 ? raw.genres : ['Action'],
      studios: [],
      totalEpisodes: episodes,
      subEpisodes: episodes,
      dubEpisodes: Math.max(1, episodes - 2),
      rank,
      isTrending: true,
    };
  }

  public async getSpotlight(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async getTrending(): Promise<AnimeItem[]> {
    const res = await fetch(`${BASE}/trending`);
    if (!res.ok) throw new Error(`OpenAnime trending HTTP ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data?.results || data?.data || [];

    return list
      .map((item: any, idx: number) => this.mapAnime(item, idx + 1))
      .filter((item: AnimeItem | null): item is AnimeItem => item !== null);
  }

  public async getTopAiring(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async getLatestEpisodes(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async search(query: string, page = 1): Promise<{ results: AnimeItem[]; total: number }> {
    const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}&page=${page}`);
    if (!res.ok) throw new Error(`OpenAnime search HTTP ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data?.results || data?.data || [];

    const results = list
      .map((item: any, idx: number) => this.mapAnime(item, idx + 1))
      .filter((item: AnimeItem | null): item is AnimeItem => item !== null);

    return { results, total: results.length };
  }

  public async getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster?: string; rating?: number }>> {
    const { results } = await this.search(query, 1);
    return results.slice(0, 5).map(r => ({ id: r.id, title: r.title, poster: r.poster, rating: r.rating }));
  }

  public async getAnimeDetails(id: string): Promise<AnimeItem | null> {
    const rawId = String(id).replace(/^openanime-/, '');
    const res = await fetch(`${BASE}/anime/${encodeURIComponent(rawId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return this.mapAnime(data?.data || data);
  }

  /**
   * Their resolver works from a title + episode number, not an episode list,
   * so there is nothing to offer here — the AniWixi provider supplies real
   * episode titles first in the cascade.
   */
  public async getEpisodes(): Promise<AnimeEpisode[]> {
    return [];
  }

  public async getServers(): Promise<{ sub: StreamServerOption[]; dub: StreamServerOption[] }> {
    return { sub: [], dub: [] };
  }

  /**
   * Resolve a playable link. Their resolver returns a `links` array holding
   * sub/dub embeds (gogoanime/animepahe) and sometimes torrent magnets —
   * magnets are flagged non-embeddable so the UI never tries to frame them.
   */
  public async getStreamSource(
    animeId: string,
    episodeNumber: number,
    _serverId: number,
    audio: StreamAudioMode
  ): Promise<StreamSourceResult> {
    // Accept either an id (look the title up) or an already-known title string.
    const bare = String(animeId).replace(/^openanime-/, '');
    const title = /^\d+$/.test(bare)
      ? (await this.getAnimeDetails(bare))?.title || bare
      : bare;

    const res = await fetch(
      `${BASE}/stream?title=${encodeURIComponent(title)}&episode=${episodeNumber}`
    );
    if (!res.ok) throw new Error(`OpenAnime stream HTTP ${res.status}`);

    const json = await res.json();
    const links: any[] = Array.isArray(json?.links) ? json.links : [];
    if (links.length === 0) throw new Error('OpenAnime returned no stream links');

    const wanted = audio === 'dub' ? 'dub' : 'sub';
    const link = links.find(l => l?.type === wanted)
      || links.find(l => l?.type === 'sub')
      || links[0];

    if (!link?.url) throw new Error('OpenAnime returned no usable stream URL');

    const isMagnet = String(link.url).startsWith('magnet:') || link.type === 'torrent';

    return {
      streamUrl: link.url,
      type: 'iframe',
      serverName: `OpenAnime (${link.source || 'auto'})`,
      audioMode: audio,
      embeddable: !isMagnet,
    };
  }
}
