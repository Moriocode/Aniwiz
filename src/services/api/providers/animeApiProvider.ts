import { IAnimeProvider, AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode } from '../types';

export class AnimeApiProvider implements IAnimeProvider {
  public readonly name = 'ANIME-API (JustalK Scraper)';
  public readonly id = 'anime-api';
  public readonly version = '1.0.0';
  public readonly website = 'https://github.com/JustalK/ANIME-API';

  public async getSpotlight(): Promise<AnimeItem[]> {
    return [];
  }

  public async getTrending(): Promise<AnimeItem[]> {
    return [];
  }

  public async getTopAiring(): Promise<AnimeItem[]> {
    return [];
  }

  public async getLatestEpisodes(): Promise<AnimeItem[]> {
    return [];
  }

  public async search(query: string): Promise<{ results: AnimeItem[]; total: number }> {
    try {
      const res = await fetch(`/api/anime-api/links?search=${encodeURIComponent(query)}&limit=10`);
      if (!res.ok) throw new Error('ANIME-API search failed');
      const json = await res.json();
      const list = json.data || [];

      const results: AnimeItem[] = list.map((item: any, i: number) => ({
        id: item.link || `anime-api-${i}`,
        title: item.title,
        synopsis: `Source mirror: ${item.sourceName}`,
        poster: '',
        rating: 8.9,
        quality: 'HD',
        type: 'TV',
        duration: '24m',
        year: 2024,
        status: 'Ongoing',
        genres: ['Action', 'Adventure'],
        studios: [item.sourceName],
        totalEpisodes: 12,
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
    raw?: StreamServerOption[];
  }> {
    try {
      const res = await fetch(`/api/anime-api/stream?search=${encodeURIComponent(animeId)}&episode=${episodeNumber}`);
      if (!res.ok) throw new Error('ANIME-API stream fetch failed');
      const json = await res.json();
      const sources = json.data || [];

      const sub: StreamServerOption[] = sources.map((s: any, idx: number) => ({
        id: `anime-api-${s.source.toLowerCase()}`,
        name: `Multi-Mirror (${s.sourceName})`,
        serverId: 5 + idx,
        type: 'sub',
        embedUrl: s.link,
      }));

      return { sub, dub: [] };
    } catch {
      return { sub: [], dub: [] };
    }
  }

  public async getStreamSource(animeId: string, episodeNumber: number, _serverId: number, audio: StreamAudioMode): Promise<StreamSourceResult> {
    const slug = animeId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    try {
      const res = await fetch(`/api/anime-api/stream?search=${encodeURIComponent(animeId)}&episode=${episodeNumber}`);
      if (!res.ok) throw new Error('ANIME-API stream failed');
      const json = await res.json();
      const first = json.data?.[0];

      return {
        streamUrl: first?.link || `https://anitaku.bz/${slug}-episode-${episodeNumber}`,
        type: 'iframe',
        serverName: first?.sourceName || 'Multi-Mirror Scraper',
        audioMode: audio,
      };
    } catch {
      return {
        streamUrl: `https://anitaku.bz/${slug}-episode-${episodeNumber}`,
        type: 'iframe',
        serverName: 'Multi-Mirror Scraper',
        audioMode: audio,
      };
    }
  }
}
