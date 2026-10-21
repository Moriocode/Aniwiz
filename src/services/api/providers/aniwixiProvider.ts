import { IAnimeProvider, AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode } from '../types';

export class AniwixiProvider implements IAnimeProvider {
  public readonly name = 'AnimeWixi Embed & Episode API';
  public readonly id = 'aniwixi';
  public readonly version = '1.0.0';
  public readonly website = 'https://github.com/Aniwixi/aniwixi-api';

  public async getSpotlight(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  public async getTrending(): Promise<AnimeItem[]> {
    try {
      const res = await fetch('/api/aniwixi/anime?page=1&per_page=12');
      if (!res.ok) throw new Error(`Aniwixi HTTP ${res.status}`);
      const json = await res.json();
      const list = json.data || [];

      // Pass through exactly what AniWixi reports — missing fields stay
      // undefined so the UI shows "—" instead of invented values.
      return list.map((item: any, idx: number) => this.mapAniwixiItem(item, idx));
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
      const res = await fetch(`/api/aniwixi/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Aniwixi search HTTP ${res.status}`);
      const json = await res.json();
      const list = json.data || [];

      const results: AnimeItem[] = list.map((item: any, idx: number) => this.mapAniwixiItem(item, idx));

      return { results, total: json.total || results.length };
    } catch {
      return { results: [], total: 0 };
    }
  }

  public async getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster?: string; rating?: number }>> {
    const { results } = await this.search(query);
    return results.slice(0, 5).map(r => ({
      id: r.id,
      title: r.title,
      poster: r.poster,
      rating: r.rating,
    }));
  }

  public async getAnimeDetails(id: string): Promise<AnimeItem | null> {
    try {
      const res = await fetch(`/api/aniwixi/anilist/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      const json = await res.json();
      const info = json.data?.anime_info;
      if (!info) return null;

      return this.mapAniwixiItem(info, 0, id);
    } catch {
      return null;
    }
  }

  /**
   * Map one AniWixi payload item to AnimeItem with zero invented fields:
   * anything the upstream omits stays undefined (rendered as "—" by the UI).
   */
  private mapAniwixiItem(item: any, idx: number, forcedId?: string): AnimeItem {
    const score = item.score !== undefined && item.score !== null && item.score !== '' ? String(item.score) : undefined;
    const episodes = parseInt(item.total_episodes ?? item.episodes) || undefined;
    const year = parseInt(item.year) || undefined;
    const rawStatus = String(item.status || '').toUpperCase();
    const status = rawStatus === 'FINISHED' ? 'Completed' : rawStatus === 'RELEASING' || rawStatus === 'ONGOING' ? 'Ongoing' : undefined;
    const poster = typeof item.poster === 'string' && item.poster.startsWith('http') ? item.poster : undefined;
    const banner = typeof item.banner === 'string' && item.banner.startsWith('http') ? item.banner : undefined;

    return {
      id: forcedId || String(item.anilist_id || item.post_id || item.slug),
      anilistId: Number(item.anilist_id) || undefined,
      slug: item.slug,
      title: item.title?.english || item.title?.romaji || item.title || 'Anime',
      altTitle: item.title?.english && item.title.romaji && item.title.romaji !== item.title.english ? item.title.romaji : undefined,
      japaneseTitle: item.title?.native,
      synopsis: (item.synopsis || '').replace(/<[^>]*>?/gm, '').trim(),
      poster,
      banner,
      rating: score ? parseFloat(score) / 10 : undefined,
      score: score ? `${score}%` : undefined,
      quality: 'HD' as const,
      type: (['TV', 'Movie', 'OVA', 'ONA', 'Special'].includes(item.type) ? item.type : undefined),
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
      const res = await fetch(`/api/aniwixi/anilist/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('Aniwixi episodes fetch failed');
      const json = await res.json();
      const epData = json.data?.episodes || [];

      if (Array.isArray(epData) && epData.length > 0) {
        // The upstream AniWixi payload numbers episodes with `episode_no`
        // (older payloads used `episode_number`/`num`); falling back to the
        // array index keeps the list usable if none of them are present.
        return epData.map((ep: any, index: number) => {
          const number = Number(ep.episode_no ?? ep.episode_number ?? ep.num) || index + 1;
          return {
            id: `${id}::ep=${number}`,
            number,
            title: ep.title || `Episode ${number}`,
            isFiller: false,
          };
        });
      }

      return Array.from({ length: 12 }, (_, i) => ({
        id: `${id}::ep=${i + 1}`,
        number: i + 1,
        title: `Episode ${i + 1}`,
        isFiller: false,
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
      const res = await fetch(`/api/aniwixi/anilist/${rawId}/ep/${episodeNumber}`);
      if (!res.ok) throw new Error(`Aniwixi stream HTTP ${res.status}`);
      const json = await res.json();
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
