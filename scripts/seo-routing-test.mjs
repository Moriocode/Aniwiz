/**
 * SEO + routing regression check.
 *
 * Verifies the crawlable surface end to end:
 *   - cards and episode items are real <a href> links
 *   - /anime/:slug and /anime/:slug/episode/:n deep links work on refresh
 *   - title/description/canonical/OG/JSON-LD follow the active title
 *   - Back/Forward restore the previous title and episode
 *   - /sitemap.xml and /robots.txt list the same URLs the UI links to
 *
 * Usage: npm run dev   (in another shell)   then   node scripts/seo-routing-test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const ORIGIN = new URL(BASE).origin;
const failures = [];
const passes = [];

function check(label, condition, detail = '') {
  if (condition) passes.push(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  else failures.push(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));

await page.goto(BASE, { waitUntil: 'commit', timeout: 45000 });
await page.waitForFunction(
  () => document.querySelectorAll('#anime-grid > div a[href^="/anime/"]').length > 0,
  null,
  { timeout: 20000 }
);
await page.waitForTimeout(700);

/* ------------------------------------------------------------------ */
/* Home                                                               */
/* ------------------------------------------------------------------ */
const home = await page.evaluate(() => ({
  title: document.title,
  canonical: document.getElementById('seo-canonical')?.getAttribute('href') || '',
  ogUrl: document.getElementById('seo-og-url')?.getAttribute('content') || '',
  cards: [...document.querySelectorAll('#anime-grid > div a')].map((a) => a.getAttribute('href') || ''),
  trendingHrefs: [...document.querySelectorAll('#trending-row a')].map((a) => a.getAttribute('href') || ''),
  newHrefs: [...document.querySelectorAll('#new-anime-row a')].map((a) => a.getAttribute('href') || ''),
  heroHref: document.getElementById('hero-watch-btn')?.getAttribute('href') || '',
}));
check('catalogue cards are crawlable anchors', home.cards.length >= 4 && home.cards.every((href) => /^\/anime\/[a-z0-9-]+$/.test(href)), `${home.cards.length} anchors`);
check('grid is paginated (max 20 cards per page)', home.cards.length <= 20, `${home.cards.length} anchors`);
check('Trending / New Anime rails render crawlable anchors',
  home.trendingHrefs.length > 0 && home.newHrefs.length > 0 &&
    [...home.trendingHrefs, ...home.newHrefs].every((href) => /^\/anime\/[a-z0-9-]+$/.test(href)),
  `${home.trendingHrefs.length} trending, ${home.newHrefs.length} new`);
check('home canonical is the site root', home.canonical === `${ORIGIN}/`, home.canonical);
check('home OG url matches the canonical', home.ogUrl === home.canonical, home.ogUrl);
check('hero CTA links to the spotlight title', /^\/anime\/[a-z0-9-]+$/.test(home.heroHref), home.heroHref);

const firstHref = home.cards[0];
const firstSlug = firstHref.replace('/anime/', '');

/* ------------------------------------------------------------------ */
/* Series page                                                        */
/* ------------------------------------------------------------------ */
await page.locator('#anime-grid > div a[href^="/anime/"]').first().click();
await page.waitForTimeout(1500);
const series = await page.evaluate(() => ({
  path: location.pathname,
  title: document.title,
  canonical: document.getElementById('seo-canonical')?.getAttribute('href') || '',
  metaDescription: document.getElementById('seo-description')?.getAttribute('content') || '',
  heading: document.getElementById('watch-anime-title')?.textContent?.trim() || '',
  watchVisible: !document.getElementById('watch-section').classList.contains('hidden'),
  jsonld: (() => { try { return JSON.parse(document.getElementById('seo-jsonld')?.textContent || '{}'); } catch { return {}; } })(),
  episodeHrefs: [...document.querySelectorAll('#episodes-container > a')].map((a) => a.getAttribute('href') || ''),
  prevHref: document.getElementById('btn-prev-ep')?.getAttribute('href') || '',
  nextHref: document.getElementById('btn-next-ep')?.getAttribute('href') || '',
}));

check('card click opens the series route', series.path === `/anime/${firstSlug}`, series.path);
check('watch page opens for the series route', series.watchVisible && series.heading.length > 0, series.heading);
check('series title is dynamic', series.title === `Watch ${series.heading} Online - AniStream`, series.title);
check('series canonical is the series URL', series.canonical === `${ORIGIN}/anime/${firstSlug}`, series.canonical);
check('series meta description is populated', series.metaDescription.length >= 40, `${series.metaDescription.length} chars`);
check('series JSON-LD is a TVSeries', series.jsonld?.['@type'] === 'TVSeries', series.jsonld?.['@type']);
check('episode items are crawlable anchors', series.episodeHrefs.length > 0 && series.episodeHrefs.every((href) => /\/episode\/\d+$/.test(href)), `${series.episodeHrefs.length} anchors`);
check('prev/next episode links are anchors', /\/episode\/1$/.test(series.prevHref) && /\/episode\/2$/.test(series.nextHref), `${series.prevHref} → ${series.nextHref}`);

/* ------------------------------------------------------------------ */
/* Episode page                                                       */
/* ------------------------------------------------------------------ */
await page.locator('#episodes-container > a', { hasText: 'Ep 2' }).first().click();
await page.waitForTimeout(1000);
const episode = await page.evaluate(() => ({
  path: location.pathname,
  title: document.title,
  canonical: document.getElementById('seo-canonical')?.getAttribute('href') || '',
  crumb: document.getElementById('crumb-episode-num')?.textContent?.trim() || '',
  jsonld: (() => { try { return JSON.parse(document.getElementById('seo-jsonld')?.textContent || '{}'); } catch { return {}; } })(),
  prevHref: document.getElementById('btn-prev-ep')?.getAttribute('href') || '',
  nextHref: document.getElementById('btn-next-ep')?.getAttribute('href') || '',
}));
check('episode selection pushes the episode route', episode.path === `/anime/${firstSlug}/episode/2`, episode.path);
check('episode SEO title includes the episode number', /Episode 2 Online - AniStream$/.test(episode.title), episode.title);
check('episode canonical is the episode URL', episode.canonical === `${ORIGIN}/anime/${firstSlug}/episode/2`, episode.canonical);
check('episode JSON-LD is a TVEpisode', episode.jsonld?.['@type'] === 'TVEpisode' && episode.jsonld?.episodeNumber === 2, episode.jsonld?.['@type']);
check('episode prev/next point at adjacent episodes', /\/episode\/1$/.test(episode.prevHref) && /\/episode\/3$/.test(episode.nextHref), `${episode.prevHref} → ${episode.nextHref}`);

/* ------------------------------------------------------------------ */
/* Refresh a deep link, then walk history back                        */
/* ------------------------------------------------------------------ */
await page.reload({ waitUntil: 'commit' });
await page.waitForFunction(() => { const el = document.getElementById('watch-section'); return !!el && !el.classList.contains('hidden'); }, null, { timeout: 20000 });
await page.waitForTimeout(900);
const reloaded = await page.evaluate(() => ({
  path: location.pathname,
  title: document.title,
  heading: document.getElementById('watch-anime-title')?.textContent?.trim() || '',
  crumb: document.getElementById('crumb-episode-num')?.textContent?.trim() || '',
}));
check('refreshing a deep episode URL restores that episode', reloaded.path.endsWith('/episode/2') && reloaded.crumb === 'Episode 2', `${reloaded.path} · ${reloaded.crumb}`);
check('refreshed page keeps dynamic metadata', reloaded.title.includes(reloaded.heading) && reloaded.title.includes('Episode 2'), reloaded.title);

await page.goBack();
await page.waitForTimeout(1200);
const backToSeries = await page.evaluate(() => ({
  path: location.pathname,
  watchVisible: !document.getElementById('watch-section').classList.contains('hidden'),
  title: document.title,
}));
check('Back returns to the series route', backToSeries.path === `/anime/${firstSlug}` && backToSeries.watchVisible, backToSeries.path);
check('Back restores the series SEO title', / Online - AniStream$/.test(backToSeries.title), backToSeries.title);

await page.goBack();
await page.waitForTimeout(1200);
const backToHome = await page.evaluate(() => ({
  path: location.pathname,
  watchVisible: !document.getElementById('watch-section').classList.contains('hidden'),
  title: document.title,
}));
check('Back from the series returns home', backToHome.path === '/' && !backToHome.watchVisible, backToHome.path);

// "Show more" reveals the next page of cards without a reload
const gridBeforeMore = await page.locator('#anime-grid > div').count();
const canExpand = await page.locator('#load-more-btn').evaluate((el) => !el.classList.contains('hidden'));
if (canExpand) {
  await page.locator('#load-more-btn').click();
  await page.waitForTimeout(300);
  const gridAfterMore = await page.locator('#anime-grid > div').count();
  check('"Show more" reveals the next page of cards', gridAfterMore > gridBeforeMore, `${gridBeforeMore} → ${gridAfterMore} cards`);
} else {
  check('"Show more" hidden when one page holds the whole grid', gridBeforeMore <= 20, `${gridBeforeMore} cards`);
}

/* ------------------------------------------------------------------ */
/* Fresh deep link (typed URL / shared link)                          */
/* ------------------------------------------------------------------ */
const direct = await context.newPage();
const directErrors = [];
direct.on('pageerror', (error) => directErrors.push(String(error)));
await direct.goto(`${BASE}/anime/${firstSlug}/episode/2`, { waitUntil: 'commit', timeout: 45000 });
await direct.waitForFunction(() => { const el = document.getElementById('watch-section'); return !!el && !el.classList.contains('hidden'); }, null, { timeout: 20000 });
await direct.waitForTimeout(700);
const directState = await direct.evaluate(() => ({
  path: location.pathname,
  heading: document.getElementById('watch-anime-title')?.textContent?.trim() || '',
  crumb: document.getElementById('crumb-episode-num')?.textContent?.trim() || '',
}));
check('a typed deep link opens that title and episode', directState.path.endsWith('/episode/2') && directState.crumb === 'Episode 2' && directState.heading.length > 0, `${directState.heading} · ${directState.crumb}`);
check('fresh deep link raises no page errors', directErrors.length === 0, directErrors.join(' | '));
await direct.close();

/* ------------------------------------------------------------------ */
/* Sitemap + robots                                                   */
/* ------------------------------------------------------------------ */
const sitemapResponse = await context.request.get(`${BASE}/sitemap.xml`);
const sitemap = await sitemapResponse.text();
check('sitemap responds with XML', sitemapResponse.status() === 200 && /application\/xml/.test(sitemapResponse.headers()['content-type'] || ''), `${sitemapResponse.status()} ${sitemapResponse.headers()['content-type']}`);
check('sitemap includes the series URL the UI links to', sitemap.includes(`<loc>${ORIGIN}${firstHref}</loc>`), firstHref);
check('sitemap includes episode URLs', sitemap.includes(`<loc>${ORIGIN}${firstHref}/episode/2</loc>`), `${firstHref}/episode/2`);
check('sitemap covers every catalogue card', home.cards.every((href) => sitemap.includes(`<loc>${ORIGIN}${href}</loc>`)), `${home.cards.length} checked`);
const railHrefs = [...home.trendingHrefs, ...home.newHrefs];
check('sitemap covers every rail link', railHrefs.length > 0 && railHrefs.every((href) => sitemap.includes(`<loc>${ORIGIN}${href}</loc>`)), `${railHrefs.length} checked`);

const robotsResponse = await context.request.get(`${BASE}/robots.txt`);
const robots = await robotsResponse.text();
check('robots.txt allows crawling', robotsResponse.status() === 200 && /User-agent: \*/.test(robots) && /Allow: \//.test(robots), `${robotsResponse.status()}`);
check('robots.txt points at the absolute sitemap URL', robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`), `${ORIGIN}/sitemap.xml`);

check('no uncaught page errors on the routing journey', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();

passes.forEach((line) => console.log(line));
if (failures.length) {
  failures.forEach((line) => console.log(line));
  console.log(`\n${failures.length} SEO/routing check(s) failed.`);
  process.exit(1);
}
console.log('\nAll SEO/routing checks passed.');
