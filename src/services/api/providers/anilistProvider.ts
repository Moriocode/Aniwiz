import { IAnimeProvider, AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode } from '../types';

export class AniListProvider implements IAnimeProvider {
  public readonly name = 'AniList GraphQL Service';
  public readonly id = 'anilist';
  public readonly version = '2.0.0';
  public readonly website = 'https://anilist.co';

  public async getSpotlight(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async getTrending(): Promise<AnimeItem[]> {
    const res = await fetch('/api/anilist/browse?sort=TRENDING_DESC&perPage=12');
    if (!res.ok) throw new Error('AniList trending failed');
    const data = await res.json();
    const media = data.data?.Page?.media || [];

    return media.map((item: any, idx: number) => ({
      id: String(item.id),
      anilistId: item.id,
      title: item.title?.english || item.title?.romaji || 'Unknown Anime',
      altTitle: item.title?.native,
      synopsis: (item.description || '').replace(/<[^>]*>?/gm, ''),
      poster: item.coverImage?.extraLarge || item.coverImage?.large,
      banner: item.bannerImage,
      rating: item.averageScore ? (item.averageScore / 10).toFixed(1) : 8.9,
      score: item.averageScore ? `${item.averageScore}%` : '89%',
      quality: 'HD',
      type: item.format || 'TV',
      duration: item.duration ? `${item.duration}m` : '24m',
      year: item.seasonYear || 2024,
      season: item.season,
      status: item.status === 'FINISHED' ? 'Completed' : 'Ongoing',
      genres: item.genres || ['Action'],
      studios: item.studios?.nodes?.map((s: any) => s.name) || [],
      totalEpisodes: item.episodes || 12,
      subEpisodes: item.episodes || 12,
      dubEpisodes: Math.max(1, (item.episodes || 12) - 2),
      rank: idx + 1,
      isTrending: true,
    }));
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

    const results = media.map((item: any) => ({
      id: String(item.id),
      anilistId: item.id,
      title: item.title?.english || item.title?.romaji,
      altTitle: item.title?.native,
      synopsis: (item.description || '').replace(/<[^>]*>?/gm, ''),
      poster: item.coverImage?.extraLarge || item.coverImage?.large,
      rating: item.averageScore ? (item.averageScore / 10).toFixed(1) : 8.8,
      quality: 'HD' as const,
      type: (item.format || 'TV') as any,
      duration: '24m',
      year: item.seasonYear || 2024,
      status: item.status === 'FINISHED' ? 'Completed' : 'Ongoing',
      genres: item.genres || ['Action'],
      studios: [],
      totalEpisodes: item.episodes || 12,
    }));

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
