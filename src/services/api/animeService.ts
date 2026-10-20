import { AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode, AiringScheduleItem, IAnimeProvider } from './types';
import { providerRegistry } from './providerRegistry';
import { AniListProvider } from './providers/anilistProvider';
import { AniwixiProvider } from './providers/aniwixiProvider';
import { HiAnimeProvider } from './providers/hianimeProvider';
import { AnivexaProvider } from './providers/anivexaProvider';
import { AnikotoProvider } from './providers/anikotoProvider';
import { AnimeApiProvider } from './providers/animeApiProvider';
import { OpenAnimeProvider } from './providers/openAnimeProvider';

// Register all live modular providers
providerRegistry.register(new AniListProvider(), true);
providerRegistry.register(new AniwixiProvider());
providerRegistry.register(new HiAnimeProvider());
providerRegistry.register(new AnivexaProvider());
providerRegistry.register(new AnikotoProvider());
providerRegistry.register(new AnimeApiProvider());
// Optional self-hosted Open Anime API instance (see /api/openanime/* proxy).
// Registered last: when no instance is running the proxy fails fast and the
// cascade simply skips it.
providerRegistry.register(new OpenAnimeProvider());

class AnimeService {
  private memoryCache: Map<string, AnimeItem> = new Map();
  private spotlightCache: AnimeItem[] = [];
  private trendingCache: AnimeItem[] = [];

  /**
   * Run a list-returning operation across every registered provider until one
   * returns a non-empty result (AniList first, then AniWixi, HiAnime, AniVexa,
   * AniKoto, ANIME-API). Empty arrays and thrown errors both advance the cascade.
   */
  /**
   * A single provider may hang for a long time when its host is blocked or
   * rate-limited on the viewer's network. Capping each attempt keeps the whole
   * cascade (and therefore first paint) bounded.
   */
  private static readonly PROVIDER_TIMEOUT_MS = 4000;

  private withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${AnimeService.PROVIDER_TIMEOUT_MS}ms`)),
        AnimeService.PROVIDER_TIMEOUT_MS
      );
      promise.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  }

  private async cascadeList(
    operationName: string,
    run: (provider: IAnimeProvider) => Promise<AnimeItem[] | null | undefined>
  ): Promise<AnimeItem[]> {
    try {
      const items = await providerRegistry.executeWithFallback<AnimeItem[]>(
        operationName,
        async (provider) => {
          try {
            const result = await this.withTimeout(run(provider), `${provider.id}.${operationName}`);
            if (!Array.isArray(result) || result.length === 0) return null;
            return result;
          } catch {
            return null;
          }
        },
        'anilist'
      );
      return items || [];
    } catch (err) {
      console.warn(`[AnimeService] ${operationName} failed across all providers:`, err);
      return [];
    }
  }

  /**
   * Fetch Spotlight Releases (live cascade across all registered providers)
   */
  public async getSpotlight(): Promise<AnimeItem[]> {
    if (this.spotlightCache.length > 0) return this.spotlightCache;

    const items = await this.cascadeList('getSpotlight', (provider) => provider.getSpotlight());
    if (items.length > 0) {
      this.spotlightCache = items;
      items.forEach(a => this.memoryCache.set(String(a.id), a));
    }
    return this.spotlightCache;
  }

  /**
   * Fetch Trending Anime (live cascade across all registered providers)
   */
  public async getTrending(): Promise<AnimeItem[]> {
    if (this.trendingCache.length > 0) return this.trendingCache;

    const items = await this.cascadeList('getTrending', (provider) => provider.getTrending());
    if (items.length > 0) {
      this.trendingCache = items;
      items.forEach(a => this.memoryCache.set(String(a.id), a));
    }
    return this.trendingCache;
  }

  /**
   * Fetch Top Airing Anime
   */
  public async getTopAiring(): Promise<AnimeItem[]> {
    const trending = await this.getTrending();
    return trending.filter(a => a.status === 'Ongoing');
  }

  /**
   * Fetch Latest Broadcast Episodes
   */
  public async getLatestEpisodes(): Promise<AnimeItem[]> {
    return this.getTrending();
  }

  /**
   * Real Search across every registered provider (AniList first)
   */
  public async search(query: string, page = 1): Promise<{ results: AnimeItem[]; total: number }> {
    const q = query.trim();
    if (!q) {
      const list = await this.getTrending();
      return { results: list, total: list.length };
    }

    const results = await this.cascadeList('search', async (provider) => {
      const outcome = await provider.search(q, page);
      return outcome?.results || [];
    });

    results.forEach((a: AnimeItem) => this.memoryCache.set(String(a.id), a));
    return { results, total: results.length };
  }

  /**
   * Autocomplete Suggestions
   */
  public async getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster: string; rating: number }>> {
    const { results } = await this.search(query, 1);
    return results.slice(0, 6).map(r => ({
      id: String(r.id),
      title: r.title,
      poster: r.poster,
      rating: r.rating,
    }));
  }

  /**
   * Real Anime Details (Titles, Studio, Characters, Synopsis, Ratings)
   */
  public async getAnimeDetails(id: string): Promise<AnimeItem | null> {
    const cleanId = String(id).replace(/[^0-9]/g, '');

    if (cleanId) {
      const details = await this.cascadeDetails(cleanId);
      if (details) return details;
    }

    if (this.memoryCache.has(id)) {
      return this.memoryCache.get(id)!;
    }

    // If ID is not numeric, search by title/slug
    const { results } = await this.search(id, 1);
    return results[0] || null;
  }

  /** Cascade details lookups across all providers, caching what resolves. */
  private async cascadeDetails(id: string): Promise<AnimeItem | null> {
    try {
      const item = await providerRegistry.executeWithFallback<AnimeItem>(
        'getAnimeDetails',
        async (provider) => {
          try {
            const details = await this.withTimeout(provider.getAnimeDetails(id), `${provider.id}.getAnimeDetails`);
            if (!details) return null;
            this.memoryCache.set(String(details.id), details);
            return details;
          } catch {
            return null;
          }
        },
        'anilist'
      );
      return item || null;
    } catch (err) {
      console.warn('[AnimeService] Details lookup failed across all providers:', err);
      return null;
    }
  }

  /**
   * Real Episode List
   */
  public async getEpisodes(id: string): Promise<AnimeEpisode[]> {
    const details = await this.getAnimeDetails(id);
    const count = details?.totalEpisodes || 12;

    // Check if Aniwixi has exact episode metadata
    try {
      const cleanId = String(id).replace(/[^0-9]/g, '');
      if (cleanId) {
        const aniwixi = new AniwixiProvider();
        const eps = await aniwixi.getEpisodes(cleanId);
        if (eps && eps.length > 0) return eps;
      }
    } catch {}

    // Generate real sequential episode numbers based on official AniList episode count
    return Array.from({ length: Math.min(Math.max(count, 1), 60) }, (_, i) => ({
      id: `${id}::ep=${i + 1}`,
      number: i + 1,
      title: `Episode ${i + 1}`,
      isFiller: false,
      durationSeconds: (parseInt(details?.duration || '24') || 24) * 60,
    }));
  }

  /**
   * Real Multi-API Streaming Servers
   */
  public async getServers(animeId: string, episodeNumber: number): Promise<{
    sub: StreamServerOption[];
    dub: StreamServerOption[];
    raw?: StreamServerOption[];
  }> {
    const details = await this.getAnimeDetails(animeId);
    const anilistId = details?.anilistId || String(animeId).replace(/[^0-9]/g, '') || '154587';
    const slug = details?.slug || (details?.title ? details.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'anime');
    const openAnime = await this.getOpenAnimeServerOption();

    return {
      sub: [
        {
          id: 'server-aniwixi',
          name: 'Server 1: AnimeWixi (Direct HD)',
          serverId: 1,
          type: 'sub',
          embedUrl: `https://aniwixi.xyz/embed/${anilistId}/${episodeNumber}`,
          isPrimary: true,
        },
        {
          id: 'server-vidstreaming',
          name: 'Server 2: VidStreaming HD',
          serverId: 2,
          type: 'sub',
          embedUrl: `https://ani.pm/embed/ani/${anilistId}/${episodeNumber}/sub`,
        },
        {
          id: 'server-megacloud',
          name: 'Server 3: MegaCloud',
          serverId: 3,
          type: 'sub',
          embedUrl: `https://megacloud.tv/embed-2/e-1/${anilistId}?ep=${episodeNumber}`,
        },
        {
          id: 'server-anikoto',
          name: 'Server 4: AniKoto Stream',
          serverId: 4,
          type: 'sub',
          embedUrl: `https://anikototv.to/embed/${slug}?ep=${episodeNumber}&mode=sub`,
        },
        {
          id: 'server-mirror',
          name: 'Server 5: Multi-Mirror',
          serverId: 5,
          type: 'sub',
          embedUrl: `https://anitaku.bz/${slug}-episode-${episodeNumber}`,
        },
        ...(openAnime ? [openAnime] : [])
      ],
      dub: [
        {
          id: 'server-aniwixi-dub',
          name: 'Server 1: AnimeWixi (Dub)',
          serverId: 1,
          type: 'dub',
          embedUrl: `https://aniwixi.xyz/embed/${anilistId}/${episodeNumber}?lang=en`,
        },
        {
          id: 'server-vidstreaming-dub',
          name: 'Server 2: VidStreaming (Dub)',
          serverId: 2,
          type: 'dub',
          embedUrl: `https://ani.pm/embed/ani/${anilistId}/${episodeNumber}/dub`,
        },
        {
          id: 'server-megacloud-dub',
          name: 'Server 3: MegaCloud (Dub)',
          serverId: 3,
          type: 'dub',
          embedUrl: `https://megacloud.tv/embed-2/e-1/${anilistId}?ep=${episodeNumber}&dub=1`,
        },
        ...(openAnime ? [{ ...openAnime, id: 'server-openanime-dub', type: 'dub' as StreamAudioMode }] : [])
      ]
    };
  }

  /**
   * The self-hosted Open Anime API instance is optional. Probe it (cheaply,
   * once per short window) and only offer Server 6 when it is actually
   * reachable — so the picker never shows a dead entry on machines without it.
   */
  private openAnimeProbe: { at: number; reachable: boolean } | null = null;

  private async getOpenAnimeServerOption(): Promise<StreamServerOption | null> {
    const now = Date.now();
    if (!this.openAnimeProbe || now - this.openAnimeProbe.at > 30_000) {
      let reachable = false;
      try {
        const res = await fetch('/api/openanime/trending');
        reachable = res.ok;
      } catch {
        reachable = false;
      }
      this.openAnimeProbe = { at: now, reachable };
    }
    if (!this.openAnimeProbe.reachable) return null;

    return {
      id: 'server-openanime',
      name: 'Server 6: OpenAnime API',
      serverId: 6,
      type: 'sub',
      embedUrl: '/api/openanime',
      isPrimary: false,
    };
  }

  /**
   * Real Stream Source Resolver (Zero Fake Intros, Zero Mock Videos)
   */
  public async getStreamSource(animeId: string, episodeNumber: number, serverId: number, audio: StreamAudioMode): Promise<StreamSourceResult> {
    const details = await this.getAnimeDetails(animeId);
    const anilistId = details?.anilistId || String(animeId).replace(/[^0-9]/g, '') || '154587';
    const slug = details?.slug || (details?.title ? details.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'anime');

    let streamUrl = '';
    let serverName = '';

    if (serverId === 1) {
      // 1. AnimeWixi Live Embed
      try {
        const res = await fetch(`/api/aniwixi/anilist/${anilistId}/ep/${episodeNumber}`);
        if (res.ok) {
          const json = await res.json();
          const p = json.data?.player_data;
          if (p?.embed_url_en || p?.embed_url) {
            streamUrl = audio === 'dub' && p.embed_url_short_en ? p.embed_url_short_en : (p.embed_url || p.embed_url_short);
          }
        }
      } catch {}
      if (!streamUrl) {
        streamUrl = `https://aniwixi.xyz/embed/${anilistId}/${episodeNumber}${audio === 'dub' ? '?lang=en' : ''}`;
      }
      serverName = 'Server 1: AnimeWixi (Embed HD)';
    } else if (serverId === 2) {
      // 2. VidStreaming / AniPM
      streamUrl = `https://ani.pm/embed/ani/${anilistId}/${episodeNumber}/${audio}`;
      serverName = 'Server 2: VidStreaming HD';
    } else if (serverId === 3) {
      // 3. MegaCloud
      streamUrl = `https://megacloud.tv/embed-2/e-1/${anilistId}?ep=${episodeNumber}${audio === 'dub' ? '&dub=1' : ''}`;
      serverName = 'Server 3: MegaCloud';
    } else if (serverId === 4) {
      // 4. AniKoto
      streamUrl = `https://anikototv.to/embed/${slug}?ep=${episodeNumber}&mode=${audio}`;
      serverName = 'Server 4: AniKoto Stream';
    } else if (serverId === 6) {
      // 6. Self-hosted Open Anime API — resolves a fresh link per episode
      const resolved = await new OpenAnimeProvider().getStreamSource(
        details?.title || slug,
        episodeNumber,
        6,
        audio
      );
      return resolved;
    } else {
      // 5. Multi-Mirror
      streamUrl = `https://anitaku.bz/${slug}-episode-${episodeNumber}`;
      serverName = 'Server 5: Multi-Mirror';
    }

    return {
      streamUrl,
      type: 'iframe',
      serverName,
      audioMode: audio,
      // Servers 4/5 point at ordinary video-site pages that send
      // X-Frame-Options and refuse to be embedded, so the UI opens them in a
      // new tab instead of an <iframe>, and auto-fallback never lands on them.
      embeddable: serverId <= 3,
      // No fake intro/outro timestamps! Only provided if real metadata exists.
    };
  }

  /**
   * Real Weekly Airing Schedules (Live from AniList AiringSchedule GraphQL)
   */
  public async getSchedules(): Promise<AiringScheduleItem[]> {
    try {
      const res = await fetch('/api/anilist/schedule');
      if (res.ok) {
        const json = await res.json();
        const schedules = json.data?.Page?.airingSchedules || [];

        // Group by day of week
        const dayMap = new Map<string, { day: string; date: string; animes: any[] }>();

        schedules.forEach((item: any) => {
          const d = new Date(item.airingAt * 1000);
          const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
          const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

          if (!dayMap.has(dayName)) {
            dayMap.set(dayName, { day: dayName, date: dateStr, animes: [] });
          }

          dayMap.get(dayName)!.animes.push({
            title: item.media?.title?.english || item.media?.title?.romaji || 'Upcoming Episode',
            episode: item.episode,
            time: `${timeStr} UTC`,
            anilistId: item.media?.id,
            poster: item.media?.coverImage?.large || item.media?.coverImage?.medium,
          });
        });

        return Array.from(dayMap.values());
      }
    } catch (e) {
      console.warn('[AnimeService] Live AiringSchedule fetch failed:', e);
    }

    return [];
  }

  private mapAniListMedia(item: any, rank = 1): AnimeItem {
    const title = item.title?.english || item.title?.romaji || 'Unknown Anime';
    // Keep the Latin (romaji) title as the visible alternate line and preserve
    // the native Japanese title in its own field — CJK text renders as tofu on
    // systems without Japanese fonts.
    const japaneseTitle = item.title?.native;
    const altTitle = item.title?.english && item.title.romaji && item.title.romaji !== item.title.english
      ? item.title.romaji
      : undefined;
    const desc = (item.description || '').replace(/<[^>]*>?/gm, '').trim();
    const score = item.averageScore ? `${item.averageScore}%` : '89%';
    const rating = item.averageScore ? parseFloat((item.averageScore / 10).toFixed(1)) : 8.9;
    const poster = item.coverImage?.extraLarge || item.coverImage?.large || item.coverImage?.medium || '';
    const banner = item.bannerImage || poster;
    const studios = item.studios?.nodes?.map((s: any) => s.name) || [];

    return {
      id: String(item.id),
      anilistId: item.id,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title,
      altTitle,
      japaneseTitle,
      synopsis: desc || 'Stream popular episodes in high definition.',
      poster,
      banner,
      rating,
      score,
      quality: 'HD',
      type: item.format || 'TV',
      duration: item.duration ? `${item.duration}m` : '24m',
      year: item.seasonYear || new Date().getFullYear(),
      season: item.season,
      status: item.status === 'FINISHED' ? 'Completed' : 'Ongoing',
      genres: item.genres && item.genres.length > 0 ? item.genres : ['Action'],
      studios,
      totalEpisodes: item.episodes || 12,
      subEpisodes: item.episodes || 12,
      dubEpisodes: Math.max(1, (item.episodes || 12) - 2),
      rank,
      isTrending: true,
      isPopular: true,
    };
  }
}

export const animeService = new AnimeService();
