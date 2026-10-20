import { IAnimeProvider, AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode } from '../types';

export class AniListProvider implements IAnimeProvider {
  public readonly name = 'AniList GraphQL Service';
  public readonly id = 'anilist';
  public readonly version = '2.0.0';
  public readonly website = 'https://anilist.co';

  /** Map a raw AniList media node onto the shared AnimeItem contract. */
  private mapMedia(item: any, rank = 1): AnimeItem | null {
    if (!item || !item.id) return null;

    const english = item.title?.english;
    const romaji = item.title?.romaji;

    return {
      id: String(item.id),
      anilistId: item.id,
      title: english || romaji || 'Unknown Anime',
      // Show the romaji line only when it differs from the displayed title,
      // and keep the native Japanese title in its own field (CJK glyphs are
      // not guaranteed to be available on the viewer's system).
      altTitle: english && romaji && romaji !== english ? romaji : undefined,
      japaneseTitle: item.title?.native,
      synopsis: (item.description || '').replace(/<[^>]*>?/gm, ''),
      poster: item.coverImage?.extraLarge || item.coverImage?.large,
      banner: item.bannerImage,
      rating: item.averageScore ? parseFloat((item.averageScore / 10).toFixed(1)) : 8.9,
      score: item.averageScore ? `${item.averageScore}%` : '89%',
      quality: 'HD',
      type: item.format || 'TV',
      duration: item.duration ? `${item.duration}m` : '24m',
      year: item.seasonYear || 2024,
      season: item.season,
      status: item.status === 'FINISHED' ? 'Completed' : 'Ongoing',
      genres: item.genres && item.genres.length > 0 ? item.genres : ['Action'],
      studios: item.studios?.nodes?.map((s: any) => s.name) || [],
      totalEpisodes: item.episodes || 12,
      subEpisodes: item.episodes || 12,
      dubEpisodes: Math.max(1, (item.episodes || 12) - 2),
      rank,
      isTrending: true,
      isPopular: true,
    };
  }

  public async getSpotlight(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async getTrending(): Promise<AnimeItem[]> {
    const res = await fetch('/api/anilist/browse?sort=TRENDING_DESC&perPage=12');
    if (!res.ok) throw new Error('AniList trending failed');
    const data = await res.json();
    // The browse proxy returns { data: { trending, popular, topRated } };
    // accept the paginated { data: { Page: { media } } } shape too.
    const media = data.data?.trending?.media || data.data?.Page?.media || [];

    return media
      .map((item: any, idx: number) => this.mapMedia(item, idx + 1))
      .filter((item: AnimeItem | null): item is AnimeItem => item !== null);
  }

  public async getTopAiring(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async getLatestEpisodes(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async search(query: string, page = 1): Promise<{ results: AnimeItem[]; total: number }> {
    const res = await fetch(`/api/anilist/search?q=${encodeURIComponent(query)}&page=${page}&perPage=20`);
    if (!res.ok) throw new Error('AniList search failed');
    const data = await res.json();
    const media = data.data?.Page?.media || [];

    const results = media
      .map((item: any, idx: number) => this.mapMedia(item, idx + 1))
      .filter((item: AnimeItem | null): item is AnimeItem => item !== null);

    return { results, total: data.data?.Page?.pageInfo?.total || results.length };
  }

  public async getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster: string; rating: number }>> {
    const { results } = await this.search(query, 1);
    return results.slice(0, 5).map(r => ({
      id: r.id,
      title: r.title,
      poster: r.poster,
      rating: r.rating,
    }));
  }

  public async getAnimeDetails(id: string): Promise<AnimeItem | null> {
    const cleanId = String(id).replace(/[^0-9]/g, '');

    // Numeric IDs resolve through the dedicated details endpoint (richer than
    // search: studios, duration, characters); everything else falls back to a
    // title/slug search.
    if (cleanId) {
      try {
        const res = await fetch(`/api/anilist/details/${cleanId}`);
        if (res.ok) {
          const json = await res.json();
          const media = json.data?.Media;
          if (media) {
            const mapped = this.mapMedia(media);
            if (mapped) return mapped;
          }
        }
      } catch {
        // fall through to the search-based lookup below
      }
    }

    const { results } = await this.search(id, 1);
    return results[0] || null;
  }

  public async getEpisodes(id: string): Promise<AnimeEpisode[]> {
    return Array.from({ length: 12 }, (_, i) => ({
      id: `${id}::ep=${i + 1}`,
      number: i + 1,
      title: `Episode ${i + 1}`,
      isFiller: false,
      durationSeconds: 1440,
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
