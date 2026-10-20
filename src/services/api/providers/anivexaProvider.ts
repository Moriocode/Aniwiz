import { IAnimeProvider, AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode } from '../types';

export class AnivexaProvider implements IAnimeProvider {
  public readonly name = 'Anivexa Multi-Source Aggregator';
  public readonly id = 'anivexa';
  public readonly version = '2.3.0';
  public readonly website = 'https://github.com/walterwhite-69/Anivexa-API';

  public async getSpotlight(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async getTrending(): Promise<AnimeItem[]> {
    try {
      const res = await fetch('/api/anilist/browse');
      if (!res.ok) return [];
      const json = await res.json();
      const media = json.data?.trending?.media || [];
      return media.map((item: any, idx: number) => ({
        id: String(item.id),
        anilistId: item.id,
        slug: (item.title?.romaji || 'anime').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: item.title?.english || item.title?.romaji,
        altTitle: item.title?.native,
        synopsis: (item.description || '').replace(/<[^>]*>?/gm, '').trim(),
        poster: item.coverImage?.large || item.coverImage?.medium,
        banner: item.bannerImage,
        rating: item.averageScore ? parseFloat((item.averageScore / 10).toFixed(1)) : 8.8,
        score: item.averageScore ? `${item.averageScore}%` : '88%',
        quality: 'HD' as const,
        type: (item.format || 'TV') as any,
        duration: '24m',
        year: item.seasonYear || 2024,
        status: item.status === 'FINISHED' ? 'Completed' : 'Ongoing',
        genres: item.genres || ['Action'],
        studios: [],
        totalEpisodes: item.episodes || 12,
        subEpisodes: item.episodes || 12,
        dubEpisodes: Math.max(1, (item.episodes || 12) - 2),
        rank: idx + 1,
        isTrending: true,
      }));
    } catch {
      return [];
    }
  }

  public async getTopAiring(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async getLatestEpisodes(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async search(query: string): Promise<{ results: AnimeItem[]; total: number }> {
    try {
      const res = await fetch(`/api/anilist/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return { results: [], total: 0 };
      const json = await res.json();
      const media = json.data?.Page?.media || [];
      const results: AnimeItem[] = media.map((item: any) => ({
        id: String(item.id),
        anilistId: item.id,
        title: item.title?.english || item.title?.romaji,
        synopsis: (item.description || '').replace(/<[^>]*>?/gm, '').trim(),
        poster: item.coverImage?.large || item.coverImage?.medium,
        rating: item.averageScore ? parseFloat((item.averageScore / 10).toFixed(1)) : 8.8,
        quality: 'HD',
        type: item.format || 'TV',
        duration: '24m',
        year: item.seasonYear || 2024,
        status: item.status === 'FINISHED' ? 'Completed' : 'Ongoing',
        genres: item.genres || ['Action'],
        studios: [],
        totalEpisodes: item.episodes || 12,
      }));
      return { results, total: results.length };
    } catch {
      return { results: [], total: 0 };
    }
  }

  public async getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster: string; rating: number }>> {
    const { results } = await this.search(query);
    return results.slice(0, 5).map(r => ({
      id: r.id,
      title: r.title,
      poster: r.poster,
      rating: r.rating,
    }));
  }

  public async getAnimeDetails(id: string): Promise<AnimeItem | null> {
    const { results } = await this.search(id);
    return results[0] || null;
  }

  public async getEpisodes(id: string): Promise<AnimeEpisode[]> {
    const anilistId = id.replace(/[^0-9]/g, '') || '154587';
    try {
      const res = await fetch(`/api/anivexa/episodes/${anilistId}`);
      if (!res.ok) throw new Error(`Anivexa episodes error: ${res.status}`);
      const data = await res.json();
      const episodes = data.episodes || [];

      return episodes.map((ep: any) => ({
        id: `${id}::ep=${ep.episode}`,
        number: ep.episode,
        title: ep.title || `Episode ${ep.episode}`,
        isFiller: false,
        durationSeconds: (ep.durationMinutes || 24) * 60,
      }));
    } catch {
      return Array.from({ length: 12 }, (_, i) => ({
        id: `${id}::ep=${i + 1}`,
        number: i + 1,
        title: `Episode ${i + 1}`,
        isFiller: false,
      }));
    }
  }

  public async getServers(animeId: string, episodeNumber: number): Promise<{
    sub: StreamServerOption[];
    dub: StreamServerOption[];
    raw?: StreamServerOption[];
  }> {
    const anilistId = animeId.replace(/[^0-9]/g, '') || '154587';
    return {
      sub: [
        {
          id: 'anivexa-reanime-sub',
          name: 'Anivexa (MegaCloud HD)',
          serverId: 2,
          type: 'sub',
          embedUrl: `/api/anivexa/watch/reanime/${anilistId}/sub/${episodeNumber}`,
          isPrimary: true,
        },
        {
          id: 'anivexa-anikoto-sub',
          name: 'Anivexa (AniKoto Stream)',
          serverId: 3,
          type: 'sub',
          embedUrl: `/api/anivexa/watch/anikoto/${anilistId}/sub/${episodeNumber}`,
        }
      ],
      dub: [
        {
          id: 'anivexa-reanime-dub',
          name: 'Anivexa (MegaCloud Dub)',
          serverId: 2,
          type: 'dub',
          embedUrl: `/api/anivexa/watch/reanime/${anilistId}/dub/${episodeNumber}`,
        }
      ]
    };
  }

  public async getStreamSource(animeId: string, episodeNumber: number, serverId: number, audio: StreamAudioMode): Promise<StreamSourceResult> {
    const anilistId = animeId.replace(/[^0-9]/g, '') || '154587';
    const provider = serverId === 3 ? 'anikoto' : 'reanime';
    const res = await fetch(`/api/anivexa/watch/${provider}/${anilistId}/${audio}/${episodeNumber}`);
    if (!res.ok) throw new Error('Anivexa stream fetch failed');
    const data = await res.json();

    return {
      streamUrl: data.streamUrl || `https://ani.pm/embed/ani/${anilistId}/${episodeNumber}/${audio}`,
      type: 'iframe',
      serverName: `Anivexa (${data.provider || 'Multi-Source'})`,
      audioMode: audio,
    };
  }
}
