/**
 * AniPulse/AnimeAPI integration test (end-to-end).
 *
 * Prerequisites:
 *   1. node scripts/anipulse-stub.mjs                (README-schema stub on :4555)
 *   2. ANIPULSE_API_URL=http://127.0.0.1:4555 npm run preview  (app on :3000)
 *
 * Verifies the whole chain: proxy route -> provider mapping -> grid with real
 * poster URLs (including the hd-1 -> hd-4 rewrite), episode loading from the
 * upstream schema, and anilist-id resolution by exact title match so stream
 * servers build URLs for the correct anime (animeId=269 for "Bleach").
 *
 * Usage: BASE_URL=http://127.0.0.1:3000 node scripts/anipulse-integration-test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const STUB_POSTER = 'https://aniwixi.xyz/wp-content/uploads/2026/08/bx269-d2GmRkJbMopq-200x300.png';
const failures = [];
const notes = [];

function check(label, condition, detail = '') {
  if (condition) notes.push(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  else failures.push(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({
  executablePath: '/workspace/homes/7b20bc476c5ff9fa31f5a815/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--headless=new',
    '--font-display-score=0',
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const proxied = [];
const anirakuUrls = [];
page.on('request', (req) => {
  if (req.url().includes('/api/anipulse/')) proxied.push(req.url());
  if (req.url().includes('/api/aniraku/stream')) anirakuUrls.push(req.url());
});
const responses = new Map();
page.on('response', (res) => responses.set(res.url(), res.status()));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });

// 1. Grid renders the upstream catalog (spotlight + cards) with real posters.
await page.waitForFunction(
  () => /Bleach/.test(document.getElementById('hero-title')?.textContent || ''),
  null,
  { timeout: 30000 }
);
check('spotlight hero shows upstream title (Bleach)', true);

const bleachCard = page.locator('#anime-grid .group').filter({ hasText: /Bleach/ }).first();
await bleachCard.waitFor({ timeout: 15000 }).catch(() => {});
check('grid contains upstream catalog card (Bleach)', await bleachCard.count() > 0);

const bleachPosterSrc = await bleachCard.locator('img').first().getAttribute('src').catch(() => null);
check('card poster comes from the upstream API', bleachPosterSrc === STUB_POSTER, `${bleachPosterSrc}`);

// 2. hd-1 -> hd-4 rewrite applied to upstream image paths.
const rewritten = await page.evaluate(() =>
  [...document.querySelectorAll('#anime-grid img')].map((i) => i.getAttribute('src') || '')
);
check('hd-1 image path rewritten to hd-4',
  rewritten.some((s) => s.includes('hd-4') && !s.includes('hd-1')),
  rewritten.find((s) => s.includes('hd-4'))?.slice(0, 90) || 'no hd-4 src found');

// 3. Proxy served the data (requests went through /api/anipulse/ and succeeded).
check('provider fetched through the /api/anipulse proxy', proxied.length > 0, `${proxied.length} requests`);
const failedProxied = proxied.filter((u) => responses.get(u) && responses.get(u) >= 500);
check('all proxied requests succeeded', failedProxied.length === 0, failedProxied.join(', ') || 'all 2xx');

// 4. Open the title -> episodes come from the upstream schema.
await bleachCard.click();
await page.waitForSelector('#watch-section:not(.hidden)', { timeout: 15000 });
await page.waitForSelector('#episodes-container > button', { timeout: 20000 });
const episodeText = (await page.locator('#episodes-container').textContent()) || '';
check('episode list loaded from upstream schema', /The Day I Became a Shinigami/.test(episodeText),
  episodeText.slice(0, 60).replace(/\s+/g, ' '));

// 5. Anilist-id resolution: streaming "Bleach" must target anilistId 269
//    (exact title match via live AniWixi search), never digits from the slug.
await page.waitForSelector('.server-btn', { timeout: 10000 });
await page.click('#server-btn-3');
const resolved = await (async () => {
  for (let i = 0; i < 30 && anirakuUrls.length === 0; i++) await page.waitForTimeout(500);
  return anirakuUrls[0] || '';
})();
check('stream server resolved the correct anilist id (269)',
  /animeId=269(&|$)/.test(resolved), resolved.slice(0, 110) || 'no aniraku request');

const severe = consoleErrors.filter((e) => !/net::ERR|Failed to load resource|404|Refused to display/i.test(e));
check('no unexpected console errors', severe.length === 0, severe.slice(0, 3).join(' | '));

await browser.close();

console.log('\n--- anipulse integration checks ---');
notes.forEach((n) => console.log(n));
failures.forEach((f) => console.log(f));
console.log(failures.length ? `\n${failures.length} check(s) failed.` : '\nAll AniPulse integration checks passed.');
process.exit(failures.length ? 1 : 0);
