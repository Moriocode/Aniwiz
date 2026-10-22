import {
  IAnimeProvider,
  AnimeItem,
  AnimeEpisode,
  StreamServerOption,
  StreamSourceResult,
  StreamAudioMode,
} from '../types';

/**
 * AniPulse AnimeAPI provider
 * Repository: https://github.com/AniPulse/AnimeAPI
 *
 * Talks to the app's own `/api/anipulse/*` proxy (see server/anipmApiHandler.ts),
 * which forwards to the deployment named by the ANIPULSE_API_URL environment
 * variable. Every mapping below follows the endpoint schemas documented in the
 * AnimeAPI README — fields the upstream does not report stay undefined so the
 * UI renders "—" instead of invented values.
 *
 * Playback note: AniPulse catalog ids are its own slugs (hianime-family ids),
 * not AniList ids, so this provider leaves `anilistId` unset. animeService
 * resolves the real AniList id from the title (via the live AniWixi search)
 * before building stream URLs, so the four stream servers always point at the
 * correct anime.
 */
export class AniPulseProvider implements IAnimeProvider {
  public readonly name = 'AniPulse AnimeAPI';
  public readonly id = 'anipulse';
  public readonly version = '1.0.0';
  public readonly website = 'https://github.com/AniPulse/AnimeAPI';

  /** GET /api/ -> { success, results: { spotlights, trending, topAiring, ... } } */
  private async fetchHome(): Promise<any> {
    const res = await fetch('/api/anipulse/');
    if (!res.ok) throw new Error(`AniPulse home HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(`AniPulse home error: ${json.message || 'unknown'}`);
    return json.results || {};
  }

  private yearFrom(dateStr?: string): number | undefined {
    if (!dateStr) return undefined;
    const match = String(dateStr).match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : undefined;
  }

  private qualityOf(raw?: string): AnimeItem['quality'] {
    const q = String(raw || '').toUpperCase();
    if (q === 'FHD' || q === '1080P') return 'FHD';
    if (q === '4K' || q === '2160P') return '4K';
    if (q === 'SD' || q === '480P') return 'SD';
    return 'HD';
  }

  private typeOf(showType?: string): AnimeItem['type'] {
    const t = String(showType || '').toUpperCase();
    if (t === 'MOVIE') return 'Movie';
    if (t === 'OVA') return 'OVA';
    if (t === 'ONA') return 'ONA';
    if (t === 'SPECIAL' || t === 'SPECIALS') return 'Special';
    if (t === 'TV' || t === 'TV SHORT' || t === 'TV_SHORT') return 'TV';
    return undefined;
  }

  private statusOf(raw?: string): AnimeItem['status'] {
    const s = String(raw || '').toLowerCase();
    if (s.includes('complete') || s.includes('finished')) return 'Completed';
    if (s.includes('airing') || s.includes('ongoing')) return 'Ongoing';
    if (s.includes('not yet') || s.includes('upcoming')) return 'Upcoming';
    return undefined;
  }

  /** Map one AniPulse list item (home/search shapes share these fields). */
  private mapListItem(item: any, rank?: number): AnimeItem {
    const tv = item.tvInfo || {};
    const episodeInfo = tv.episodeInfo || {};
    const total = Number(episodeInfo.episodes ?? episodeInfo.totalEpisodes) || undefined;
    const poster = typeof item.poster === 'string' && item.poster.startsWith('http') ? item.poster : undefined;

    return {
      id: String(item.id || item.data_id),
      slug: item.id ? String(item.id) : undefined,
      title: item.title || 'Anime',
      japaneseTitle: item.japanese_title || undefined,
      synopsis: (item.description || '').replace(/<[^>]*>?/gm, '').trim(),
      poster,
      banner: poster,
      quality: this.qualityOf(tv.quality),
      type: this.typeOf(tv.showType),
      duration: typeof tv.duration === 'string' && tv.duration ? tv.duration : undefined,
      year: this.yearFrom(tv.releaseDate),
      status: undefined,
      genres: [],
      studios: [],
      totalEpisodes: total,
      rank,
      isTrending: true,
    };
  }

  public async getSpotlight(): Promise<AnimeItem[]> {
    const home = await this.fetchHome();
    const list = home.spotlights || [];
    if (!Array.isArray(list) || list.length === 0) return [];
    return list.map((item: any, i: number) => this.mapListItem(item, i + 1));
  }

  public async getTrending(): Promise<AnimeItem[]> {
    const home = await this.fetchHome();
    // trending carries rank+poster; topAiring carries descriptions/tvInfo —
    // merge (deduped by id) so the grid gets the richest real data available.
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const item of [...(home.trending || []), ...(home.topAiring || [])]) {
      const key = String(item?.id || item?.data_id || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    return merged.map((item: any, i: number) => this.mapListItem(item, i + 1));
  }

  public async getTopAiring(): Promise<AnimeItem[]> {
    const home = await this.fetchHome();
    return (home.topAiring || []).map((item: any, i: number) => this.mapListItem(item, i + 1));
  }

  public async getLatestEpisodes(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  /** GET /api/search?keyword= -> { success, results: [{ id, data_id, poster, title, japanese_title, tvInfo }] } */
  public async search(query: string): Promise<{ results: AnimeItem[]; total: number }> {
    const res = await fetch(`/api/anipulse/search?keyword=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`AniPulse search HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(`AniPulse search error: ${json.message || 'unknown'}`);
    const list = Array.isArray(json.results) ? json.results : [];
    const results = list.map((item: any, i: number) => this.mapListItem(item, i + 1));
    return { results, total: results.length };
  }

  public async getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster?: string; rating?: number }>> {
    const { results } = await this.search(query);
    return results.slice(0, 5).map((r) => ({
      id: r.id,
      title: r.title,
      poster: r.poster,
      rating: r.rating,
    }));
  }

  /** GET /api/info?id=<slug> -> { success, results: { data: { ..., animeInfo } } } */
  public async getAnimeDetails(id: string): Promise<AnimeItem | null> {
    const res = await fetch(`/api/anipulse/info?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const data = json?.success ? json.results?.data : null;
    if (!data) return null;

    const info = data.animeInfo || {};
    const genres = Array.isArray(info.Genres)
      ? info.Genres.map((g: any) => (typeof g === 'string' ? g : g?.name)).filter(Boolean)
      : [];
    const studios = Array.isArray(info.Studios)
      ? info.Studios.map((s: any) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
      : typeof info.Studios === 'string' && info.Studios
        ? [info.Studios]
        : [];
    const score = info['MAL Score'] ? parseFloat(String(info['MAL Score'])) : undefined;
    const poster = typeof data.poster === 'string' && data.poster.startsWith('http') ? data.poster : undefined;

    return {
      id: String(data.id || id),
      slug: String(data.id || id),
      title: data.title || 'Anime',
      japaneseTitle: data.japanese_title || undefined,
      synopsis: (info.Overview || '').replace(/<[^>]*>?/gm, '').trim(),
      poster,
      banner: poster,
      rating: Number.isFinite(score) ? score : undefined,
      score: Number.isFinite(score) ? `${score}%` : undefined,
      quality: this.qualityOf(data.showType === 'Movie' ? 'HD' : data.showType),
      type: this.typeOf(data.showType),
      duration: typeof info.Duration === 'string' && info.Duration ? info.Duration.replace(/\s*min.*/i, 'm').trim() : undefined,
      year: this.yearFrom(info.Premiered) ?? this.yearFrom(info.Aired),
      status: this.statusOf(info.Status),
      genres,
      studios,
      totalEpisodes: undefined, // /api/info does not report a count; episodes endpoint does
      isTrending: false,
    };
  }

  /** GET /api/episodes/<slug> -> { success, results: { totalEpisodes, episodes: [{ episode_no, id, data_id, title }] } } */
  public async getEpisodes(id: string): Promise<AnimeEpisode[]> {
    const res = await fetch(`/api/anipulse/episodes/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`AniPulse episodes HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(`AniPulse episodes error: ${json.message || 'unknown'}`);
    const list = json.results?.episodes || [];
    if (!Array.isArray(list)) return [];
    return list.map((ep: any, i: number) => ({
      id: `${id}::ep=${ep.episode_no ?? i + 1}`,
      number: Number(ep.episode_no) || i + 1,
      title: ep.title || `Episode ${ep.episode_no ?? i + 1}`,
      isFiller: false,
    }));
  }

  /**
   * The four stream servers are built by animeService from resolved AniList
   * ids, so this provider contributes no server entries of its own (its
   * megacloud endpoints need a separate player integration).
   */
  public async getServers(): Promise<{ sub: StreamServerOption[]; dub: StreamServerOption[] }> {
    return { sub: [], dub: [] };
  }

  public async getStreamSource(): Promise<StreamSourceResult> {
    throw new Error('AniPulseProvider does not provide stream sources directly; animeService resolves servers from AniList ids.');
  }
}
