/**
 * Stub AnimeAPI for integration testing.
 *
 * Serves the exact response schemas documented in the AniPulse/AnimeAPI
 * README (`{ success, results: ... }` shapes for /, /search, /info and
 * /episodes) on 127.0.0.1:4555, so the AniPulse proxy, provider mapping,
 * grid rendering and episode loading can be verified end-to-end from a
 * machine where the real AnimeAPI's scraper hosts are unreachable.
 *
 * This is TEST INFRASTRUCTURE ONLY — it runs outside the app and is never
 * bundled; the product itself only talks to whatever ANIPULSE_API_URL names.
 *
 * Usage: node scripts/anipulse-stub.mjs [port]
 */
import { createServer } from 'node:http';

const PORT = Number(process.argv[2]) || 4555;
const POSTER = 'https://aniwixi.xyz/wp-content/uploads/2026/08/bx269-d2GmRkJbMopq-200x300.png';
// Contains an `hd-1` path segment on purpose: the app must rewrite it to
// `hd-4` (imageQuality.toHiResImage) before rendering.
const POSTER_HD1 = 'https://aniwixi.xyz/wp-content/uploads/hd-1/bx116674-test-poster.png';

const bleach = {
  id: 'bleach-269',
  data_id: 269,
  number: 1,
  poster: POSTER,
  title: 'Bleach',
  japanese_title: 'BLEACH',
  description:
    'Ichigo Kurosaki is a teenager who can see ghosts. When a hollow spirit attacks his family, he gains the power of a Soul Reaper.',
  tvInfo: {
    showType: 'TV',
    duration: '24 min/ep',
    releaseDate: 'Oct 5, 2004',
    quality: 'HD',
    episodeInfo: { episodes: 366 },
  },
};

const tybw = {
  id: 'bleach-thousand-year-blood-war-116674',
  data_id: 116674,
  number: 2,
  poster: POSTER_HD1,
  title: 'BLEACH: Thousand-Year Blood War',
  japanese_title: 'BLEACH: Sennen Kessen-hen',
  description: 'The Thousand-Year Blood War begins.',
  tvInfo: {
    showType: 'TV',
    duration: '24 min/ep',
    releaseDate: 'Oct 10, 2022',
    quality: 'HD',
    episodeInfo: { episodes: 13 },
  },
};

const episodes = {
  totalEpisodes: 3,
  episodes: [1, 2, 3].map((n) => ({
    episode_no: n,
    id: `bleach-269-${n}`,
    data_id: 900000 + n,
    jname: `BLEACH Episode ${n}`,
    title: n === 1 ? 'The Day I Became a Shinigami' : `Episode ${n}`,
    japanese_title: `BLEACH Episode ${n}`,
  })),
};

const info = {
  data: {
    adultContent: false,
    id: 'bleach-269',
    data_id: 269,
    title: 'Bleach',
    japanese_title: 'BLEACH',
    poster: POSTER,
    showType: 'TV',
    animeInfo: {
      Overview: bleach.description,
      Japanese: 'BLEACH',
      Synonyms: 'Bleach',
      Aired: 'Oct 5, 2004 to Mar 27, 2006',
      Premiered: 'Fall 2004',
      Duration: '24 min per ep',
      Status: 'Finished Airing',
      'MAL Score': '8.0',
      Genres: [{ name: 'Action' }, { name: 'Adventure' }, { name: 'Supernatural' }],
      Studios: 'Studio Pierrot',
      Producers: ['TV Tokyo', 'Dentsu'],
    },
  },
  seasons: [],
};

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  console.log(`[stub] ${req.method} ${url.pathname}${url.search}`);

  if (url.pathname === '/api/' || url.pathname === '/api') {
    return send(res, 200, {
      success: true,
      results: {
        spotlights: [bleach],
        trending: [bleach, tybw],
        topAiring: [bleach],
        mostPopular: [bleach],
        mostFavorite: [],
        today: { schedule: [] },
      },
    });
  }
  if (url.pathname === '/api/search') {
    const keyword = (url.searchParams.get('keyword') || '').toLowerCase();
    const hits = [bleach, tybw].filter((a) => a.title.toLowerCase().includes(keyword));
    return send(res, 200, { success: true, results: hits });
  }
  if (url.pathname === '/api/info') {
    return send(res, 200, { success: true, results: info });
  }
  if (url.pathname.startsWith('/api/episodes/')) {
    return send(res, 200, { success: true, results: episodes });
  }
  return send(res, 404, { success: false, message: `stub has no route for ${url.pathname}` });
}).listen(PORT, '127.0.0.1', () => console.log(`AnimeAPI stub listening on http://127.0.0.1:${PORT}`));
