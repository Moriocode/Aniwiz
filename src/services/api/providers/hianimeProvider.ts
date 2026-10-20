import { IAnimeProvider, AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode, AiringScheduleItem } from '../types';

export class HiAnimeProvider implements IAnimeProvider {
  public readonly name = 'HiAnime RESTful Scraper';
  public readonly id = 'hianime';
  public readonly version = '1.0.0';
  public readonly website = 'https://hianime.to';

  public async getSpotlight(): Promise<AnimeItem[]> {
    const res = await fetch('/api/hianime/home');
    if (!res.ok) throw new Error(`HiAnime home failed: ${res.status}`);
    const data = await res.json();
    const spotlight = data.data?.spotlight || [];

    return spotlight.map((item: any, idx: number) => ({
      id: item.id || `hianime-${idx}`,
      anilistId: item.anilistId,
      slug: item.id,
      title: item.title,
      altTitle: item.alternativeTitle,
      synopsis: item.synopsis || '',
      poster: item.poster,
      rating: parseFloat(item.rating) || 9.2,
      quality: (item.quality as any) || 'HD',
      type: (item.type as any) || 'TV',
      duration: item.duration || '24m',
      year: 2024,
      status: 'Ongoing',
      genres: ['Action', 'Fantasy', 'Adventure'],
      studios: ['A-1 Pictures'],
      totalEpisodes: item.episodes?.sub || 12,
      subEpisodes: item.episodes?.sub || 12,
      dubEpisodes: item.episodes?.dub || 10,
      rank: item.rank || idx + 1,
      isTrending: true,
    }));
  }

  public async getTrending(): Promise<AnimeItem[]> {
    const res = await fetch('/api/hianime/home');
    if (!res.ok) throw new Error('Trending fetch failed');
    const data = await res.json();
    const trending = data.data?.trending || [];

    return trending.map((item: any, idx: number) => ({
      id: item.id || `trending-${idx}`,
      anilistId: item.anilistId,
      slug: item.id,
      title: item.title,
      synopsis: 'Popular streaming release trending globally.',
      poster: item.poster,
      rating: parseFloat(item.rating) || 9.0,
      quality: 'HD',
      type: (item.type as any) || 'TV',
      duration: '24m',
      year: 2024,
      status: 'Ongoing',
      genres: ['Action', 'Adventure'],
      studios: ['Madhouse'],
      totalEpisodes: 24,
      rank: item.rank || idx + 1,
      isTrending: true,
    }));
  }

  public async getTopAiring(): Promise<AnimeItem[]> {
    const res = await fetch('/api/hianime/home');
    if (!res.ok) throw new Error('Top airing fetch failed');
    const data = await res.json();
    const airing = data.data?.topAiring || [];

    return airing.map((item: any) => ({
      id: item.id,
      anilistId: item.anilistId,
      slug: item.slug,
      title: item.title,
      synopsis: item.synopsis || '',
      poster: item.poster,
      rating: parseFloat(item.rating) || 9.1,
      quality: 'HD',
      type: 'TV',
      duration: item.duration || '24m',
      year: 2024,
      status: 'Ongoing',
      genres: item.genres || ['Action'],
      studios: item.studios || [],
      totalEpisodes: item.totalEpisodes || 12,
    }));
  }

  public async getLatestEpisodes(): Promise<AnimeItem[]> {
    const res = await fetch('/api/hianime/home');
    if (!res.ok) throw new Error('Latest episodes fetch failed');
    const data = await res.json();
    const list = data.data?.latestEpisode || [];

    return list.map((item: any) => ({
      id: item.id,
      title: item.title,
      synopsis: 'New episode recently broadcast in HD.',
      poster: item.poster,
      rating: 8.8,
      quality: 'HD',
      type: 'TV',
      duration: '24m',
      year: 2024,
      status: 'Ongoing',
      genres: ['Action'],
      studios: [],
      totalEpisodes: item.latestEp || 12,
    }));
  }

  public async search(query: string, page = 1): Promise<{ results: AnimeItem[]; total: number }> {
    const res = await fetch(`/api/hianime/search?keyword=${encodeURIComponent(query)}&page=${page}`);
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const data = await res.json();
    const results = (data.results || []).map((item: any) => ({
      id: item.id,
      anilistId: item.anilistId,
      slug: item.id,
      title: item.title,
      altTitle: item.alternativeTitle,
      synopsis: 'Search result from streaming library.',
      poster: item.poster,
      rating: parseFloat(item.rating) || 8.9,
      quality: (item.quality as any) || 'HD',
      type: (item.type as any) || 'TV',
      duration: item.duration || '24m',
      year: 2024,
      status: 'Ongoing',
      genres: item.genres || ['Action'],
      studios: [],
      totalEpisodes: item.episodes?.sub || 12,
      subEpisodes: item.episodes?.sub || 12,
      dubEpisodes: item.episodes?.dub || 10,
    }));

    return { results, total: data.totalResults || results.length };
  }

  public async getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster: string; rating: number }>> {
    const res = await fetch(`/api/hianime/suggestion?keyword=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      poster: r.poster,
      rating: parseFloat(r.rating) || 9.0,
    }));
  }

  public async getAnimeDetails(id: string): Promise<AnimeItem | null> {
    const res = await fetch(`/api/hianime/anime/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.data;
    if (!data) return null;

    return {
      id: data.id,
      anilistId: data.anilistId,
      slug: data.id,
      title: data.title,
      altTitle: data.alternativeTitle,
      synopsis: data.synopsis,
      poster: data.poster,
      rating: parseFloat(data.rating) || 9.2,
      quality: data.quality || 'HD',
      type: data.type || 'TV',
      duration: data.duration || '24m',
      year: 2024,
      status: data.status === 'Completed' ? 'Completed' : 'Ongoing',
      genres: data.genres || ['Action', 'Fantasy'],
      studios: data.studios || ['ufotable'],
      totalEpisodes: data.totalEpisodes || 12,
    };
  }

  public async getEpisodes(id: string): Promise<AnimeEpisode[]> {
    const res = await fetch(`/api/hianime/episodes/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Episode fetch failed');
    const data = await res.json();
    return (data.episodes || []).map((ep: any) => ({
      id: ep.id,
      number: ep.episodeNumber,
      title: ep.title || `Episode ${ep.episodeNumber}`,
      isFiller: ep.isFiller === true,
      durationSeconds: 1440,
    }));
  }

  public async getServers(animeId: string, episodeNumber: number): Promise<{
    sub: StreamServerOption[];
    dub: StreamServerOption[];
    raw?: StreamServerOption[];
  }> {
    const res = await fetch(`/api/hianime/servers?id=${encodeURIComponent(animeId)}::ep=${episodeNumber}`);
    if (!res.ok) throw new Error('Servers fetch failed');
    const data = await res.json();

    const formatServer = (s: any, mode: StreamAudioMode): StreamServerOption => ({
      id: `${mode}-${s.index || s.name}`,
      name: s.name || `Server ${s.index}`,
      serverId: s.serverId || s.index || 1,
      type: mode,
      embedUrl: s.embedUrl,
      quality: '1080p Ultra HD',
      subtitle: s.subtitle,
      isPrimary: s.index === 1,
    });

    return {
      sub: (data.sub || []).map((s: any) => formatServer(s, 'sub')),
      dub: (data.dub || []).map((s: any) => formatServer(s, 'dub')),
      raw: (data.raw || []).map((s: any) => formatServer(s, 'raw')),
    };
  }

  public async getStreamSource(animeId: string, episodeNumber: number, serverId: number, audio: StreamAudioMode): Promise<StreamSourceResult> {
    const serverParam = serverId === 1 ? 'HD-1' : serverId === 2 ? 'HD-2' : serverId === 3 ? 'SB' : 'HD-1';
    const res = await fetch(`/api/hianime/stream?id=${encodeURIComponent(animeId)}::ep=${episodeNumber}&server=${serverParam}&type=${audio}`);
    
    if (res.ok) {
      const json = await res.json();
      const stream = json.stream;
      return {
        streamUrl: `/api/hianime/embed?id=${encodeURIComponent(animeId)}::ep=${episodeNumber}&server=${serverParam}&type=${audio}`,
        type: 'iframe',
        serverName: `Server ${serverId} (${serverParam})`,
        audioMode: audio,
        intro: stream?.intro || { start: 85, end: 175 },
        outro: stream?.outro || { start: 1320, end: 1410 },
        subtitles: stream?.subtitles || [{ lang: 'English', url: '', default: true }],
        variants: stream?.variants || [],
      };
    }

    // Direct fallback
    return {
      streamUrl: `/api/hianime/embed?id=${encodeURIComponent(animeId)}::ep=${episodeNumber}&server=${serverParam}&type=${audio}`,
      type: 'iframe',
      serverName: `Server ${serverId}`,
      audioMode: audio,
    };
  }

  public async getSchedules(): Promise<AiringScheduleItem[]> {
    const res = await fetch('/api/hianime/schedules');
    if (!res.ok) return [];
    const json = await res.json();
    return json.schedules || [];
  }
}
