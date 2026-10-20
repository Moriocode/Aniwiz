import { IAnimeProvider, AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode, AiringScheduleItem } from '../types';

export class AnikotoProvider implements IAnimeProvider {
  public readonly name = 'Anikoto REST Service';
  public readonly id = 'anikoto';
  public readonly version = '1.0.0';
  public readonly website = 'https://github.com/Arisu-Yamabuki/Anikoto-API';

  public async getSpotlight(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async getTrending(): Promise<AnimeItem[]> {
    try {
      const res = await fetch('/api/anikoto/schedule');
      if (!res.ok) return [];
      const json = await res.json();
      const list = json.data || [];

      return list.map((item: any, idx: number) => ({
        id: item.data_id || `anikoto-${idx}`,
        title: item.title,
        synopsis: 'Airing episode scheduled on Anikoto.',
        poster: '',
        rating: 9.0,
        quality: 'HD' as const,
        type: 'TV' as const,
        duration: '24m',
        year: 2024,
        status: 'Ongoing' as const,
        genres: ['Action', 'Fantasy'],
        studios: [],
        totalEpisodes: 12,
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
      const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const res = await fetch(`/api/anikoto/info?name=${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error('Anikoto search error');
      const info = await res.json();
      const item: AnimeItem = {
        id: slug,
        title: info.title || query,
        altTitle: info.titleJapanese,
        synopsis: info.synopsis || '',
        poster: info.poster || '',
        rating: parseFloat(info.rating) || 9.0,
        quality: 'HD',
        type: 'TV',
        duration: info.duration || '24m',
        year: 2024,
        status: 'Ongoing',
        genres: info.genres || ['Action'],
        studios: info.studios || [],
        totalEpisodes: parseInt(info.episodes) || 12,
      };
      return { results: [item], total: 1 };
    } catch {
      return { results: [], total: 0 };
    }
  }

  public async getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster: string; rating: number }>> {
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return [{
      id: slug,
      title: query.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      poster: '',
      rating: 9.0,
    }];
  }

  public async getAnimeDetails(id: string): Promise<AnimeItem | null> {
    const { results } = await this.search(id);
    return results[0] || null;
  }

  public async getEpisodes(id: string): Promise<AnimeEpisode[]> {
    try {
      const res = await fetch(`/api/anikoto/episodes?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('Anikoto episodes error');
      const list = await res.json();

      return list.map((ep: any) => ({
        id: ep.data_id || `${id}::ep=${ep.num}`,
        number: Number(ep.num) || 1,
        title: ep.title || `Episode ${ep.num}`,
        isFiller: false,
        durationSeconds: 1440,
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
    return {
      sub: [
        {
          id: 'anikoto-sub-stream',
          name: 'Anikoto (Fast HD)',
          serverId: 4,
          type: 'sub',
          embedUrl: `/api/anikoto/stream?id=${encodeURIComponent(animeId)}&ep=${episodeNumber}&type=sub`,
          isPrimary: true,
        }
      ],
      dub: [
        {
          id: 'anikoto-dub-stream',
          name: 'Anikoto (Fast Dub)',
          serverId: 4,
          type: 'dub',
          embedUrl: `/api/anikoto/stream?id=${encodeURIComponent(animeId)}&ep=${episodeNumber}&type=dub`,
        }
      ]
    };
  }

  public async getStreamSource(animeId: string, episodeNumber: number, _serverId: number, audio: StreamAudioMode): Promise<StreamSourceResult> {
    try {
      const res = await fetch(`/api/anikoto/stream?id=${encodeURIComponent(animeId)}&ep=${episodeNumber}&type=${audio}`);
      if (!res.ok) throw new Error('Anikoto stream failed');
      const data = await res.json();

      return {
        streamUrl: data.streamUrl || `https://anikototv.to/embed/${animeId}?ep=${episodeNumber}&mode=${audio}`,
        type: 'iframe',
        serverName: 'Anikoto Stream',
        audioMode: audio,
      };
    } catch {
      return {
        streamUrl: `https://anikototv.to/embed/${animeId}?ep=${episodeNumber}&mode=${audio}`,
        type: 'iframe',
        serverName: 'Anikoto Stream',
        audioMode: audio,
      };
    }
  }

  public async getSchedules(): Promise<AiringScheduleItem[]> {
    try {
      const res = await fetch('/api/anikoto/schedule');
      if (!res.ok) throw new Error('Anikoto schedule failed');
      const json = await res.json();
      const list = json.data || [];

      return [{
        day: 'Today',
        date: json.date || new Date().toISOString().split('T')[0],
        animes: list.map((item: any) => ({
          title: item.title,
          episode: item.episode,
          time: item.time,
        }))
      }];
    } catch {
      return [];
    }
  }
}
