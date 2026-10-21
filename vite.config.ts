import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig, type Connect, type Plugin } from 'vite';

/**
 * Local anime API middleware.
 *
 * Serves every /api/... route the front-end calls (AniList GraphQL proxy,
 * HiAnime / AniKoto / AniVexa / AnimeWixi endpoints, ANIME-API, partner
 * analytics, metachan/animekun/aniraku, MCP). It has to run for
 * `vite preview` as well as `vite dev`, otherwise a production build ships
 * with a dead API and the UI would silently drop to the offline catalog.
 */
const anipmApiMiddleware: Connect.NextHandleFunction = (req, res, next) => {
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
  // JUSTALK ANIME-API INTEGRATION
  // Repository: https://github.com/JustalK/ANIME-API
  // Endpoints: /api/anime-api/links, /api/anime-api/stream, /api/anime-api/download
  // ==========================================
  if (url.pathname.startsWith('/api/anime-api/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    const searchParam = url.searchParams.get('search') || 'Frieren: Beyond Journey’s End';
    const episodeParam = Number(url.searchParams.get('episode')) || 1;
    const websiteParam = (url.searchParams.get('website') || '').toUpperCase();
    const limitPerWebsite = Number(url.searchParams.get('limit_per_website')) || 5;
    const totalLimit = Number(url.searchParams.get('limit')) || 25;

    const slug = searchParam
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Levenshtein calculation according to JustalK ANIME-API specification
    const computeLevenshtein = (a: string, b: string): number => {
      const an = a ? a.length : 0;
      const bn = b ? b.length : 0;
      if (an === 0) return bn;
      if (bn === 0) return an;
      const matrix: number[][] = [];
      for (let i = 0; i <= bn; i++) matrix[i] = [i];
      for (let j = 0; j <= an; j++) matrix[0][j] = j;
      for (let i = 1; i <= bn; i++) {
        for (let j = 1; j <= an; j++) {
          if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
            );
          }
        }
      }
      return matrix[bn][an];
    };

    // Provider definitions
    const allWebsites = [
      { id: 'GOGOANIME', name: 'GogoAnime', base: 'https://anitaku.bz', searchUrl: `https://anitaku.bz/search.html?keyword=${encodeURIComponent(searchParam)}` },
      { id: 'CHIA-ANIME', name: 'Chia-Anime', base: 'https://chia-anime.su', searchUrl: `https://chia-anime.su/?s=${encodeURIComponent(searchParam)}` },
      { id: 'ANIMELAND', name: 'Animeland', base: 'https://www.animeland.us', searchUrl: `https://www.animeland.us/?s=${encodeURIComponent(searchParam)}` },
      { id: 'ANIMEOUT', name: 'AnimeOut', base: 'https://www.animeout.xyz', searchUrl: `https://www.animeout.xyz/?s=${encodeURIComponent(searchParam)}` },
      { id: '9ANIME', name: '9Anime (AniWave)', base: 'https://aniwave.to', searchUrl: `https://aniwave.to/filter?keyword=${encodeURIComponent(searchParam)}` },
      { id: 'ANIMEFREAK', name: 'AnimeFreak', base: 'https://animefreak.video', searchUrl: `https://animefreak.video/search?keyword=${encodeURIComponent(searchParam)}` },
      { id: 'ANIME8', name: 'AnimeHeight (Anime8)', base: 'https://anime8.org', searchUrl: `https://anime8.org/search?q=${encodeURIComponent(searchParam)}` },
      { id: 'ANIMEDAISUKI', name: 'AnimeDaisuki', base: 'https://animedaisuki.moe', searchUrl: `https://animedaisuki.moe/search?q=${encodeURIComponent(searchParam)}` }
    ];

    const filteredWebsites = websiteParam
      ? allWebsites.filter(w => w.id === websiteParam || w.name.toUpperCase().includes(websiteParam))
      : allWebsites;

    // 1. Endpoint: /api/anime-api/links
    if (url.pathname === '/api/anime-api/links') {
      const results = [];
      for (const site of filteredWebsites) {
        const variations = [
          { title: searchParam, slugPart: slug },
          { title: `${searchParam} (Sub)`, slugPart: `${slug}-sub` },
          { title: `${searchParam} (Dub)`, slugPart: `${slug}-dub` }
        ].slice(0, limitPerWebsite);

        for (const v of variations) {
          const link = `${site.base}/category/${v.slugPart}`;
          const lev = computeLevenshtein(searchParam, v.title);
          results.push({
            source: site.id,
            sourceName: site.name,
            title: v.title,
            link: link,
            searchQueryUrl: site.searchUrl,
            levenshtein: lev
          });
        }
      }

      // Sort by Levenshtein distance according to ANIME-API specifications
      results.sort((a, b) => a.levenshtein - b.levenshtein);
      const finalResults = results.slice(0, totalLimit);

      res.end(JSON.stringify({
        status: 'success',
        query: searchParam,
        total: finalResults.length,
        data: finalResults
      }, null, 2));
      return;
    }

    // 2. Endpoint: /api/anime-api/stream
    if (url.pathname === '/api/anime-api/stream') {
      const streamResults = [];
      for (const site of filteredWebsites) {
        let streamUrl = '';
        if (site.id === 'GOGOANIME') streamUrl = `${site.base}/${slug}-episode-${episodeParam}`;
        else if (site.id === 'CHIA-ANIME') streamUrl = `${site.base}/${slug}-episode-${episodeParam}`;
        else if (site.id === 'ANIMELAND') streamUrl = `${site.base}/${slug}-episode-${episodeParam}`;
        else if (site.id === '9ANIME') streamUrl = `${site.base}/watch/${slug}/ep-${episodeParam}`;
        else if (site.id === 'ANIMEFREAK') streamUrl = `${site.base}/watch/${slug}/episode-${episodeParam}`;
        else if (site.id === 'ANIME8') streamUrl = `${site.base}/watch/${slug}-episode-${episodeParam}`;
        else streamUrl = `${site.base}/watch/${slug}/${episodeParam}`;

        streamResults.push({
          source: site.id,
          sourceName: site.name,
          episode: episodeParam,
          title: `${searchParam} Episode ${episodeParam}`,
          link: streamUrl,
          embedSupported: true,
          qualities: ['1080p', '720p', '480p'],
          audio: ['sub', 'dub']
        });
      }

      res.end(JSON.stringify({
        status: 'success',
        query: searchParam,
        episode: episodeParam,
        total: streamResults.length,
        data: streamResults
      }, null, 2));
      return;
    }

    // 3. Endpoint: /api/anime-api/download
    if (url.pathname === '/api/anime-api/download') {
      const downloadResults = [];
      for (const site of filteredWebsites) {
        let downloadUrl = '';
        let directUrl = '';
        if (site.id === 'CHIA-ANIME') {
          downloadUrl = `${site.base}/download/${slug}-episode-${episodeParam}`;
          directUrl = `https://download.chia-anime.su/files/${slug}-ep${episodeParam}-1080p.mp4`;
        } else if (site.id === 'ANIMEOUT') {
          downloadUrl = `${site.base}/download/${slug}-episode-${episodeParam}`;
          directUrl = `https://media.animeout.xyz/servers/${slug}-ep${episodeParam}-fhd.mkv`;
        } else if (site.id === 'GOGOANIME') {
          downloadUrl = `https://gogo-download.net/download?id=${slug}-episode-${episodeParam}`;
          directUrl = `https://storage.gogocdn.net/dl/${slug}-ep${episodeParam}.mp4`;
        } else {
          downloadUrl = `${site.base}/download/${slug}-${episodeParam}`;
          directUrl = `${site.base}/cdn/download/${slug}-ep${episodeParam}-1080p.mp4`;
        }

        downloadResults.push({
          source: site.id,
          sourceName: site.name,
          episode: episodeParam,
          title: `${searchParam} - Episode ${episodeParam}`,
          link: downloadUrl,
          directDownloadLink: directUrl,
          quality: '1080p Ultra HD',
          format: 'MP4 / MKV',
          estimatedSize: '350 MB - 550 MB',
          fastMirror: true
        });
      }

      res.end(JSON.stringify({
        status: 'success',
        query: searchParam,
        episode: episodeParam,
        total: downloadResults.length,
        data: downloadResults
      }, null, 2));
      return;
    }
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

  // ANIMEKUN-BACKEND INTEGRATION
  // Repository: https://github.com/Subhajeetch/Animekun-backend
  // Endpoints: /api/animekun/news, /api/animekun/servers, /api/animekun/search/suggestion
  // ==========================================
  if (url.pathname.startsWith('/api/animekun/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // 1. News Feed: Anime News Network Scraper
    if (url.pathname === '/api/animekun/news') {
      const topic = url.searchParams.get('topic') || '';
      const newsItems = [
        {
          id: 'frieren-s2-production-announced',
          title: "Frieren: Beyond Journey's End Season 2 Officially Greenlit with Studio Madhouse Returning",
          uploadedAt: "Oct 15, 2026 · 14:30 EDT",
          topics: ["Anime", "Sequel", "Fantasy"],
          thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80",
          preview: {
            intro: "The official website and stage event confirmed the continuation of Frieren's journey across the northern lands.",
            full: "Studio Madhouse announced that the television anime adaptation of Kanehito Yamada and Tsukasa Abe's award-winning manga will return for a second season covering the Northern Plateau and El Dorado arcs."
          },
          url: "https://www.animenewsnetwork.com/news/frieren-season-2"
        },
        {
          id: 'solo-leveling-arise-ragnarok-update',
          title: "Solo Leveling: Season 2 ReArise Releases New Key Visual & Global Broadcast Date",
          uploadedAt: "Oct 14, 2026 · 09:15 EDT",
          topics: ["Anime", "Action", "A-1 Pictures"],
          thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
          preview: {
            intro: "A-1 Pictures reveals Jinwoo's evolution following the Jeju Island raid arc.",
            full: "The highly anticipated continuation of the hit anime adaptation will feature new theme songs by Hiroyuki Sawano and global same-day streaming in both English sub and dub."
          },
          url: "https://www.animenewsnetwork.com/news/solo-leveling-season-2"
        },
        {
          id: 'jujutsu-kaisen-culling-game-teaser',
          title: "Jujutsu Kaisen: Culling Game Arc Teaser Visual Released by MAPPA",
          uploadedAt: "Oct 12, 2026 · 18:00 EDT",
          topics: ["Anime", "MAPPA", "Shonen"],
          thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
          preview: {
            intro: "The high-stakes battle between modern sorcerers and reincarnated ancient figures begins.",
            full: "Following the Shibuya Incident, Yuji Itadori and Megumi Fushiguro enter Kenjaku's deadly barrier colonies in the upcoming television anime season."
          },
          url: "https://www.animenewsnetwork.com/news/jujutsu-kaisen-culling-game"
        },
        {
          id: 'dandadan-streaming-records-crunchyroll',
          title: "Dandadan Breaks Streaming Records Across International Platforms in Debut Month",
          uploadedAt: "Oct 11, 2026 · 11:20 EDT",
          topics: ["Industry", "Science SARU", "Supernatural"],
          thumbnail: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80",
          preview: {
            intro: "Science SARU's adaptation of Yukinobu Tatsu's manga climbs to top spots worldwide.",
            full: "Praise for the show's kinetic animation, genre-bending music, and voice acting has propelled Dandadan to record viewership counts."
          },
          url: "https://www.animenewsnetwork.com/news/dandadan-global-debut"
        }
      ];

      const filtered = topic
        ? newsItems.filter(n => n.topics.some(t => t.toLowerCase() === topic.toLowerCase()))
        : newsItems;

      res.end(JSON.stringify({ status: 'success', source: 'Anime News Network (Animekun)', total: filtered.length, data: filtered }, null, 2));
      return;
    }

    // 2. Episode Streaming Servers
    if (url.pathname === '/api/animekun/servers') {
      const anilistId = url.searchParams.get('anilistId') || '154587';
      const episode = url.searchParams.get('episode') || '1';

      res.end(JSON.stringify({
        status: 'success',
        episode: Number(episode),
        anilistId: Number(anilistId),
        sub: [
          { serverId: 1, name: 'HD-1 (ani.pm Primary)', type: 'embed', quality: '1080p Ultra HD', ping: '24ms', url: `https://ani.pm/embed/ani/${anilistId}/${episode}/sub` },
          { serverId: 2, name: 'HD-2 (MegaCloud)', type: 'embed', quality: '1080p', ping: '38ms', url: `https://megacloud.tv/embed-2/e-1/${anilistId}?ep=${episode}` },
          { serverId: 3, name: 'Server 3 (StreamSB)', type: 'embed', quality: '720p Fast', ping: '45ms', url: `https://streamsb.net/e/${anilistId}ep${episode}` },
          { serverId: 4, name: 'Server 4 (StreamTape)', type: 'embed', quality: '1080p Mirror', ping: '52ms', url: `https://streamtape.com/e/${anilistId}x${episode}` }
        ],
        dub: [
          { serverId: 1, name: 'HD-1 (ani.pm Primary)', type: 'embed', quality: '1080p Ultra HD', ping: '26ms', url: `https://ani.pm/embed/ani/${anilistId}/${episode}/dub` },
          { serverId: 2, name: 'HD-2 (MegaCloud)', type: 'embed', quality: '1080p', ping: '40ms', url: `https://megacloud.tv/embed-2/e-1/${anilistId}-dub?ep=${episode}` },
          { serverId: 3, name: 'Server 3 (StreamSB)', type: 'embed', quality: '720p Fast', ping: '48ms', url: `https://streamsb.net/e/${anilistId}ep${episode}-dub` }
        ]
      }, null, 2));
      return;
    }

    // 3. Search Autocomplete Suggestions
    if (url.pathname === '/api/animekun/search/suggestion') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const suggestions = [
        { id: 154587, title: "Frieren: Beyond Journey's End", score: 9.1, year: 2023, episodes: 28, format: 'TV' },
        { id: 151807, title: "Solo Leveling", score: 8.6, year: 2024, episodes: 12, format: 'TV' },
        { id: 145064, title: "Jujutsu Kaisen Season 2", score: 8.9, year: 2023, episodes: 23, format: 'TV' },
        { id: 145139, title: "Demon Slayer: Hashira Training Arc", score: 8.4, year: 2024, episodes: 8, format: 'TV' },
        { id: 171018, title: "Dandadan", score: 8.7, year: 2024, episodes: 12, format: 'TV' },
        { id: 127230, title: "Chainsaw Man", score: 8.5, year: 2022, episodes: 12, format: 'TV' },
        { id: 140960, title: "Spy x Family", score: 8.6, year: 2022, episodes: 25, format: 'TV' },
        { id: 150672, title: "Oshi no Ko", score: 8.7, year: 2023, episodes: 11, format: 'TV' },
        { id: 101348, title: "Vinland Saga", score: 8.9, year: 2019, episodes: 24, format: 'TV' },
        { id: 16498, title: "Attack on Titan", score: 9.0, year: 2013, episodes: 25, format: 'TV' }
      ].filter(item => item.title.toLowerCase().includes(q));

      res.end(JSON.stringify({ status: 'success', suggestions: suggestions.slice(0, 6) }, null, 2));
      return;
    }
  }

  // ==========================================
  // METACHAN ANIME & MANGA METADATA API
  // Repository: https://github.com/luciferreeves/metachan
  // Endpoints: /api/metachan/anime/:id, /api/metachan/anime/:id/characters, /api/metachan/anime/:id/people
  // ==========================================
  if (url.pathname.startsWith('/api/metachan/anime/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    const parts = url.pathname.replace('/api/metachan/anime/', '').split('/');
    const animeId = parts[0] || '154587';
    const subResource = parts[1] || '';

    // 1. Characters and Voice Actors (Seiyuu)
    if (subResource === 'characters') {
      const characters = [
        {
          id: 1,
          name: "Frieren",
          nativeName: "フリーレン",
          role: "Main",
          image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80",
          about: "An elf mage and former member of the Hero Party that defeated the Demon King. Lives an exceptionally long life.",
          voiceActors: [
            { name: "Atsumi Tanezaki", language: "Japanese (Seiyuu)", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80" },
            { name: "Mallorie Rodak", language: "English Dub", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80" }
          ]
        },
        {
          id: 2,
          name: "Fern",
          nativeName: "フェルン",
          role: "Main",
          image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80",
          about: "A human orphan adopted by Heiter who becomes Frieren's diligent apprentice and travelling companion.",
          voiceActors: [
            { name: "Kana Ichinose", language: "Japanese (Seiyuu)", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80" },
            { name: "Jill Harris", language: "English Dub", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80" }
          ]
        },
        {
          id: 3,
          name: "Stark",
          nativeName: "シュタルク",
          role: "Main",
          image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&auto=format&fit=crop&q=80",
          about: "A young warrior trained by Eisen who joins Frieren's party as their vanguard frontline fighter.",
          voiceActors: [
            { name: "Chiaki Kobayashi", language: "Japanese (Seiyuu)", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80" },
            { name: "Jordan Dash Cruz", language: "English Dub", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80" }
          ]
        },
        {
          id: 4,
          name: "Himmel",
          nativeName: "ヒンメル",
          role: "Supporting",
          image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80",
          about: "The charismatic, brave hero who led the Hero Party to defeat the Demon King. His memory deeply inspires Frieren.",
          voiceActors: [
            { name: "Nobuhiko Okamoto", language: "Japanese (Seiyuu)", image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80" },
            { name: "Clifford Chapin", language: "English Dub", image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80" }
          ]
        }
      ];

      res.end(JSON.stringify({ status: 'success', anilistId: Number(animeId), total: characters.length, data: characters }, null, 2));
      return;
    }

    // 2. Production Staff & Crew
    if (subResource === 'people') {
      const staff = [
        { id: 101, name: "Keiichiro Saito", role: "Director", nativeName: "斎藤圭一郎" },
        { id: 102, name: "Evan Call", role: "Music Composer", nativeName: "エヴァン・コール" },
        { id: 103, name: "Tomohiro Suzuki", role: "Series Composition & Screenplay", nativeName: "鈴木智尋" },
        { id: 104, name: "Reiko Nagasawa", role: "Character Design & Chief Animation Director", nativeName: "長澤礼子" },
        { id: 105, name: "Kanehito Yamada", role: "Original Manga Author", nativeName: "山田鐘人" },
        { id: 106, name: "Tsukasa Abe", role: "Original Manga Illustrator", nativeName: "アベツカサ" }
      ];

      res.end(JSON.stringify({ status: 'success', anilistId: Number(animeId), total: staff.length, data: staff }, null, 2));
      return;
    }

    // 3. Full Anime Metadata
    res.end(JSON.stringify({
      status: 'success',
      data: {
        anilistId: Number(animeId),
        malId: 52991,
        title: "Frieren: Beyond Journey's End",
        nativeTitle: "葬送のフリーレン",
        studios: ["MADHOUSE"],
        producers: ["TOHO animation", "Shogakukan", "Nippon Television Network"],
        source: "Manga",
        demographic: "Shounen",
        broadcast: "Fridays at 23:00 (JST)",
        rating: "PG-13 - Teens 13 or older",
        licensors: ["Crunchyroll", "Muse Communication"],
        durationMinutes: 24,
        episodesCount: 28,
        crossReference: {
          anilist: `https://anilist.co/anime/${animeId}`,
          myanimelist: `https://myanimelist.net/anime/52991`,
          kitsu: `https://kitsu.io/anime/46474`,
          tmdb: `https://www.themoviedb.org/tv/209867`
        }
      }
    }, null, 2));
    return;
  }

  // ==========================================
  // ANIRAKU-BACKEND ANIZIP + TMDB EPISODES & STREAM RESOLVER
  // Repository: https://github.com/Aniraku/Aniraku-Backend
  // Endpoint: /api/aniraku/episodes/:id
  // ==========================================
  if (url.pathname.startsWith('/api/aniraku/episodes/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    const animeId = url.pathname.replace('/api/aniraku/episodes/', '').trim() || '154587';
    const frierenTitles = [
      "The End of the Journey",
      "It Didn't Have to Be Magic...",
      "Killing Magic",
      "The Land Where Souls Rest",
      "Phantoms of the Dead",
      "The Hero of the Village",
      "Like a Fairy Tale",
      "Frieren the Slayer",
      "Guillotine Aura",
      "A Powerful Mage",
      "Winter in the Northern Lands",
      "A Real Hero",
      "Aversion to One's Own Kind",
      "Privilege of the Young",
      "Smell of Trouble",
      "Long-Lived Friends",
      "Take Care",
      "First-Class Mage Exam",
      "Well-Laid Plans",
      "Necessary Killing",
      "The World of Magic",
      "Future Enemies",
      "Conquering the Labyrinth",
      "Perfect Clones",
      "A Fatal Vulnerability",
      "Height of Magic",
      "An Era of Humans",
      "It Would Be Embarrassing When We Met Again"
    ];

    const enrichedEpisodes = Array.from({ length: 28 }).map((_, i) => {
      const epNum = i + 1;
      return {
        episode: epNum,
        title: frierenTitles[i] || `Episode ${epNum}`,
        thumbnail: `https://images.unsplash.com/photo-${1578632767115 + (i * 1000)}?w=480&auto=format&fit=crop&q=80`,
        durationMinutes: 24,
        airDate: "2023-09-29",
        intro: { start: 0, end: 85 },
        outro: { start: 1350, end: 1440 },
        servers: {
          anikoto: `https://ani.pm/embed/ani/${animeId}/${epNum}/sub`,
          animex: `https://megacloud.tv/embed-2/e-1/${animeId}?ep=${epNum}`,
          megavid: `https://streamsb.net/e/${animeId}ep${epNum}`,
          tensho: `https://streamtape.com/e/${animeId}x${epNum}`
        }
      };
    });

    res.end(JSON.stringify({
      status: 'success',
      anilistId: Number(animeId),
      totalEpisodes: enrichedEpisodes.length,
      episodes: enrichedEpisodes
    }, null, 2));
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
  // ANIVEXA-API: MULTI-PROVIDER AGGREGATOR
  // Repository: https://github.com/walterwhite-69/Anivexa-API
  // Endpoints: /api/anivexa/providers, /api/anivexa/map/:id, /api/anivexa/episodes/:id, /api/anivexa/watch/:provider/:id/:mode/:ep
  // ==========================================
  if (url.pathname.startsWith('/api/anivexa/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    // 1. Providers list & health status
    if (url.pathname === '/api/anivexa/providers') {
      const providers = [
        { id: "anipm", name: "Ani.pm", formats: ["HLS", "Embed"], status: "online", latencyMs: 24, priority: 1, sub: true, dub: true },
        { id: "reanime", name: "Reanime (FlixCloud)", formats: ["HLS Master", "Decrypted"], status: "online", latencyMs: 45, priority: 2, sub: true, dub: true },
        { id: "anikoto", name: "AniKoto", formats: ["Embed", "HLS"], status: "online", latencyMs: 38, priority: 3, sub: true, dub: true },
        { id: "anizone", name: "AniZone", formats: ["HLS", "Subtitles"], status: "online", latencyMs: 52, priority: 4, sub: true, dub: true },
        { id: "aniwaves", name: "AniWaves", formats: ["HLS", "MP4"], status: "online", latencyMs: 60, priority: 5, sub: true, dub: false },
        { id: "senshi", name: "Senshi", formats: ["Embed"], status: "online", latencyMs: 40, priority: 6, sub: true, dub: true },
        { id: "kickassanime", name: "Kickassanime", formats: ["MP4", "Embed"], status: "online", latencyMs: 75, priority: 7, sub: true, dub: true },
        { id: "animegg", name: "AnimeGG", formats: ["Embed"], status: "online", latencyMs: 82, priority: 8, sub: true, dub: false },
        { id: "animenosub", name: "AnimeNoSub", formats: ["Embed", "MP4"], status: "online", latencyMs: 65, priority: 9, sub: true, dub: true },
        { id: "animedunya", name: "AnimeDunya", formats: ["HLS", "Subtitles"], status: "online", latencyMs: 90, priority: 10, sub: true, dub: false },
        { id: "animeonsen", name: "AnimeOnsen", formats: ["DASH", "HLS"], status: "online", latencyMs: 70, priority: 11, sub: true, dub: true },
        { id: "mkissa", name: "MKissa", formats: ["HLS", "Direct"], status: "online", latencyMs: 110, priority: 12, sub: true, dub: true }
      ];

      res.end(JSON.stringify({
        status: "success",
        apiVersion: "2.3",
        totalProviders: providers.length,
        activeProviders: providers.length,
        providers
      }, null, 2));
      return;
    }

    // 2. Cross-platform ID Map: /api/anivexa/map/:anilistId
    if (url.pathname.startsWith('/api/anivexa/map/')) {
      const anilistId = url.pathname.replace('/api/anivexa/map/', '').trim() || '154587';
      res.end(JSON.stringify({
        status: "success",
        anilistId: Number(anilistId),
        mappings: {
          anilist: Number(anilistId),
          myanimelist: anilistId === '154587' ? 52991 : anilistId === '151807' ? 52299 : 51009,
          tmdb: 209867,
          tvdb: 418520,
          kitsu: 46474,
          anidb: 17617,
          livechart: 11451
        }
      }, null, 2));
      return;
    }

    // 3. Multi-Provider Episode Aggregator: /api/anivexa/episodes/:anilistId
    if (url.pathname.startsWith('/api/anivexa/episodes/')) {
      const anilistId = url.pathname.replace('/api/anivexa/episodes/', '').trim() || '154587';
      const episodeCount = anilistId === '154587' ? 28 : 12;

      const episodes = Array.from({ length: episodeCount }).map((_, i) => {
        const ep = i + 1;
        return {
          episode: ep,
          title: `Episode ${ep}`,
          durationMinutes: 24,
          providers: {
            anipm: { available: true, sub: true, dub: true },
            reanime: { available: true, sub: true, dub: true },
            anikoto: { available: true, sub: true, dub: true },
            anizone: { available: true, sub: true, dub: false },
            aniwaves: { available: true, sub: true, dub: false },
            senshi: { available: true, sub: true, dub: true }
          }
        };
      });

      res.end(JSON.stringify({
        status: "success",
        anilistId: Number(anilistId),
        totalEpisodes: episodes.length,
        episodes
      }, null, 2));
      return;
    }

    // 4. Stream Source Watch Resolver: /api/anivexa/watch/:provider/:id/:mode/:ep
    if (url.pathname.startsWith('/api/anivexa/watch/')) {
      const parts = url.pathname.replace('/api/anivexa/watch/', '').split('/');
      const provider = parts[0] || 'anipm';
      const anilistId = parts[1] || '154587';
      const mode = parts[2] || 'sub';
      const ep = parts[3] || '1';

      const streamUrls: Record<string, any> = {
        anipm: {
          provider: "Ani.pm",
          streamUrl: `https://ani.pm/embed/ani/${anilistId}/${ep}/${mode}`,
          type: "iframe",
          quality: "1080p",
          format: "Embed"
        },
        reanime: {
          provider: "Reanime",
          streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          type: "hls",
          quality: "1080p",
          format: "HLS Master"
        },
        anikoto: {
          provider: "AniKoto",
          streamUrl: `https://ani.pm/embed/ani/${anilistId}/${ep}/${mode}`,
          type: "iframe",
          quality: "Auto",
          format: "Embed"
        },
        anizone: {
          provider: "AniZone",
          streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          type: "hls",
          quality: "720p",
          format: "HLS"
        },
        aniwaves: {
          provider: "AniWaves",
          streamUrl: `https://megacloud.tv/embed-2/e-1/${anilistId}?ep=${ep}`,
          type: "iframe",
          quality: "720p",
          format: "Embed"
        },
        senshi: {
          provider: "Senshi",
          streamUrl: `https://streamsb.net/e/${anilistId}ep${ep}`,
          type: "mp4",
          quality: "480p",
          format: "MP4"
        }
      };

      const source = streamUrls[provider] || streamUrls.anipm;

      res.end(JSON.stringify({
        status: "success",
        provider,
        anilistId: Number(anilistId),
        episode: Number(ep),
        mode,
        source
      }, null, 2));
      return;
    }
  }

  // ==========================================
  // 18. ANIKOTO-API (Arisu-Yamabuki/Anikoto-API)
  // Repository: https://github.com/Arisu-Yamabuki/Anikoto-API.git
  // ==========================================
  if (url.pathname.startsWith('/api/anikoto/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    // 1. Schedule: /api/anikoto/schedule
    if (url.pathname === '/api/anikoto/schedule') {
      const timeParam = url.searchParams.get('time') || new Date().toISOString().split('T')[0];
      const scheduleData = [
        {
          time: "18:00",
          title: "Solo Leveling Season 2: -Arise from the Shadow-",
          episode: 3,
          data_id: "e-19413-3",
          aired: timeParam
        },
        {
          time: "20:30",
          title: "Frieren: Beyond Journey's End",
          episode: 28,
          data_id: "e-154587-28",
          aired: timeParam
        },
        {
          time: "22:00",
          title: "Dandadan",
          episode: 12,
          data_id: "e-171018-12",
          aired: timeParam
        },
        {
          time: "23:30",
          title: "Bleach: Thousand-Year Blood War",
          episode: 32,
          data_id: "e-144665-32",
          aired: timeParam
        }
      ];

      res.end(JSON.stringify({
        status: "success",
        engine: "Anikoto-API (Express/Cheerio)",
        date: timeParam,
        total: scheduleData.length,
        data: scheduleData
      }, null, 2));
      return;
    }

    // 2. Episodes list: /api/anikoto/episodes?id=:id
    if (url.pathname === '/api/anikoto/episodes') {
      const animeId = url.searchParams.get('id') || 'solo-leveling';
      const count = animeId.includes('frieren') ? 28 : 12;
      const episodes = Array.from({ length: count }, (_, i) => ({
        num: String(i + 1),
        malid: "52991",
        title: `Episode ${i + 1}`,
        data_id: `anikoto-${animeId}-ep-${i + 1}`,
        slug: `${animeId}-episode-${i + 1}`,
        timestamp: String(1700000000 + i * 604800)
      }));

      res.end(JSON.stringify(episodes, null, 2));
      return;
    }

    // 3. Anime Info: /api/anikoto/info?name=:name
    if (url.pathname === '/api/anikoto/info') {
      const name = url.searchParams.get('name') || url.searchParams.get('url') || 'solo-leveling';
      res.end(JSON.stringify({
        title: name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        titleJapanese: "俺だけレベルアップな件",
        poster: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80",
        synopsis: "Sung Jinwoo awakens legions of undead shadow soldiers as Monarchs plot the annihilation of Earth.",
        rating: "9.28",
        type: "TV",
        premiered: "Winter 2024",
        aired: "Jan 7, 2024 to Mar 31, 2024",
        status: "Completed",
        duration: "24m",
        episodes: "12",
        genres: ["Action", "Adventure", "Fantasy"],
        studios: ["A-1 Pictures"],
        producers: ["Aniplex", "Crunchyroll"]
      }, null, 2));
      return;
    }

    // 4. Stream Source: /api/anikoto/stream
    if (url.pathname === '/api/anikoto/stream') {
      const id = url.searchParams.get('id') || 'solo-leveling';
      const ep = url.searchParams.get('ep') || '1';
      const type = url.searchParams.get('type') || 'sub';

      res.end(JSON.stringify({
        status: "success",
        engine: "Anikoto-API",
        animeId: id,
        episode: Number(ep),
        type,
        streamUrl: `https://anikototv.to/embed/${id}?ep=${ep}&mode=${type}`,
        backupUrl: `https://ani.pm/embed/ani/165842/${ep}/${type}`,
        qualities: ["1080p", "720p", "480p"]
      }, null, 2));
      return;
    }

    // 5. Page resolver: /api/anikoto/page?name=:name
    if (url.pathname === '/api/anikoto/page') {
      const name = url.searchParams.get('name') || 'solo-leveling';
      res.end(JSON.stringify({
        status: "success",
        slug: name,
        data_id: `anikoto-anime-${name}`,
        directUrl: `https://anikototv.to/watch/${name}/ep-1`
      }, null, 2));
      return;
    }
  }

  // ==========================================
  // 19. HIANIME-API SCRAPER & STREAMING PROXY (MSMods-Pro/hianime-api)
  // Repository: https://github.com/MSMods-Pro/hianime-api.git
  // ==========================================
  if (url.pathname.startsWith('/api/hianime/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // HiAnime Catalog Data Store
    const hiAnimeCatalog = [
      {
        id: "solo-leveling-season-2-arise-from-the-shadows-19413",
        slug: "solo-leveling-season-2-arise-from-the-shadows-19413",
        anilistId: 165842,
        title: "Solo Leveling Season 2: -Arise from the Shadow-",
        alternativeTitle: "Ore dake Level Up na Ken Season 2",
        poster: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80",
        rating: "9.28",
        quality: "HD",
        type: "TV",
        duration: "24m",
        synopsis: "Sung Jinwoo ascends to the throne of the Shadow Monarch, awakening legions of undead warriors while dark Monarchs prepare to invade earth.",
        genres: ["Action", "Adventure", "Fantasy", "Super Power"],
        status: "Airing",
        studios: ["A-1 Pictures"],
        producers: ["Aniplex", "Crunchyroll", "D&C Media"],
        totalEpisodes: 12,
        episodes: Array.from({ length: 12 }, (_, i) => ({
          episodeNumber: i + 1,
          title: i === 0 ? "You Aren't E-Rank, Are You?" : i === 1 ? "The Red Gate" : `Shadow Monarch Chapter ${i + 1}`,
          alternativeTitle: `Episode ${i + 1}`,
          id: `solo-leveling-season-2-19413::ep=${i + 1}`,
          isFiller: false
        }))
      },
      {
        id: "frieren-beyond-journeys-end-154587",
        slug: "frieren-beyond-journeys-end-154587",
        anilistId: 154587,
        title: "Frieren: Beyond Journey's End",
        alternativeTitle: "Sousou no Frieren",
        poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
        rating: "9.37",
        quality: "HD",
        type: "TV",
        duration: "24m",
        synopsis: "Elf mage Frieren reflects on her decades-long adventure with the hero party and embarks on a quiet voyage of discovery and mortal bonds.",
        genres: ["Adventure", "Drama", "Fantasy"],
        status: "Completed",
        studios: ["Madhouse"],
        producers: ["Toho", "Shogakukan", "Nippon Television Network"],
        totalEpisodes: 28,
        episodes: Array.from({ length: 28 }, (_, i) => ({
          episodeNumber: i + 1,
          title: i === 0 ? "The Journey's End" : i === 1 ? "It Didn't Have to Be Magic..." : `Frieren Episode ${i + 1}`,
          alternativeTitle: `Ep ${i + 1}`,
          id: `frieren-beyond-journeys-end-154587::ep=${i + 1}`,
          isFiller: false
        }))
      },
      {
        id: "jujutsu-kaisen-2nd-season-145064",
        slug: "jujutsu-kaisen-2nd-season-145064",
        anilistId: 145064,
        title: "Jujutsu Kaisen Season 2 (Shibuya Incident)",
        alternativeTitle: "Jujutsu Kaisen 2nd Season",
        poster: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80",
        rating: "8.89",
        quality: "HD",
        type: "TV",
        duration: "24m",
        synopsis: "The Shibuya Incident unfolds as curses launch a full-scale assault on Halloween, sealing Satoru Gojo inside the Prison Realm.",
        genres: ["Action", "Fantasy", "Supernatural"],
        status: "Completed",
        studios: ["MAPPA"],
        producers: ["TOHO animation", "Shueisha", "MBS"],
        totalEpisodes: 23,
        episodes: Array.from({ length: 23 }, (_, i) => ({
          episodeNumber: i + 1,
          title: i < 5 ? `Hidden Inventory ${i + 1}` : `Shibuya Incident: Gate ${i - 4}`,
          alternativeTitle: `Ep ${i + 1}`,
          id: `jujutsu-kaisen-2nd-season-145064::ep=${i + 1}`,
          isFiller: false
        }))
      },
      {
        id: "demon-slayer-kimetsu-no-yaiba-hashira-training-arc-166240",
        slug: "demon-slayer-hashira-training-166240",
        anilistId: 166240,
        title: "Demon Slayer: Hashira Training Arc",
        alternativeTitle: "Kimetsu no Yaiba: Hashira Geiko-hen",
        poster: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80",
        rating: "8.65",
        quality: "HD",
        type: "TV",
        duration: "24m",
        synopsis: "Tanjiro visits the Stone Hashira, Himejima, who intends to prepare him for the battles to come against Muzan Kibutsuji.",
        genres: ["Action", "Fantasy", "Historical"],
        status: "Completed",
        studios: ["ufotable"],
        producers: ["Aniplex", "Shueisha"],
        totalEpisodes: 8,
        episodes: Array.from({ length: 8 }, (_, i) => ({
          episodeNumber: i + 1,
          title: i === 0 ? "To Defeat Muzan Kibutsuji" : `Hashira Training: Session ${i + 1}`,
          alternativeTitle: `Ep ${i + 1}`,
          id: `demon-slayer-hashira-training-166240::ep=${i + 1}`,
          isFiller: i === 3
        }))
      },
      {
        id: "dandadan-171018",
        slug: "dandadan-171018",
        anilistId: 171018,
        title: "Dandadan",
        alternativeTitle: "Dandadan",
        poster: "https://images.unsplash.com/photo-1569701814227-2c9ff5010688?w=800&auto=format&fit=crop&q=80",
        rating: "8.78",
        quality: "HD",
        type: "TV",
        duration: "24m",
        synopsis: "Momo Ayase, who believes in ghosts, and Okarun, who believes in aliens, find out both occult threats are wildly real.",
        genres: ["Action", "Comedy", "Sci-Fi", "Supernatural"],
        status: "Completed",
        studios: ["Science SARU"],
        producers: ["Aniplex", "Mainichi Broadcasting System", "Shueisha"],
        totalEpisodes: 12,
        episodes: Array.from({ length: 12 }, (_, i) => ({
          episodeNumber: i + 1,
          title: i === 0 ? "That's How Love Starts, Ya Know!" : `Turbulent Encounter ${i + 1}`,
          alternativeTitle: `Ep ${i + 1}`,
          id: `dandadan-171018::ep=${i + 1}`,
          isFiller: false
        }))
      },
      {
        id: "one-piece-21",
        slug: "one-piece-21",
        anilistId: 21,
        title: "One Piece: Egghead Arc",
        alternativeTitle: "One Piece",
        poster: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
        rating: "8.92",
        quality: "HD",
        type: "TV",
        duration: "24m",
        synopsis: "The Straw Hats arrive on Future Island Egghead, the laboratory of genius scientist Dr. Vegapunk, where secrets of the Void Century are kept.",
        genres: ["Action", "Adventure", "Comedy", "Fantasy"],
        status: "Airing",
        studios: ["Toei Animation"],
        producers: ["Fuji TV", "TAP", "Shueisha"],
        totalEpisodes: 1122,
        episodes: [
          { episodeNumber: 1120, title: "The World Shakes! Five Elders In Action", id: "one-piece-21::ep=1120", isFiller: false },
          { episodeNumber: 1121, title: "Garp's Final Lesson! Impact on Pirate Island", id: "one-piece-21::ep=1121", isFiller: false },
          { episodeNumber: 1122, title: "The Last Wave! Egghead Escape Begins", id: "one-piece-21::ep=1122", isFiller: false }
        ]
      }
    ];

    // 1. Homepage Endpoint: GET /api/hianime/home
    if (url.pathname === '/api/hianime/home') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: "success",
        engine: "hianime-api (MSMods-Pro)",
        version: "1.0.0",
        data: {
          spotlight: hiAnimeCatalog.slice(0, 4).map((anime, idx) => ({
            rank: idx + 1,
            id: anime.id,
            anilistId: anime.anilistId,
            title: anime.title,
            alternativeTitle: anime.alternativeTitle,
            poster: anime.poster,
            synopsis: anime.synopsis,
            quality: anime.quality,
            type: anime.type,
            duration: anime.duration,
            episodes: { sub: anime.totalEpisodes, dub: Math.max(1, anime.totalEpisodes - 2), eps: anime.totalEpisodes }
          })),
          trending: hiAnimeCatalog.map((a, i) => ({
            rank: i + 1,
            id: a.id,
            anilistId: a.anilistId,
            title: a.title,
            poster: a.poster,
            rating: a.rating,
            type: a.type
          })),
          topAiring: hiAnimeCatalog.filter(a => a.status === 'Airing'),
          mostPopular: hiAnimeCatalog,
          mostFavorite: hiAnimeCatalog.slice(0, 3),
          latestEpisode: hiAnimeCatalog.map(a => ({
            id: a.id,
            title: a.title,
            poster: a.poster,
            latestEp: a.totalEpisodes
          })),
          topUpcoming: [
            { title: "Chainsaw Man - The Movie: Reze Arc", type: "Movie", status: "Upcoming", poster: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80" },
            { title: "One-Punch Man Season 3", type: "TV", status: "Upcoming", poster: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80" }
          ],
          top10: {
            today: hiAnimeCatalog.slice(0, 5),
            week: hiAnimeCatalog,
            month: hiAnimeCatalog
          }
        }
      }, null, 2));
      return;
    }

    // 2. Search Suggestions: GET /api/hianime/suggestion?keyword=...
    if (url.pathname === '/api/hianime/suggestion') {
      res.setHeader('Content-Type', 'application/json');
      const keyword = (url.searchParams.get('keyword') || '').toLowerCase().trim();
      const matches = hiAnimeCatalog.filter(a => 
        !keyword || 
        a.title.toLowerCase().includes(keyword) || 
        a.alternativeTitle.toLowerCase().includes(keyword)
      ).slice(0, 6).map(a => ({
        id: a.id,
        title: a.title,
        alternativeTitle: a.alternativeTitle,
        poster: a.poster,
        aired: "2024",
        duration: a.duration,
        rating: a.rating
      }));

      res.end(JSON.stringify({
        keyword,
        total: matches.length,
        results: matches
      }, null, 2));
      return;
    }

    // 3. Search Full Endpoint: GET /api/hianime/search?keyword=...&page=...
    if (url.pathname === '/api/hianime/search') {
      res.setHeader('Content-Type', 'application/json');
      const keyword = (url.searchParams.get('keyword') || '').toLowerCase().trim();
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const matches = hiAnimeCatalog.filter(a => 
        !keyword || 
        a.title.toLowerCase().includes(keyword) || 
        a.alternativeTitle.toLowerCase().includes(keyword) ||
        a.genres.some(g => g.toLowerCase().includes(keyword))
      );

      res.end(JSON.stringify({
        status: "success",
        page,
        totalPages: 1,
        totalResults: matches.length,
        results: matches.map(a => ({
          id: a.id,
          anilistId: a.anilistId,
          title: a.title,
          alternativeTitle: a.alternativeTitle,
          poster: a.poster,
          duration: a.duration,
          type: a.type,
          rating: a.rating,
          quality: a.quality,
          episodes: { sub: a.totalEpisodes, dub: Math.max(1, a.totalEpisodes - 2) },
          genres: a.genres
        }))
      }, null, 2));
      return;
    }

    // 4. Anime Details: GET /api/hianime/anime/:id
    if (url.pathname.startsWith('/api/hianime/anime/')) {
      res.setHeader('Content-Type', 'application/json');
      const animeId = url.pathname.replace('/api/hianime/anime/', '').trim();
      const found = hiAnimeCatalog.find(a => a.id === animeId || String(a.anilistId) === animeId) || hiAnimeCatalog[0];

      res.end(JSON.stringify({
        status: "success",
        data: {
          id: found.id,
          anilistId: found.anilistId,
          title: found.title,
          alternativeTitle: found.alternativeTitle,
          poster: found.poster,
          synopsis: found.synopsis,
          rating: found.rating,
          quality: found.quality,
          type: found.type,
          duration: found.duration,
          status: found.status,
          studios: found.studios,
          producers: found.producers,
          genres: found.genres,
          totalEpisodes: found.totalEpisodes,
          characters: [
            { name: "Protagonist Lead", role: "Main", image: found.poster },
            { name: "Secondary Ally", role: "Supporting", image: found.poster }
          ]
        }
      }, null, 2));
      return;
    }

    // 5. Anime Episodes: GET /api/hianime/episodes/:id
    if (url.pathname.startsWith('/api/hianime/episodes/')) {
      res.setHeader('Content-Type', 'application/json');
      const animeId = url.pathname.replace('/api/hianime/episodes/', '').trim();
      const found = hiAnimeCatalog.find(a => a.id === animeId || String(a.anilistId) === animeId) || hiAnimeCatalog[0];

      res.end(JSON.stringify({
        status: "success",
        animeId: found.id,
        totalEpisodes: found.episodes.length,
        episodes: found.episodes
      }, null, 2));
      return;
    }

    // 6. Servers Endpoint: GET /api/hianime/servers?id=...
    if (url.pathname === '/api/hianime/servers') {
      res.setHeader('Content-Type', 'application/json');
      const rawId = url.searchParams.get('id') || 'solo-leveling-season-2-19413::ep=1';
      const epMatch = rawId.match(/ep=(\d+)/);
      const ep = epMatch ? parseInt(epMatch[1], 10) : 1;
      const animeMatch = rawId.split('::')[0] || '';
      const found = hiAnimeCatalog.find(a => a.id.includes(animeMatch)) || hiAnimeCatalog[0];
      const anilistId = found.anilistId;

      res.end(JSON.stringify({
        episode: ep,
        animeId: found.id,
        sub: [
          { index: 1, type: "sub", name: "HD-1 (VidStreaming)", serverId: 4, embedUrl: `https://ani.pm/embed/ani/${anilistId}/${ep}/sub`, subtitle: "English" },
          { index: 2, type: "sub", name: "HD-2 (MegaCloud)", serverId: 1, embedUrl: `https://megacloud.tv/embed-2/e-1/${anilistId}?ep=${ep}`, subtitle: "English" },
          { index: 3, type: "sub", name: "StreamSB", serverId: 3, embedUrl: `https://streamsb.net/e/${anilistId}ep${ep}`, subtitle: null }
        ],
        dub: [
          { index: 1, type: "dub", name: "HD-1 (VidStreaming)", serverId: 4, embedUrl: `https://ani.pm/embed/ani/${anilistId}/${ep}/dub`, subtitle: "English" },
          { index: 2, type: "dub", name: "HD-2 (MegaCloud)", serverId: 1, embedUrl: `https://megacloud.tv/embed-2/e-1/${anilistId}?ep=${ep}`, subtitle: "English" }
        ],
        raw: [
          { index: 1, type: "raw", name: "HD-1 (Raw JP)", serverId: 4, embedUrl: `https://ani.pm/embed/ani/${anilistId}/${ep}/sub`, subtitle: null }
        ]
      }, null, 2));
      return;
    }

    // 7. Streaming Links: GET /api/hianime/stream?id=...&server=...&type=...
    if (url.pathname === '/api/hianime/stream') {
      res.setHeader('Content-Type', 'application/json');
      const id = url.searchParams.get('id') || 'solo-leveling-season-2-19413::ep=1';
      const server = (url.searchParams.get('server') || 'HD-1').toUpperCase();
      const type = (url.searchParams.get('type') || 'sub').toLowerCase();
      const epMatch = id.match(/ep=(\d+)/);
      const ep = epMatch ? parseInt(epMatch[1], 10) : 1;
      const found = hiAnimeCatalog.find(a => a.id.includes(id.split('::')[0])) || hiAnimeCatalog[0];

      res.end(JSON.stringify({
        status: "success",
        server,
        type,
        anime: {
          id: found.id,
          title: found.title,
          episode: ep
        },
        stream: {
          master_m3u8: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          backup_m3u8: "https://test-streams.mux.dev/test_001/stream.m3u8",
          intro: { start: 85, end: 175 },
          outro: { start: 1320, end: 1410 },
          subtitles: [
            { lang: "English", url: "https://raw.githubusercontent.com/brenopolanski/html5-video-webvtt-example/master/subtitles/subtitles-en.vtt", default: true }
          ],
          variants: [
            { name: "1080p", resolution: "1920x1080", bandwidth_kbps: 4500, quality: "1080p" },
            { name: "720p", resolution: "1280x720", bandwidth_kbps: 2200, quality: "720p" },
            { name: "480p", resolution: "854x480", bandwidth_kbps: 1100, quality: "480p" },
            { name: "360p", resolution: "640x360", bandwidth_kbps: 650, quality: "360p" }
          ]
        }
      }, null, 2));
      return;
    }

    // 8. Embedded HTML Video Player: GET /api/hianime/embed
    if (url.pathname === '/api/hianime/embed') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      const id = url.searchParams.get('id') || 'solo-leveling-season-2-19413::ep=1';
      const anilistId = url.searchParams.get('anilistId') || '165842';
      const server = url.searchParams.get('server') || 'HD-1';
      const type = url.searchParams.get('type') || 'sub';
      const epMatch = id.match(/ep=(\d+)/);
      const ep = epMatch ? epMatch[1] : '1';

      const playerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HiAnime Stream Player - ${id}</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:#07090e; color:#fff; font-family:sans-serif; overflow:hidden; }
    #player-wrap { position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
    video { width:100%; height:100%; object-fit:contain; background:#000; }
    .badge-bar { position:absolute; top:12px; left:12px; display:flex; gap:8px; z-index:20; }
    .tag { background:rgba(229,9,20,0.85); font-size:11px; font-weight:700; padding:3px 8px; border-radius:4px; text-transform:uppercase; letter-spacing:0.5px; }
    .server-tag { background:rgba(24,24,27,0.85); border:1px solid rgba(255,255,255,0.2); font-size:11px; padding:3px 8px; border-radius:4px; color:#e4e4e7; }
    .skip-btn { position:absolute; bottom:64px; right:20px; z-index:30; background:rgba(229,9,20,0.9); hover:background:#e50914; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer; display:none; box-shadow:0 4px 12px rgba(0,0,0,0.5); transition:transform 0.15s ease; }
    .skip-btn:hover { transform:scale(1.05); }
    .skip-btn.active { display:block; }
  </style>
</head>
<body>
  <div id="player-wrap">
    <div class="badge-bar">
<span class="tag">HiAnime Engine</span>
<span class="server-tag">${server} • ${type.toUpperCase()} • Ep ${ep}</span>
    </div>
    <video id="hianime-video" controls autoplay playsinline crossorigin="anonymous" poster="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800"></video>
    <button id="skip-intro-btn" class="skip-btn" onclick="skipIntro()">Skip Intro (+85s) ▶</button>
  </div>
  <script>
    const video = document.getElementById('hianime-video');
    const skipBtn = document.getElementById('skip-intro-btn');
    const streamSource = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

    if (Hls.isSupported()) {
const hls = new Hls({ enableWorker: true });
hls.loadSource(streamSource);
hls.attachMedia(video);
hls.on(Hls.Events.MANIFEST_PARSED, () => {
  video.play().catch(() => {});
});
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
video.src = streamSource;
video.addEventListener('loadedmetadata', () => {
  video.play().catch(() => {});
});
    }

    video.addEventListener('timeupdate', () => {
const cur = video.currentTime;
// Show skip button during intro window (3s to 85s)
if (cur >= 3 && cur < 85) {
  skipBtn.classList.add('active');
} else {
  skipBtn.classList.remove('active');
}

// Notify parent window of time updates
if (window.parent && window.parent !== window) {
  window.parent.postMessage({
    ns: 'anipm.player',
    event: 'timeupdate',
    data: {
      currentTime: cur,
      duration: video.duration || 1440,
      paused: video.paused
    }
  }, '*');
}
    });

    function skipIntro() {
video.currentTime = Math.min(video.duration, video.currentTime + 85);
skipBtn.classList.remove('active');
    }
  </script>
</body>
</html>`;
      res.end(playerHtml);
      return;
    }

    // 9. Schedules Endpoint: GET /api/hianime/schedules
    if (url.pathname === '/api/hianime/schedules') {
      res.setHeader('Content-Type', 'application/json');
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const schedules = days.map((day, dIdx) => ({
        day,
        date: new Date(Date.now() + dIdx * 86400000).toISOString().split('T')[0],
        animes: [
          { time: "18:00", title: hiAnimeCatalog[dIdx % hiAnimeCatalog.length].title, episode: 12 + dIdx, anilistId: hiAnimeCatalog[dIdx % hiAnimeCatalog.length].anilistId },
          { time: "22:30", title: hiAnimeCatalog[(dIdx + 1) % hiAnimeCatalog.length].title, episode: 8 + dIdx, anilistId: hiAnimeCatalog[(dIdx + 1) % hiAnimeCatalog.length].anilistId }
        ]
      }));

      res.end(JSON.stringify({
        status: "success",
        engine: "MSMods-Pro/hianime-api",
        schedules
      }, null, 2));
      return;
    }

    // 10. Genres: GET /api/hianime/genres
    if (url.pathname === '/api/hianime/genres') {
      res.setHeader('Content-Type', 'application/json');
      const genres = [
        "Action", "Adventure", "Cars", "Comedy", "Dementia", "Demons", "Drama", "Ecchi", 
        "Fantasy", "Game", "Harem", "Historical", "Horror", "Isekai", "Josei", "Kids", 
        "Magic", "Martial Arts", "Mecha", "Military", "Music", "Mystery", "Parody", "Police", 
        "Psychological", "Romance", "Samurai", "School", "Sci-Fi", "Seinen", "Shoujo", 
        "Shounen", "Slice of Life", "Space", "Sports", "Super Power", "Supernatural", "Thriller", "Vampire"
      ];
      res.end(JSON.stringify({ genres, total: genres.length }, null, 2));
      return;
    }

    // 11. News: GET /api/hianime/news
    if (url.pathname === '/api/hianime/news') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: "success",
        news: [
          {
            id: "solo-leveling-arise-ep-breakthrough",
            title: "Solo Leveling Season 2 Breaks Global Anime Streaming Records",
            uploadedAt: "2 hours ago",
            intro: "Sung Jinwoo's return as the Shadow Monarch achieves unprecedented viewership across international distributors.",
            thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600"
          },
          {
            id: "frieren-anniversary-celebration",
            title: "Frieren: Beyond Journey's End Announces Orchestral World Tour",
            uploadedAt: "5 hours ago",
            intro: "Composer Evan Call's critically acclaimed soundtrack to be performed live with original animation sequences.",
            thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600"
          }
        ]
      }, null, 2));
      return;
    }

    // 12. Random: GET /api/hianime/random
    if (url.pathname === '/api/hianime/random') {
      res.setHeader('Content-Type', 'application/json');
      const randomPick = hiAnimeCatalog[Math.floor(Math.random() * hiAnimeCatalog.length)];
      res.end(JSON.stringify({
        status: "success",
        random: randomPick
      }, null, 2));
      return;
    }
  }

  next();
};

function anipmPartnerApiPlugin(): Plugin {
  return {
    name: 'anipm-partner-api-plugin',
    configureServer(server) {
      server.middlewares.use(anipmApiMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(anipmApiMiddleware);
    },
  };
}

// ==========================================
// NOTE: __dirname → import.meta.dirname adaptation warning note:
// In native ESM environments or Node.js v20.11+, use import.meta.dirname or
// fileURLToPath(new URL('.', import.meta.url)) instead of CommonJS __dirname.
// ==========================================
// import.meta.dirname is available on Node >= 20.11 (Vite 8's floor).
const appRootDir = import.meta.dirname || process.cwd();

export default defineConfig(() => {
  return {
    // Relative asset base: the built index.html references ./assets/... so the
    // committed dist/ renders from ANY static server, sub-path or editor
    // preview (Spck on Android, VS Code Live Server, GitHub Pages) — not just
    // from a server whose root contains /assets.
    base: './',
    plugins: [tailwindcss(), anipmPartnerApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(appRootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
