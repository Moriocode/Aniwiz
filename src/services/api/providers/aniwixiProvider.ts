import { IAnimeProvider, AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode } from '../types';
import { requestAniwixi } from '../aniwixiClient';

export class AniwixiProvider implements IAnimeProvider {
  public readonly name = 'AnimeWixi Embed & Episode API';
  public readonly id = 'aniwixi';
  public readonly version = '1.1.0';
  public readonly website = 'https://github.com/Aniwixi/aniwixi-api';

  /** Listing pages requested for the fallback catalogue (50 titles each). */
  private static readonly CATALOG_PAGES = 2;
  private static readonly PER_PAGE = 50;

  public async getSpotlight(): Promise<AnimeItem[]> {
    return (await this.getTrending()).slice(0, 10);
  }

  /**
   * AniWixi's `/anime` listing is paginated and sparse: several pages are
   * merged so the fallback catalogue is a real catalogue instead of 12 cards.
   * Missing artwork/metadata is filled in afterwards by animeService from
   * AniList (every item carries its `anilist_id`).
   */
  public async getTrending(): Promise<AnimeItem[]> {
    const pages = Array.from({ length: AniwixiProvider.CATALOG_PAGES }, (_, i) => i + 1);

    const responses = await Promise.all(
      pages.map(async (page) => {
        const json = await requestAniwixi<any>(`anime?page=${page}&per_page=${AniwixiProvider.PER_PAGE}`);
        return Array.isArray(json?.data) ? json.data : [];
      })
    );

    const seen = new Set<string>();
    const items: AnimeItem[] = [];
    for (const list of responses) {
      list.forEach((item: any, idx: number) => {
        const mapped = this.mapAniwixiItem(item, items.length + idx);
        if (!mapped || seen.has(mapped.id)) return;
        seen.add(mapped.id);
        items.push(mapped);
      });
    }
    return items;
  }

  public async getTopAiring(): Promise<AnimeItem[]> {
    return (await this.getTrending()).filter((item) => item.status === 'Ongoing');
  }

  public async getLatestEpisodes(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async search(query: string): Promise<{ results: AnimeItem[]; total: number }> {
    try {
      const json = await requestAniwixi<any>(`search?q=${encodeURIComponent(query)}`);
      if (!json) throw new Error('AniWixi search unavailable');
      const list = Array.isArray(json?.data) ? json.data : [];

      const results: AnimeItem[] = list
        .map((item: any, idx: number) => this.mapAniwixiItem(item, idx))
        .filter((item: AnimeItem | null): item is AnimeItem => item !== null);

      return { results, total: json.total || results.length };
    } catch {
      return { results: [], total: 0 };
    }
  }

  public async getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster?: string; rating?: number }>> {
    const { results } = await this.search(query);
    return results.slice(0, 6).map((r) => ({
      id: r.id,
      title: r.title,
      poster: r.poster,
      rating: r.rating,
    }));
  }

  /**
   * The details endpoint answers `{ data: { info, episodes, ... } }` — the old
   * code read `data.anime_info`, which never exists, so every lookup from this
   * provider came back empty and the watch page lost its poster and synopsis.
   */
  public async getAnimeDetails(id: string): Promise<AnimeItem | null> {
    try {
      const json = await requestAniwixi<any>(`anilist/${encodeURIComponent(id)}`);
      const info = json?.data?.info;
      if (!info) return null;

      const anime = this.mapAniwixiItem(info, 0, id);
      if (!anime) return null;

      const episodes = Array.isArray(json?.data?.episodes) ? json.data.episodes : [];
      if (episodes.length > 0) {
        anime.totalEpisodes = episodes.length;
        anime.subEpisodes = episodes.length;
      }

      return anime;
    } catch {
      return null;
    }
  }

  /**
   * Map one AniWixi payload item to AnimeItem with zero invented fields:
   * anything the upstream omits stays undefined (rendered as "—" by the UI).
   */
  private mapAniwixiItem(item: any, idx: number, forcedId?: string): AnimeItem | null {
    if (!item) return null;

    const isoId = String(item.anilist_id || item.post_id || item.slug || '').trim();
    const id = forcedId || isoId;
    if (!id) return null;

    const score = item.score !== undefined && item.score !== null && item.score !== '' ? String(item.score) : undefined;
    const episodes = parseInt(item.total_episodes ?? item.episodes) || undefined;
    const year = parseInt(item.year) || undefined;
    const rawStatus = String(item.status || '').toUpperCase();
    const status = rawStatus === 'FINISHED'
      ? 'Completed'
      : rawStatus === 'RELEASING' || rawStatus === 'ONGOING'
        ? 'Ongoing'
        : rawStatus === 'NOT_YET_RELEASED'
          ? 'Upcoming'
          : undefined;

    // AniWixi reports `poster: false` for titles without artwork (a JSON
    // boolean, not a missing key) — never turn that into a broken <img>.
    const isHttpUrl = (value: unknown): value is string =>
      typeof value === 'string' && /^https?:\/\//i.test(value);

    const format = String(item.format || item.type || '').toUpperCase();
    const typeMap: Record<string, AnimeItem['type']> = {
      TV: 'TV', TV_SHORT: 'TV', MOVIE: 'Movie', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Special',
    };

    return {
      id,
      anilistId: Number(item.anilist_id) || undefined,
      slug: item.slug,
      title: item.title?.english || item.title?.romaji || (typeof item.title === 'string' ? item.title : 'Anime'),
      altTitle: item.title?.english && item.title?.romaji && item.title.romaji !== item.title.english ? item.title.romaji : undefined,
      japaneseTitle: item.title?.native,
      synopsis: (item.synopsis || '').replace(/<[^>]*>?/gm, '').trim(),
      poster: isHttpUrl(item.poster) ? item.poster : undefined,
      banner: isHttpUrl(item.banner) ? item.banner : undefined,
      rating: score ? parseFloat(score) / 10 : undefined,
      score: score ? `${score}%` : undefined,
      quality: 'HD',
      type: typeMap[format],
      duration: typeof item.duration === 'string' && item.duration ? item.duration : undefined,
      year,
      status,
      genres: Array.isArray(item.genres) ? item.genres : [],
      studios: item.studio ? [item.studio] : [],
      totalEpisodes: episodes,
      subEpisodes: episodes,
      dubEpisodes: parseInt(item.dub_episodes) || undefined,
      rank: idx + 1,
      isTrending: true,
    };
  }

  public async getEpisodes(id: string): Promise<AnimeEpisode[]> {
    try {
      const json = await requestAniwixi<any>(`anilist/${encodeURIComponent(id)}`);
      if (!json) throw new Error('Aniwixi episodes fetch failed');
      const epData = json?.data?.episodes || [];

      if (Array.isArray(epData) && epData.length > 0) {
        // The upstream AniWixi payload numbers episodes with `episode_no`
        // (older payloads used `episode_number`/`num`); falling back to the
        // array index keeps the list usable if none of them are present.
        const episodes = epData.map((ep: any, index: number) => {
          const number = Number(ep.episode_no ?? ep.episode_number ?? ep.num) || index + 1;
          return {
            id: `${id}::ep=${number}`,
            number,
            title: String(ep.title || `Episode ${number}`).replace(/&#\d+;/g, "'").trim(),
            isFiller: false,
          };
        });
        return episodes.sort((a, b) => a.number - b.number);
      }

      return [];
    } catch {
      return [];
    }
  }

  public async getServers(animeId: string, episodeNumber: number): Promise<{
    sub: StreamServerOption[];
    dub: StreamServerOption[];
    raw?: StreamServerOption[];
  }> {
    const rawId = animeId.split('::')[0];
    return {
      sub: [
        {
          id: 'aniwixi-artplayer-sub',
          name: 'Server 1: AnimeWixi (Embed HD)',
          serverId: 1,
          type: 'sub',
          embedUrl: `https://aniwixi.xyz/embed/${rawId}/${episodeNumber}`,
          isPrimary: true,
        }
      ],
      dub: [
        {
          id: 'aniwixi-artplayer-dub',
          name: 'Server 1: AnimeWixi (Embed Dub)',
          serverId: 1,
          type: 'dub',
          embedUrl: `https://aniwixi.xyz/embed/${rawId}/${episodeNumber}?lang=en`,
        }
      ]
    };
  }

  public async getStreamSource(animeId: string, episodeNumber: number, _serverId: number, audio: StreamAudioMode): Promise<StreamSourceResult> {
    const rawId = animeId.split('::')[0];
    try {
      const json = await requestAniwixi<any>(`anilist/${rawId}/ep/${episodeNumber}`);
      if (!json) throw new Error('Aniwixi stream unavailable');
      const playerData = json.data?.player_data;

      const embedUrl = playerData?.embed_url_en || playerData?.embed_url || playerData?.embed_url_short || `https://aniwixi.xyz/embed/${rawId}/${episodeNumber}`;

      return {
        streamUrl: embedUrl,
        type: 'iframe',
        serverName: 'AnimeWixi Player',
        audioMode: audio,
      };
    } catch {
      return {
        streamUrl: `https://aniwixi.xyz/embed/${rawId}/${episodeNumber}`,
        type: 'iframe',
        serverName: 'AnimeWixi Embed',
        audioMode: audio,
      };
    }
  }
}
