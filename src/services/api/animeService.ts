import { AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode, AiringScheduleItem, IAnimeProvider } from './types';
import { toHiResImage } from './imageQuality';
import { providerRegistry } from './providerRegistry';
import { AniListProvider } from './providers/anilistProvider';
import { fetchAniListMediaByIds, requestAniListData } from './anilistClient';
import { requestAniwixi } from './aniwixiClient';
import { AniwixiProvider } from './providers/aniwixiProvider';
import { AniPulseProvider } from './providers/aniPulseProvider';
import { OpenAnimeProvider } from './providers/openAnimeProvider';
import { AllanimeProvider } from './providers/allanimeProvider';

// Register the LIVE providers only. HiAnime/AniKoto/Anivexa/ANIME-API were
// removed: their local endpoints served hardcoded placeholder data (fake
// catalogs, stock images, demo streams) instead of real upstream responses.
// The cascade is now AniList -> AniWixi -> OpenAnime — every entry backed by
// a real upstream.
providerRegistry.register(new AniListProvider(), true);
providerRegistry.register(new AniPulseProvider());
providerRegistry.register(new AniwixiProvider());
// Optional self-hosted Open Anime API instance (see /api/openanime/* proxy).
// Registered last: when no instance is running the proxy fails fast and the
// cascade simply skips it.
providerRegistry.register(new OpenAnimeProvider());
// Optional self-hosted Allanime API instance (mdtahseen7/Allanime-api, see
// the /api/allanime/* proxy). Registered last: with no instance running the
// proxy answers 504 fast and the cascade skips it.
providerRegistry.register(new AllanimeProvider());

class AnimeService {
  private memoryCache: Map<string, AnimeItem> = new Map();
  private spotlightCache: AnimeItem[] = [];
  private trendingCache: AnimeItem[] = [];

  /**
   * Run a list-returning operation across every registered provider until one
   * returns a non-empty result (AniList first, then AniWixi, OpenAnime).
   * Empty arrays and thrown errors both advance the cascade.
   */
  /**
   * A single provider may hang for a long time when its host is blocked or
   * rate-limited on the viewer's network. Capping each attempt keeps the whole
   * cascade (and therefore first paint) bounded.
   */
  private static readonly PROVIDER_TIMEOUT_MS = 6500;
  /**
   * Hard ceiling for one full provider cascade (every provider combined), so
   * a network where all upstreams hang resolves in seconds instead of a
   * provider-count multiple of the per-attempt timeout.
   */
  private static readonly CASCADE_BUDGET_MS = 10000;

  private withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = AnimeService.PROVIDER_TIMEOUT_MS): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
      promise.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  }

  /**
   * Shared cascade runner: tries providers in order (AniList first), with a
   * per-attempt timeout AND a whole-cascade deadline. Returns null once every
   * provider failed or the budget ran out.
   */
  private async executeBounded<T>(
    operationName: string,
    run: (provider: IAnimeProvider) => Promise<T | null | undefined>,
    preferredProviderId: string
  ): Promise<T | null> {
    const deadline = Date.now() + AnimeService.CASCADE_BUDGET_MS;
    try {
      const result = await providerRegistry.executeWithFallback<T>(
        operationName,
        async (provider) => {
          const remaining = deadline - Date.now();
          if (remaining <= 0) {
            // Budget spent — stop trying further providers.
            throw new Error(`${operationName} cascade budget exhausted`);
          }
          try {
            const value = await this.withTimeout(
              run(provider),
              `${provider.id}.${operationName}`,
              Math.min(AnimeService.PROVIDER_TIMEOUT_MS, remaining)
            );
            return value ?? null;
          } catch (err) {
            if (Date.now() >= deadline) throw err;
            return null;
          }
        },
        preferredProviderId
      );
      return result ?? null;
    } catch (err) {
      console.warn(`[AnimeService] ${operationName} failed across all providers:`, err);
      return null;
    }
  }

  private async cascadeList(
    operationName: string,
    run: (provider: IAnimeProvider) => Promise<AnimeItem[] | null | undefined>
  ): Promise<AnimeItem[]> {
    const items = await this.executeBounded<AnimeItem[]>(
      operationName,
      async (provider) => {
        const result = await run(provider);
        return Array.isArray(result) && result.length > 0 ? result : null;
      },
      'anilist'
    );
    return items || [];
  }

  /**
   * Upgrade every image URL on an item to the high-definition `hd-4` CDN
   * rendition (see imageQuality.ts). Single choke point: spotlight, trending,
   * search and details all flow through here, so no low-res `hd-1` poster can
   * reach the grid, hero banner or detail views.
   */
  private withHiResImages<T extends { poster?: string; banner?: string }>(item: T): T {
    return {
      ...item,
      poster: toHiResImage(item.poster),
      banner: toHiResImage(item.banner),
    };
  }

  /**
   * In-flight catalogue request. The spotlight banner and the trending grid are
   * loaded together on first paint; sharing one promise means the provider
   * cascade runs once instead of twice (which used to double every request).
   */
  private catalogPromise: Promise<AnimeItem[]> | null = null;

  /**
   * Fetch Spotlight Releases — the leading titles of the live catalogue, so the
   * banner and the grid always come from a single provider round-trip.
   */
  public async getSpotlight(): Promise<AnimeItem[]> {
    if (this.spotlightCache.length > 0) return this.spotlightCache;
    const catalog = await this.getTrending();
    if (catalog.length > 0) this.spotlightCache = catalog.slice(0, 10);
    return this.spotlightCache;
  }

  /**
   * Fetch Trending Anime (live cascade across all registered providers)
   */
  public async getTrending(): Promise<AnimeItem[]> {
    if (this.trendingCache.length > 0) return this.trendingCache;

    if (!this.catalogPromise) {
      this.catalogPromise = (async () => {
        const items = await this.cascadeList('getTrending', (provider) => provider.getTrending());
        const enriched = await this.enrichCatalogMetadata(items);
        if (enriched.length > 0) {
          this.trendingCache = enriched.map(a => this.withHiResImages(a));
          this.trendingCache.forEach(a => this.memoryCache.set(String(a.id), a));
        }
        return this.trendingCache;
      })().finally(() => {
        this.catalogPromise = null;
      });
    }

    return this.catalogPromise;
  }

  /**
   * Fill in artwork and metadata for providers with sparse listings.
   *
   * AniWixi answers `poster: false` and omits format/score/runtime for many
   * titles, which used to leave the grid full of letter tiles and "—" rows.
   * Every item carries its `anilist_id`, so one batched AniList lookup fills in
   * posters, ratings, type, runtime, status, genres and studios. Best effort and
   * time-boxed: when AniList is unreachable the catalogue still renders.
   */
  private async enrichCatalogMetadata(items: AnimeItem[]): Promise<AnimeItem[]> {
    if (items.length === 0) return items;

    const missingArtwork = items.filter((a) => !a.poster).length;
    const missingType = items.filter((a) => !a.type).length;
    const needsEnrichment =
      missingArtwork >= Math.max(1, Math.ceil(items.length * 0.2)) ||
      missingType >= Math.max(3, Math.ceil(items.length * 0.5));
    if (!needsEnrichment) return items;

    const ids = [...new Set(items.map((a) => Number(a.anilistId)).filter((id) => Number.isFinite(id) && id > 0))];
    if (ids.length === 0) return items;

    const batches: number[][] = [];
    for (let i = 0; i < ids.length && batches.length < 3; i += 50) {
      batches.push(ids.slice(i, i + 50));
    }

    let records: Map<number, AnimeItem>;
    try {
      const lookups = await this.withTimeout(
        Promise.all(batches.map((batch) => fetchAniListMediaByIds(batch))),
        'anilist.enrich',
        2500
      );
      records = new Map();
      lookups.forEach((map) => map.forEach((value, key) => records.set(key, value)));
    } catch {
      return items;
    }

    for (const anime of items) {
      const full = anime.anilistId ? records.get(Number(anime.anilistId)) : undefined;
      if (!full) continue;

      if (!anime.poster && full.poster) anime.poster = full.poster;
      if (!anime.banner && full.banner) anime.banner = full.banner;
      if (anime.rating == null && full.rating != null) anime.rating = full.rating;
      if (!anime.score && full.score) anime.score = full.score;
      if (!anime.type && full.type) anime.type = full.type;
      if (!anime.duration && full.duration) anime.duration = full.duration;
      if (!anime.status && full.status) anime.status = full.status;
      if (!anime.year && full.year) anime.year = full.year;
      if (!anime.synopsis && full.synopsis) anime.synopsis = full.synopsis;
      if ((!anime.genres || anime.genres.length === 0) && full.genres?.length) anime.genres = full.genres;
      if (anime.studios.length === 0 && full.studios?.length) anime.studios = full.studios;
      if (!anime.totalEpisodes && full.totalEpisodes) anime.totalEpisodes = full.totalEpisodes;
    }

    return items;
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

    const rawResults = await this.cascadeList('search', async (provider) => {
      const outcome = await provider.search(q, page);
      return outcome?.results || [];
    });

    const results = rawResults.map(a => this.withHiResImages(a));
    results.forEach((a: AnimeItem) => this.memoryCache.set(String(a.id), a));
    return { results, total: results.length };
  }

  /**
   * Autocomplete Suggestions
   */
  public async getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster?: string; rating?: number }>> {
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
    const rawId = String(id);

    // The catalog load already cached every visible title — never pay a
    // provider cascade for data we hold in memory.
    const cached = this.memoryCache.get(rawId);
    if (cached) return cached;

    // Provider-minted ids resolve through their own provider directly —
    // digits scraped out of an opaque Allanime id would hit a random AniList
    // title instead of the requested show.
    if (rawId.startsWith('allanime:')) {
      const details = await new AllanimeProvider().getAnimeDetails(rawId);
      if (details) this.memoryCache.set(rawId, details);
      return details;
    }

    const cleanId = rawId.replace(/[^0-9]/g, '');

    if (cleanId) {
      const details = await this.cascadeDetails(cleanId);
      if (details) return details;
    }

    // If ID is not numeric, search by title/slug
    const { results } = await this.search(rawId, 1);
    return results[0] || null;
  }

  /** Cascade details lookups across all providers, caching what resolves. */
  private async cascadeDetails(id: string): Promise<AnimeItem | null> {
    return this.executeBounded<AnimeItem>(
      'getAnimeDetails',
      async (provider) => {
        const details = await provider.getAnimeDetails(id);
        if (!details) return null;
        const upgraded = this.withHiResImages(details);
        this.memoryCache.set(String(upgraded.id), upgraded);
        return upgraded;
      },
      'anilist'
    );
  }

  /**
   * Real Episode List
   */
  public async getEpisodes(id: string): Promise<AnimeEpisode[]> {
    const details = await this.getAnimeDetails(id);
    const count = details?.totalEpisodes;

    // Allanime-minted ids list real episode numbers from the upstream.
    if (String(id).startsWith('allanime:')) {
      try {
        const eps = await new AllanimeProvider().getEpisodes(String(id));
        if (eps && eps.length > 0) return eps;
      } catch {}
    }

    // Check if Aniwixi has exact episode metadata — only for purely numeric
    // (AniList-keyed) ids; slug ids would resolve to an unrelated title.
    try {
      const cleanId = String(id).replace(/[^0-9]/g, '');
      if (/^\d+$/.test(String(id)) && cleanId) {
        const aniwixi = new AniwixiProvider();
        const eps = await aniwixi.getEpisodes(cleanId);
        if (eps && eps.length > 0) return eps;
      }
    } catch {}

    // AniPulse (AnimeAPI) ids are its own slugs — ask it for real episode data
    // (fails fast and skips the source when the proxy is not configured).
    if (!/^\d+$/.test(String(id))) {
      try {
        const eps = await new AniPulseProvider().getEpisodes(String(id));
        if (eps && eps.length > 0) return eps;
      } catch {}
    }

    // No known episode count -> honest empty list (the UI shows "No episodes
    // available"); we never invent a 12-episode catalog. With a real count,
    // sequential numbering is structural metadata, not fabricated content.
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

  /**
   * Real Multi-API Streaming Servers
   */
  public async getServers(animeId: string, episodeNumber: number): Promise<{
    sub: StreamServerOption[];
    dub: StreamServerOption[];
    raw?: StreamServerOption[];
  }> {
    const details = await this.getAnimeDetails(animeId);
    const resolvedId = details?.anilistId || await this.resolveAnilistIdForStream(details, String(animeId));
    // No resolvable AniList id -> no server URLs (a digits-from-slug guess
    // would silently stream a different anime).
    if (resolvedId == null) return { sub: [], dub: [] };
    const anilistId = String(resolvedId);
    const openAnime = await this.getOpenAnimeServerOption();
    const allAnime = await this.getAllAnimeServerOption();

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
          id: 'server-aniraku',
          name: 'Server 3: AniRaku (Direct HLS)',
          serverId: 3,
          type: 'sub',
          embedUrl: `/api/aniraku/stream?animeId=${anilistId}&episode=${episodeNumber}&lang=sub`,
        },
        {
          id: 'server-shonen',
          name: 'Server 4: Shonen',
          serverId: 4,
          type: 'sub',
          embedUrl: `https://shonen.to/embed/anilist/${anilistId}/${episodeNumber}?language=sub&parentOrigin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`,
        },
        ...(allAnime ? [allAnime] : []),
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
          id: 'server-aniraku-dub',
          name: 'Server 3: AniRaku (Dub)',
          serverId: 3,
          type: 'dub',
          embedUrl: `/api/aniraku/stream?animeId=${anilistId}&episode=${episodeNumber}&lang=dub`,
        },
        {
          id: 'server-shonen-dub',
          name: 'Server 4: Shonen (Dub)',
          serverId: 4,
          type: 'dub',
          embedUrl: `https://shonen.to/embed/anilist/${anilistId}/${episodeNumber}?language=dub&parentOrigin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`,
        },
        ...(allAnime ? [{ ...allAnime, id: 'server-allanime-dub', type: 'dub' as StreamAudioMode }] : []),
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
   * The self-hosted Allanime API instance (mdtahseen7/Allanime-api) is
   * optional too. Probe it (cheaply, once per short window) and only offer
   * Server 5 when it actually answers — the picker never shows a dead entry
   * on machines without it.
   */
  private allAnimeProbe: { at: number; reachable: boolean } | null = null;

  private async getAllAnimeServerOption(): Promise<StreamServerOption | null> {
    const now = Date.now();
    if (!this.allAnimeProbe || now - this.allAnimeProbe.at > 30_000) {
      let reachable = false;
      try {
        // __probe always answers 200 with { reachable } — no failing
        // same-origin request when no instance is running.
        const res = await fetch('/api/allanime/__probe');
        if (res.ok) reachable = Boolean((await res.json().catch(() => null))?.reachable);
      } catch {
        reachable = false;
      }
      this.allAnimeProbe = { at: now, reachable };
    }
    if (!this.allAnimeProbe.reachable) return null;

    return {
      id: 'server-allanime',
      name: 'Server 5: Allanime (Direct)',
      serverId: 5,
      type: 'sub',
      embedUrl: '/api/allanime/play',
      isPrimary: false,
    };
  }

  /** title -> AniList id resolution cache (keyed by catalog item id). */
  private anilistIdByItem = new Map<string, number>();

  /**
   * Resolve the AniList id that every stream server URL needs.
   *
   * Providers without native AniList ids (e.g. AniPulse, whose ids are its own
   * slugs) must NOT fall back to digits scraped out of the slug — that
   * silently streams a different anime. We resolve by exact title match
   * against the live AniWixi search and cache the result; purely numeric ids
   * (AniList-keyed catalogs) pass through. Returns undefined when nothing
   * resolves so callers can surface an honest "no source" state.
   */
  private async resolveAnilistIdForStream(details: AnimeItem | null, animeId: string): Promise<number | undefined> {
    if (details?.anilistId) return details.anilistId;
    if (/^\d+$/.test(animeId)) return Number(animeId) || undefined;

    const cacheKey = String(details?.id || animeId);
    const cached = this.anilistIdByItem.get(cacheKey);
    if (cached) return cached;

    const title = (details?.title || '').trim();
    if (!title) return undefined;
    const wanted = title.toLowerCase();
    const wantedAlt = (details?.altTitle || '').trim().toLowerCase();

    try {
      const json = await requestAniwixi<any>(`search?q=${encodeURIComponent(title)}`);
      const items = Array.isArray(json?.data) ? json.data : [];
      const match = items.find((it: any) => {
        const en = String(it?.title?.english || '').trim().toLowerCase();
        const ro = String(it?.title?.romaji || '').trim().toLowerCase();
        return (en && (en === wanted || en === wantedAlt)) || (ro && (ro === wanted || ro === wantedAlt));
      });
      const id = Number(match?.anilist_id) || undefined;
      if (id) {
        this.anilistIdByItem.set(cacheKey, id);
        if (details) details.anilistId = id;
        return id;
      }
    } catch {}
    return undefined;
  }

  /**
   * Real Stream Source Resolver (Zero Fake Intros, Zero Mock Videos)
   */
  public async getStreamSource(animeId: string, episodeNumber: number, serverId: number, audio: StreamAudioMode): Promise<StreamSourceResult> {
    const rawId = String(animeId);
    // Catalog titles are already cached in memory — never block the player on
    // a provider cascade just to rebuild ids we already have.
    const details = this.memoryCache.get(rawId) || null;
    const slug = details?.slug || (details?.title ? details.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'anime');

    if (serverId === 6) {
      // Self-hosted Open Anime API — resolves a fresh link per episode
      return new OpenAnimeProvider().getStreamSource(details?.title || slug, episodeNumber, 6, audio);
    }

    if (serverId === 5) {
      // Self-hosted Allanime — resolves a per-episode media URL by title
      // (exact-match first, so a sequel never streams in place of its
      // target). The resolver URL answers { ok, url, playUrl }; the native
      // player handles both playlists (hls.js) and direct files (Range
      // proxy), so `type: 'hls'` routes it through that path.
      const resolverUrl = await new AllanimeProvider().resolveEpisodeResolverUrl(details?.title || slug, episodeNumber, audio);
      return {
        streamUrl: resolverUrl,
        type: 'hls',
        serverName: 'Server 5: Allanime (Direct)',
        audioMode: audio,
        embeddable: true,
      };
    }

    // Every remaining server builds its URL from a real AniList id — resolve
    // it (title match via live AniWixi search for non-AniList catalogs) and
    // fail honestly instead of streaming an unrelated anime.
    const resolved = details?.anilistId || await this.resolveAnilistIdForStream(details, rawId);
    if (resolved == null) {
      throw new Error(`No stream source: no AniList id resolves for "${details?.title || rawId}".`);
    }
    const anilistId = String(resolved);

    if (serverId === 3) {
      // AniRaku — the public Aniraku API resolves a direct HLS source that the
      // native <video> player plays (no iframe, so no embed can refuse framing).
      // The local middleware endpoint answers { ok, url, type, name }.
      return {
        streamUrl: `/api/aniraku/stream?animeId=${anilistId}&episode=${episodeNumber}&lang=${audio}`,
        type: 'hls',
        serverName: 'Server 3: AniRaku (Direct HLS)',
        audioMode: audio,
        embeddable: true,
      };
    }

    if (serverId === 4) {
      // Shonen — hosted player embed (github.com/EKSDEEf/shonen-embed).
      // Verified live: loads in ~1.3s and streams postMessage events
      // (sourcechange/captionchange/play/progress) to the parent.
      // parentOrigin must exactly match this page's origin.
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return {
        streamUrl: `https://shonen.to/embed/anilist/${anilistId}/${episodeNumber}?language=${audio}&parentOrigin=${encodeURIComponent(origin)}`,
        type: 'iframe',
        serverName: 'Server 4: Shonen',
        audioMode: audio,
        embeddable: true,
      };
    }

    // Legacy server id 5 (Multi-Mirror) was removed: its page refuses to be
    // framed. Unknown legacy ids land on server 1 rather than a dead player.
    let streamUrl = '';
    let serverName = '';

    if (serverId === 2) {
      // VidStreaming / AniPM
      streamUrl = `https://ani.pm/embed/ani/${anilistId}/${episodeNumber}/${audio}`;
      serverName = 'Server 2: VidStreaming HD';
    } else {
      // AnimeWixi Live Embed — the player_data lookup picks the canonical
      // embed (incl. dub track) but is capped at 3s so a slow or blocked
      // AnimeWixi API can never stall the iframe behind a spinner.
      const controller = new AbortController();
      const probeTimer = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(`/api/aniwixi/anilist/${anilistId}/ep/${episodeNumber}`, { signal: controller.signal });
        if (res.ok) {
          const json = await res.json();
          const p = json.data?.player_data;
          if (p?.embed_url_en || p?.embed_url) {
            streamUrl = audio === 'dub' && p.embed_url_short_en ? p.embed_url_short_en : (p.embed_url || p.embed_url_short);
          }
        }
      } catch {}
      clearTimeout(probeTimer);
      if (!streamUrl) {
        streamUrl = `https://aniwixi.xyz/embed/${anilistId}/${episodeNumber}${audio === 'dub' ? '?lang=en' : ''}`;
      }
      serverName = 'Server 1: AnimeWixi (Embed HD)';
    }

    return {
      streamUrl,
      type: 'iframe',
      serverName,
      audioMode: audio,
      embeddable: true,
      // No fake intro/outro timestamps! Only provided if real metadata exists.
    };
  }

  /**
   * Real Weekly Airing Schedules (Live from AniList AiringSchedule GraphQL)
   */
  public async getSchedules(): Promise<AiringScheduleItem[]> {
    // Source 1: AniList AiringSchedule GraphQL (posters + AniList ids).
    // requestAniListData queries AniList directly (works on static hosts) and
    // falls back to the cached /api/anilist/schedule proxy.
    try {
      const now = Math.floor(Date.now() / 1000);
      const data = await requestAniListData(
        `query ($now: Int) {
          Page(page: 1, perPage: 24) {
            airingSchedules(airingAt_greater: $now, sort: TIME) {
              id
              airingAt
              episode
              media {
                id
                title { romaji english native }
                coverImage { extraLarge large medium }
                format
              }
            }
          }
        }`,
        { now },
        '/api/anilist/schedule'
      );

      const schedules: any[] = data?.Page?.airingSchedules || [];
      if (schedules.length > 0) {
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
      console.warn('[AnimeService] AniList AiringSchedule fetch failed:', e);
    }

    // Source 2: no other live schedule upstream is configured — return an
    // honest empty list (never fabricated entries) so the UI can say so.
    console.warn('[AnimeService] Airing schedule unavailable: the AniList schedule source failed or returned no data.');
    return [];
  }

}

export const animeService = new AnimeService();
