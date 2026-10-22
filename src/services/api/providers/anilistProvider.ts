import { IAnimeProvider, AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode } from '../types';
import { ANILIST_MEDIA_FIELDS, mapAniListMedia, requestAniListData } from '../anilistClient';

export class AniListProvider implements IAnimeProvider {
  public readonly name = 'AniList GraphQL Service';
  public readonly id = 'anilist';
  public readonly version = '2.1.0';
  public readonly website = 'https://anilist.co';

  /**
   * The catalogue query feeds both the spotlight banner and the trending grid
   * in one round-trip. The request is shared so the two callers can never fire
   * the same 150-title query twice (and burn the AniList rate limit).
   */
  private browseInFlight: Promise<AnimeItem[]> | null = null;

  /** Top trending, popular and top-rated titles, deduped by AniList id. */
  public async getTrending(): Promise<AnimeItem[]> {
    if (!this.browseInFlight) {
      this.browseInFlight = this.fetchBrowse().finally(() => {
        this.browseInFlight = null;
      });
    }
    return this.browseInFlight;
  }

  private async fetchBrowse(): Promise<AnimeItem[]> {
    const data = await requestAniListData(
      `query {
        trending: Page(page: 1, perPage: 50) {
          media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { ${ANILIST_MEDIA_FIELDS} }
        }
        popular: Page(page: 1, perPage: 50) {
          media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) { ${ANILIST_MEDIA_FIELDS} }
        }
        topRated: Page(page: 1, perPage: 50) {
          media(sort: SCORE_DESC, type: ANIME, isAdult: false) { ${ANILIST_MEDIA_FIELDS} }
        }
      }`,
      undefined,
      '/api/anilist/browse'
    );

    // The proxy answers the same alias shape; older payloads used { Page }.
    const lists: any[][] = [
      data?.trending?.media || [],
      data?.popular?.media || [],
      data?.topRated?.media || [],
      data?.Page?.media || [],
    ];

    const seen = new Set<string>();
    const media: any[] = [];
    for (const list of lists) {
      for (const item of list) {
        if (!item?.id || seen.has(String(item.id))) continue;
        seen.add(String(item.id));
        media.push(item);
      }
    }

    return media
      .map((item, idx) => mapAniListMedia(item, idx + 1))
      .filter((item): item is AnimeItem => item !== null);
  }

  public async getSpotlight(): Promise<AnimeItem[]> {
    return (await this.getTrending()).slice(0, 10);
  }

  public async getTopAiring(): Promise<AnimeItem[]> {
    return (await this.getTrending()).filter((item) => item.status === 'Ongoing');
  }

  public async getLatestEpisodes(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async search(query: string, page = 1): Promise<{ results: AnimeItem[]; total: number }> {
    const data = await requestAniListData(
      `query ($search: String, $page: Int) {
        Page(page: $page, perPage: 24) {
          pageInfo { total }
          media(search: $search, type: ANIME, isAdult: false) { ${ANILIST_MEDIA_FIELDS} }
        }
      }`,
      { search: query, page },
      `/api/anilist/search?q=${encodeURIComponent(query)}&page=${page}`
    );

    const media: any[] = data?.Page?.media || [];
    const results = media
      .map((item, idx) => mapAniListMedia(item, idx + 1))
      .filter((item): item is AnimeItem => item !== null);

    return { results, total: data?.Page?.pageInfo?.total || results.length };
  }

  public async getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster?: string; rating?: number }>> {
    const { results } = await this.search(query, 1);
    return results.slice(0, 6).map((r) => ({
      id: r.id,
      title: r.title,
      poster: r.poster,
      rating: r.rating,
    }));
  }

  public async getAnimeDetails(id: string): Promise<AnimeItem | null> {
    const cleanId = String(id).replace(/[^0-9]/g, '');

    if (cleanId) {
      const data = await requestAniListData(
        `query ($id: Int) {
          Media(id: $id, type: ANIME) { ${ANILIST_MEDIA_FIELDS} }
        }`,
        { id: Number(cleanId) },
        `/api/anilist/details/${cleanId}`
      );
      const mapped = mapAniListMedia(data?.Media);
      if (mapped) return mapped;
    }

    // Non-numeric ids fall back to a title search.
    const { results } = await this.search(id, 1);
    return results[0] || null;
  }

  public async getEpisodes(id: string): Promise<AnimeEpisode[]> {
    const details = await this.getAnimeDetails(id);
    const count = details?.totalEpisodes;
    if (!count) return [];

    const minutes = parseInt(details?.duration || '') || undefined;
    return Array.from({ length: Math.min(Math.max(count, 1), 60) }, (_, i) => ({
      id: `${id}::ep=${i + 1}`,
      number: i + 1,
      title: `Episode ${i + 1}`,
      isFiller: false,
      durationSeconds: minutes ? minutes * 60 : undefined,
    }));
  }

  public async getServers(animeId: string, episodeNumber: number): Promise<{
    sub: StreamServerOption[];
    dub: StreamServerOption[];
  }> {
    const anilistId = Number(animeId) || 154587;
    return {
      sub: [
        { id: 'sub-hd1', name: 'Server 1 (Primary HD)', serverId: 1, type: 'sub', embedUrl: `https://ani.pm/embed/ani/${anilistId}/${episodeNumber}/sub`, isPrimary: true },
        { id: 'sub-hd2', name: 'Server 2 (MegaCloud)', serverId: 2, type: 'sub', embedUrl: `https://megacloud.tv/embed-2/e-1/${anilistId}?ep=${episodeNumber}` },
        { id: 'sub-sb', name: 'Server 3 (Fast SB)', serverId: 3, type: 'sub', embedUrl: `https://streamsb.net/e/${anilistId}ep${episodeNumber}` },
      ],
      dub: [
        { id: 'dub-hd1', name: 'Server 1 (Primary HD)', serverId: 1, type: 'dub', embedUrl: `https://ani.pm/embed/ani/${anilistId}/${episodeNumber}/dub` },
        { id: 'dub-hd2', name: 'Server 2 (MegaCloud)', serverId: 2, type: 'dub', embedUrl: `https://megacloud.tv/embed-2/e-1/${anilistId}?ep=${episodeNumber}` },
      ]
    };
  }

  public async getStreamSource(animeId: string, episodeNumber: number, serverId: number, audio: StreamAudioMode): Promise<StreamSourceResult> {
    const anilistId = Number(animeId) || 154587;
    let url = `https://ani.pm/embed/ani/${anilistId}/${episodeNumber}/${audio}`;
    if (serverId === 2) url = `https://megacloud.tv/embed-2/e-1/${anilistId}?ep=${episodeNumber}`;
    if (serverId === 3) url = `https://streamsb.net/e/${anilistId}ep${episodeNumber}`;

    return {
      streamUrl: url,
      type: 'iframe',
      serverName: `Server ${serverId}`,
      audioMode: audio,
    };
  }
}
