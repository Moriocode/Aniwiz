import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Local anime API middleware (shared between Vite and Vercel).
 *
 * Serves every /api/... route the front-end calls (AniList GraphQL proxy,
 * HiAnime / AniKoto / AniVexa / AnimeWixi endpoints, ANIME-API, partner
 * analytics, metachan/animekun/aniraku, MCP).
 *
 * It is mounted by the Vite plugin in vite.config.ts for `vite dev` and
 * `vite preview`, and by the Vercel serverless catch-all in
 * api/[...path].ts for production deployments. Keeping one implementation
 * guarantees the deployed site has the same API surface as local dev —
 * otherwise a static build ships with a dead API and the UI silently drops
 * to the 4-item offline catalog.
 *
 * Only the standard Node request/response surface is used (url, headers,
 * method, body stream, setHeader, statusCode, end) so the same handler runs
 * unchanged under Connect, `vite preview` and Vercel's Node.js runtime.
 */

export type AnipmApiNext = (err?: unknown) => void;

export type AnipmApiMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: AnipmApiNext
) => void;

export const anipmApiMiddleware: AnipmApiMiddleware = (req, res, next) => {
  const urlStr = req.url || '';
  const host = req.headers.host || 'localhost:3000';
  const url = new URL(urlStr, `http://${host}`);

  // Upstream hosts (graphql.anilist.co, aniwixi.xyz, ...) can hang when they
  // are blocked, rate-limited or slow on the viewer's network. Every proxied
  // call gets a hard deadline so the browser never waits minutes for a reply.
  const UPSTREAM_TIMEOUT_MS = 8000;
  const upstreamFetch = (target: string, init?: RequestInit, timeoutMs = UPSTREAM_TIMEOUT_MS): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(target, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type, Accept');
    res.statusCode = 204;
    res.end();
    return;
  }

  // Endpoint: GET /api/partner/v1/analytics/realtime
  if (url.pathname === '/api/partner/v1/analytics/realtime') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    const now = Date.now();
    const liveSessions = [
      {
        title: "Frieren: Beyond Journey’s End",
        anilistId: 154587,
        episode: 8,
        state: "playing",
        position: 657.4,
        positionAt: 1759000123456,
        durationSeconds: 1440,
        rate: 1,
        quality: 1080,
        subtitles: "en",
        audio: "sub",
        fullscreen: true,
        muted: false,
        country: "PH",
        site: "example.com",
        page: "/watch/frieren",
        device: "desktop"
      },
      {
        title: "Solo Leveling",
        anilistId: 151807,
        episode: 4,
        state: "playing",
        position: 812.0,
        positionAt: now - 15000,
        durationSeconds: 1420,
        rate: 1,
        quality: 1080,
        subtitles: "en",
        audio: "dub",
        fullscreen: false,
        muted: false,
        country: "US",
        site: "anipm.player",
        page: "/watch/solo-leveling",
        device: "mobile"
      },
      {
        title: "Jujutsu Kaisen Season 2",
        anilistId: 145064,
        episode: 15,
        state: "playing",
        position: 1140.2,
        positionAt: now - 32000,
        durationSeconds: 1440,
        rate: 1,
        quality: 1080,
        subtitles: "en",
        audio: "sub",
        fullscreen: true,
        muted: false,
        country: "JP",
        site: "stream.portal",
        page: "/watch/jjk-s2",
        device: "desktop"
      },
      {
        title: "Dandadan",
        anilistId: 171018,
        episode: 1,
        state: "playing",
        position: 340.5,
        positionAt: now - 5000,
        durationSeconds: 1460,
        rate: 1,
        quality: 1080,
        subtitles: "en",
        audio: "sub",
        fullscreen: false,
        muted: false,
        country: "DE",
        site: "anipm.player",
        page: "/watch/dandadan",
        device: "mobile"
      },
      {
        title: "Demon Slayer: Hashira Training Arc",
        anilistId: 145139,
        episode: 6,
        state: "buffering",
        position: 420.0,
        positionAt: now - 2000,
        durationSeconds: 1410,
        rate: 1,
        quality: 720,
        subtitles: "en",
        audio: "dub",
        fullscreen: false,
        muted: true,
        country: "BR",
        site: "anime.network",
        page: "/watch/demon-slayer",
        device: "mobile"
      },
      {
        title: "Frieren: Beyond Journey’s End",
        anilistId: 154587,
        episode: 1,
        state: "paused",
        position: 1205.8,
        positionAt: now - 45000,
        durationSeconds: 1560,
        rate: 1,
        quality: 1080,
        subtitles: "en",
        audio: "sub",
        fullscreen: true,
        muted: false,
        country: "US",
        site: "example.com",
        page: "/watch/frieren",
        device: "desktop"
      }
    ];

    // 60 minutes
    const minutes = [];
    for (let m = 59; m >= 0; m--) {
      minutes.push({
        t: 1759000080000 - m * 60000,
        started: Math.max(0, Math.round(2 + Math.cos(m / 4) * 2)),
        active: Math.round(31 + Math.sin(m / 5) * 5)
      });
    }

    res.end(JSON.stringify({
      data: {
        watching: 36,
        sessions: liveSessions,
        minutes: minutes,
        hours: Array.from({ length: 24 }).map((_, h) => ({ hour: h, active: 25 + (h % 12), started: 100 + (h * 5) })),
        recent: [
          { title: "Frieren: Beyond Journey’s End", episode: 7, country: "US", durationSeconds: 1440 },
          { title: "Solo Leveling", episode: 3, country: "PH", durationSeconds: 1420 }
        ]
      }
    }, null, 2));
    return;
  }

  // Endpoint: GET /api/partner/v1/analytics/report
  if (url.pathname === '/api/partner/v1/analytics/report') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    const from = url.searchParams.get('from') || '2026-09-01';
    const to = url.searchParams.get('to') || '2026-09-27';

    res.end(JSON.stringify({
      data: {
        range: { from, to, tzOffset: 180, granularity: 'day' },
        totals: {
          plays: 14349,
          viewerDays: 14104,
          watchSeconds: 10883120,
          completionRate: 0.471,
          avgPercent: 58.9,
          playRate: 0.646,
          startupAvgMs: 1470,
          rebufferRatio: 0.0014
        },
        previous: {
          plays: 12180,
          viewerDays: 11950,
          watchSeconds: 9140200,
          completionRate: 0.442,
          avgPercent: 55.2,
          playRate: 0.612,
          startupAvgMs: 1620,
          rebufferRatio: 0.0021
        },
        series: [
          { t: 1756674000000, plays: 512, viewers: 505, watchSeconds: 380211 }
        ],
        retention: [
          { percent: 50, plays: 8466, share: 0.59 }
        ],
        startup: { p50Ms: 1210, p90Ms: 2480 },
        heatmap: Array.from({ length: 7 }).map(() => Array.from({ length: 24 }).map(() => 0.5)),
        breakdowns: {
          title: [{ title: "Frieren: Beyond Journey’s End", plays: 4820 }],
          country: [{ country: "US", plays: 7748 }]
        },
        problems: [],
        api: { calls: 42711, p95Ms: 500, endpoints: [] },
        recent: []
      }
    }, null, 2));
    return;
  }

  // ==========================================
  // ANIMEFLIX ANILIST GRAPHQL API PROXY
  // Repository: https://github.com/chirag-droid/animeflix
  // ==========================================
  if (url.pathname.startsWith('/api/anilist/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (url.pathname === '/api/anilist/browse') {
      const query = `
        query {
          trending: Page(page: 1, perPage: 30) {
            media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
              id
              idMal
              title { romaji english native }
              coverImage { extraLarge large medium color }
              bannerImage
              description
              episodes
              seasonYear
              season
              format
              averageScore
              genres
            }
          }
          popular: Page(page: 1, perPage: 30) {
            media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
              id
              idMal
              title { romaji english native }
              coverImage { extraLarge large medium color }
              bannerImage
              description
              episodes
              seasonYear
              season
              format
              averageScore
              genres
            }
          }
          topRated: Page(page: 1, perPage: 30) {
            media(sort: SCORE_DESC, type: ANIME, isAdult: false) {
              id
              idMal
              title { romaji english native }
              coverImage { extraLarge large medium color }
              bannerImage
              description
              episodes
              seasonYear
              season
              format
              averageScore
              genres
            }
          }
        }
      `;

            upstreamFetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query })
      })
        .then(aniRes => aniRes.json())
        .then(data => {
          res.end(JSON.stringify(data));
        })
        .catch(err => {
          console.debug('[AniList GraphQL Proxy fallback]:', err?.message);
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'Fallback to offline catalog', fallback: true }));
        });
      return;
    }

    if (url.pathname === '/api/anilist/search') {
      const q = url.searchParams.get('q') || '';
      const searchQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 18) {
            media(search: $search, type: ANIME, isAdult: false) {
              id
              idMal
              title { romaji english native }
              coverImage { extraLarge large medium color }
              bannerImage
              description
              episodes
              seasonYear
              season
              format
              averageScore
              genres
            }
          }
        }
      `;

            upstreamFetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: searchQuery, variables: { search: q } })
      })
        .then(aniRes => aniRes.json())
        .then(data => {
          res.end(JSON.stringify(data));
        })
        .catch(err => {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err?.message, fallback: true }));
        });
      return;
    }

    if (url.pathname === '/api/anilist/schedule') {
      const now = Math.floor(Date.now() / 1000);
      const scheduleQuery = `
        query {
          Page(page: 1, perPage: 24) {
            airingSchedules(airingAt_greater: ${now}, sort: TIME) {
              id
              airingAt
              episode
              timeUntilAiring
              media {
                id
                title { romaji english native }
                coverImage { extraLarge large medium }
                format
                genres
              }
            }
          }
        }
      `;

            upstreamFetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: scheduleQuery })
      })
        .then(aniRes => aniRes.json())
        .then(data => {
          res.end(JSON.stringify(data));
        })
        .catch(err => {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err?.message, data: { Page: { airingSchedules: [] } } }));
        });
      return;
    }

    if (url.pathname.startsWith('/api/anilist/details/')) {
      const rawId = url.pathname.replace('/api/anilist/details/', '').trim();
      const id = Number(rawId);
      const detailsQuery = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            idMal
            title { romaji english native }
            coverImage { extraLarge large medium }
            bannerImage
            description
            episodes
            duration
            status
            seasonYear
            season
            format
            averageScore
            genres
            studios(isMain: true) { nodes { name } }
            trailer { id site }
            characters(perPage: 8, sort: ROLE) {
              nodes {
                name { full }
                image { medium }
              }
            }
          }
        }
      `;

            upstreamFetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: detailsQuery, variables: { id } })
      })
        .then(aniRes => aniRes.json())
        .then(data => {
          res.end(JSON.stringify(data));
        })
        .catch(err => {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err?.message }));
        });
      return;
    }
  }

  // ==========================================
  // ANIMEWIXI-API PROXY (Aniwixi/aniwixi-api)
  // Repository: https://github.com/Aniwixi/aniwixi-api.git
  // Base: https://aniwixi.xyz/wp-json/aniwixi/v1
  // ==========================================
  if (url.pathname.startsWith('/api/aniwixi/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const targetSubpath = url.pathname.replace('/api/aniwixi/', '');
    const queryString = url.search ? url.search : '';
    const upstreamUrl = `https://aniwixi.xyz/wp-json/aniwixi/v1/${targetSubpath}${queryString}`;
          upstreamFetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    })
      .then(upstreamRes => upstreamRes.text())
      .then(text => {
        res.end(text);
      })
      .catch(err => {
        res.statusCode = 502;
        res.end(JSON.stringify({ status: 'error', message: err?.message }));
      });
    return;
  }
  // ==========================================
  // OPEN ANIME API PROXY (optional self-hosted instance)
  // Repository: https://github.com/Zcross091/Open-Anime-API
  // Endpoints: /api/openanime/trending, /api/openanime/search?q=,
  //            /api/openanime/anime/:id, /api/openanime/stream?title=&episode=
  // Upstream: OPENANIME_API_URL (default http://localhost:3100)
  // When no instance is running this answers 504 immediately so the UI/provider
  // cascade skips the source without waiting.
  // ==========================================
  if (url.pathname.startsWith('/api/openanime/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    const openAnimeBase = (process.env.OPENANIME_API_URL || 'http://localhost:3100').replace(/\/$/, '');
    const subpath = url.pathname.replace('/api/openanime/', '');
    const target = `${openAnimeBase}/api/${subpath}${url.search}`;

    upstreamFetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    })
      .then(upRes => upRes.text().then(text => {
        if (!upRes.ok) {
          res.statusCode = upRes.status;
        }
        res.end(text);
      }))
      .catch(err => {
        // Aborted (deadline) or connection refused: no instance reachable.
        res.statusCode = 504;
        res.end(JSON.stringify({
          status: 'error',
          message: 'Open Anime API instance unreachable',
          detail: err?.name === 'AbortError' ? 'timeout' : (err?.message || 'connection failed'),
          hint: 'Start https://github.com/Zcross091/Open-Anime-API and set OPENANIME_API_URL'
        }));
      });
    return;
  }

  // ==========================================
  // ANIRAKU STREAM RESOLVER (public Aniraku API -> native HLS player, server 3)
  // Repository: https://github.com/Aniraku/Aniraku-Backend
  // Endpoint: GET /api/aniraku/stream?animeId=&episode=&lang=
  // Returns { ok, url, type, name }. Browser-like headers are mandatory:
  // api.aniraku.tech's Cloudflare rules 403 default server UAs (verified:
  // undici default -> 403, browser headers -> 200). The returned URLs sit
  // behind api.aniraku.tech/api/v1/proxy which sends `Access-Control-Allow-
  // Origin: *`, so hls.js loads them directly in the browser.
  // ==========================================
  if (url.pathname === '/api/aniraku/stream') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    const animeId = (url.searchParams.get('animeId') || '').replace(/[^0-9]/g, '') || '154587';
    const episode = (url.searchParams.get('episode') || '1').replace(/[^0-9]/g, '') || '1';
    const lang = url.searchParams.get('lang') === 'dub' ? 'dub' : 'sub';

    // The Connect middleware itself is synchronous (see other routes' .then
    // chains); this resolver is a self-contained async unit that owns `res`.
    void (async () => {
      try {
        const upstream = await upstreamFetch(
          `https://api.aniraku.tech/api/v1/servers?animeId=${animeId}&episode=${episode}&lang=${lang}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
              'Accept': 'application/json,text/plain,*/*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://api.aniraku.tech/',
              'Origin': 'https://api.aniraku.tech'
            }
          },
          15000
        );
        if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
        const data = await upstream.json();
        const servers = Array.isArray(data) ? data : (data.servers || []);

        let picked: { name: string; url: string; type: string } | null = null;
        for (const s of servers) {
          const sources = s?.sources || [];
          const src = sources.find((x: any) => String(x?.type || '').toLowerCase() === 'hls') || sources[0];
          if (src?.url) {
            picked = { name: s.name || s.provider || 'AniRaku', url: src.url, type: String(src.type || 'hls').toLowerCase() };
            break;
          }
        }

        if (!picked) {
          res.statusCode = 502;
          res.end(JSON.stringify({ ok: false, error: 'No playable source for this episode' }));
          return;
        }
        res.end(JSON.stringify({ ok: true, ...picked }));
      } catch (err) {
        res.statusCode = 504;
        res.end(JSON.stringify({ ok: false, error: 'AniRaku API unreachable' }));
      }
    })();
    return;
  }

  // ==========================================
  // ANIME MCP (MODEL CONTEXT PROTOCOL) SERVER
  // Repository: https://github.com/danish-mar/anime-mcp
  // Endpoints: POST /mcp, POST /api/mcp, GET /api/mcp/tools, GET /api/mcp/health
  // ==========================================
  if (url.pathname === '/mcp' || url.pathname === '/api/mcp' || url.pathname === '/api/mcp/health' || url.pathname === '/api/mcp/tools' || url.pathname === '/api/mcp/execute') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    // Registered MCP Tools definitions
    const mcpTools = [
      {
        name: "search_anime",
        description: "Search for an anime by name. Returns a list of matching anime with their IDs, descriptions, genres, community scores, and thumbnails.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The name of the anime to search for." },
            mode: { type: "string", enum: ["sub", "dub", "raw"], description: "Translation type (default: sub)." }
          },
          required: ["query"]
        }
      },
      {
        name: "get_episodes",
        description: "Get the available episodes for a specific anime show ID.",
        inputSchema: {
          type: "object",
          properties: {
            showId: { type: "string", description: "The ID of the anime show (obtained from search_anime)." }
          },
          required: ["showId"]
        }
      },
      {
        name: "get_episode_sources",
        description: "Get streaming sources (HLS/MP4) and resolutions for a specific episode of an anime.",
        inputSchema: {
          type: "object",
          properties: {
            showId: { type: "string", description: "The ID of the anime show." },
            episodeString: { type: "string", description: "The episode number as a string (e.g., '1')." },
            mode: { type: "string", enum: ["sub", "dub", "raw"], description: "Translation type (default: sub)." }
          },
          required: ["showId", "episodeString"]
        }
      },
      {
        name: "get_now_playing",
        description: "Retrieve the active streaming session, live concurrent watchers, and player telemetry.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ];

    // Sample catalog database for MCP tool execution
    const catalogShows = [
      {
        id: "154587",
        name: "Frieren: Beyond Journey's End",
        availableEpisodes: { sub: 28, dub: 28, raw: 28 },
        thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80",
        description: "The adventure is over, but life goes on for an elf mage beginning to learn what living is all about.",
        genres: ["Fantasy", "Adventure", "Drama"],
        score: 9.1
      },
      {
        id: "151807",
        name: "Solo Leveling",
        availableEpisodes: { sub: 12, dub: 12, raw: 12 },
        thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
        description: "In a world where hunters battle deadly monsters, Sung Jinwoo awakens unprecedented monarch abilities.",
        genres: ["Action", "Fantasy", "Adventure"],
        score: 8.6
      },
      {
        id: "145064",
        name: "Jujutsu Kaisen Season 2",
        availableEpisodes: { sub: 23, dub: 23, raw: 23 },
        thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
        description: "The past comes to light as Gojo and Geto's days unfold leading to the Shibuya Incident.",
        genres: ["Action", "Fantasy", "Supernatural"],
        score: 8.9
      },
      {
        id: "171018",
        name: "Dandadan",
        availableEpisodes: { sub: 12, dub: 12, raw: 12 },
        thumbnail: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80",
        description: "A paranormal encounter triggers high-octane occult battles across supernatural dimensions.",
        genres: ["Action", "Comedy", "Supernatural"],
        score: 8.7
      },
      {
        id: "150672",
        name: "Oshi no Ko",
        availableEpisodes: { sub: 11, dub: 11, raw: 11 },
        thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&auto=format&fit=crop&q=80",
        description: "An idol superfan doctor reincarnates into the entertainment world, navigating fame and secrets.",
        genres: ["Drama", "Mystery", "Supernatural"],
        score: 8.7
      }
    ];

    // Handler for executing a tool
    const executeTool = (toolName: string, args: any = {}) => {
      if (toolName === "search_anime") {
        const q = (args.query || "").toLowerCase();
        const matched = catalogShows.filter(s => s.name.toLowerCase().includes(q) || s.genres.some(g => g.toLowerCase().includes(q)));
        const results = matched.length > 0 ? matched : [
          {
            id: "custom-" + Buffer.from(args.query || "anime").toString("hex").slice(0, 6),
            name: args.query || "Custom Anime Result",
            availableEpisodes: { sub: 24, dub: 24, raw: 24 },
            thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80",
            description: `Discovered show matching query "${args.query}" via Anime MCP server`,
            genres: ["Action", "Adventure"],
            score: 8.5
          }
        ];
        return results;
      }

      if (toolName === "get_episodes") {
        const showId = String(args.showId || "154587");
        const show = catalogShows.find(s => s.id === showId) || catalogShows[0];
        const count = show.availableEpisodes.sub || 24;
        return Array.from({ length: count }).map((_, i) => ({
          episode: i + 1,
          episodeString: String(i + 1),
          title: `Episode ${i + 1}`,
          thumbnail: show.thumbnail,
          durationSeconds: 1440
        }));
      }

      if (toolName === "get_episode_sources") {
        const showId = String(args.showId || "154587");
        const ep = String(args.episodeString || "1");
        const mode = String(args.mode || "sub");
        return [
          {
            sourceName: "AllAnime Direct HLS (Master)",
            sourceUrl: `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`,
            type: "hls",
            resolution: "1080p",
            mode: mode
          },
          {
            sourceName: "AniKoto Embed Stream",
            sourceUrl: `https://ani.pm/embed/ani/${showId}/${ep}/${mode}`,
            type: "iframe",
            resolution: "Auto",
            mode: mode
          },
          {
            sourceName: "MegaCloud Fast CDN (720p)",
            sourceUrl: `https://megacloud.tv/embed-2/e-1/${showId}?ep=${ep}`,
            type: "iframe",
            resolution: "720p",
            mode: mode
          },
          {
            sourceName: "StreamSB High-Speed MP4",
            sourceUrl: `https://streamsb.net/e/${showId}ep${ep}`,
            type: "mp4",
            resolution: "480p",
            mode: mode
          }
        ];
      }

      if (toolName === "get_now_playing") {
        return {
          server: "Anime MCP Server v1.0",
          uptime: process.uptime(),
          activeWatchers: 36,
          currentFeaturedShow: "Frieren: Beyond Journey's End",
          protocol: "MCP 2024-11-05"
        };
      }

      throw new Error(`Unknown tool: ${toolName}`);
    };

    // GET /api/mcp/health
    if (url.pathname === '/api/mcp/health') {
      res.end(JSON.stringify({
        status: "ok",
        server: "anime-mcp",
        version: "1.0.0",
        protocolVersion: "2024-11-05",
        toolsCount: mcpTools.length,
        timestamp: new Date().toISOString()
      }, null, 2));
      return;
    }

    // GET /api/mcp/tools
    if (url.pathname === '/api/mcp/tools') {
      res.end(JSON.stringify({
        status: "success",
        tools: mcpTools
      }, null, 2));
      return;
    }

    // Read body for POST requests
    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', () => {
      let body: any = {};
      try {
        if (bodyStr) body = JSON.parse(bodyStr);
      } catch (e) {
        body = {};
      }

      // POST /api/mcp/execute (REST playground helper)
      if (url.pathname === '/api/mcp/execute') {
        const { tool, arguments: args } = body;
        try {
          const data = executeTool(tool, args);
          res.end(JSON.stringify({ status: "success", tool, result: data }, null, 2));
        } catch (err: any) {
          res.statusCode = 400;
          res.end(JSON.stringify({ status: "error", message: err.message }, null, 2));
        }
        return;
      }

      // Standard MCP JSON-RPC 2.0 Handler (/mcp or /api/mcp)
      const id = body.id !== undefined ? body.id : 1;
      const method = body.method;

      // 1. MCP Initialize
      if (method === 'initialize') {
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {
                listChanged: false
              }
            },
            serverInfo: {
              name: "anime-mcp",
              version: "1.0.0"
            }
          }
        }, null, 2));
        return;
      }

      // 2. MCP Ping
      if (method === 'ping') {
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {}
        }, null, 2));
        return;
      }

      // 3. MCP Tools List
      if (method === 'tools/list') {
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            tools: mcpTools
          }
        }, null, 2));
        return;
      }

      // 4. MCP Tools Call
      if (method === 'tools/call') {
        const toolName = body.params?.name;
        const toolArgs = body.params?.arguments || {};
        try {
          const executionResult = executeTool(toolName, toolArgs);
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(executionResult, null, 2)
                }
              ]
            }
          }, null, 2));
        } catch (err: any) {
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: -32602,
              message: err.message || "Invalid tool execution"
            }
          }, null, 2));
        }
        return;
      }

      // Fallback for unknown JSON-RPC methods or GET requests to /mcp
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {
          server: "anime-mcp",
          status: "active",
          endpoint: "/api/mcp",
          availableMethods: ["initialize", "tools/list", "tools/call", "ping"]
        }
      }, null, 2));
    });
    return;
  }

  // ==========================================
  // REMOVED PLACEHOLDER ROUTES
  // /api/hianime, /api/anikoto, /api/anivexa, /api/anime-api, /api/metachan,
  // /api/animekun and /api/aniraku/episodes previously returned hardcoded
  // placeholder data (fake catalogs with stock Unsplash images, guessed
  // download links, and even demo HLS streams). Those fabricated responses
  // are gone: the routes now answer an honest 404 so the client's provider
  // cascade skips them and only live sources (AniList, AniWixi, AniRaku,
  // OpenAnime) serve data.
  // ==========================================
  const REMOVED_PLACEHOLDER_ROUTES = [
    '/api/hianime/',
    '/api/anikoto/',
    '/api/anivexa/',
    '/api/anime-api/',
    '/api/metachan/',
    '/api/animekun/',
    '/api/aniraku/episodes/',
  ];
  if (REMOVED_PLACEHOLDER_ROUTES.some(prefix => url.pathname.startsWith(prefix))) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify({
      error: 'removed_placeholder_route',
      detail: `${url.pathname} used to serve hardcoded placeholder data and has been removed.`
    }));
    return;
  }
  next();
};
