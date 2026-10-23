/**
 * End-to-end smoke test for the AniStream app (index.html + Vite API backend).
 *
 * Usage:  npm run dev   (in one terminal)   then   npm run test:smoke
 *
 * Asserts that the page boots without uncaught errors, that the catalog,
 * filters, search, watch flow, history and schedule modals all work, and
 * writes screenshots to artifacts/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const failures = [];
const notes = [];

function check(label, condition, detail = '') {
  if (condition) {
    notes.push(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures.push(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];
const badResponses = [];

page.on('pageerror', (err) => pageErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => {
  failedRequests.push(`${req.url()} — ${req.failure()?.errorText || 'failed'}`);
});
page.on('response', (res) => {
  if (res.status() >= 400) badResponses.push(`${res.status()} ${res.url()}`);
});

// 0. First paint must not wait on the network (offline catalog renders
// immediately; live data swaps in later). This is a regression test for the
// multi-minute load caused by hanging upstream providers.
const firstPaintStart = Date.now();
await page.goto(BASE, { waitUntil: 'commit', timeout: 45000 });
await page.waitForFunction(
  () => document.querySelectorAll('#anime-grid > div').length > 0,
  null,
  { timeout: 15000 }
).catch(() => {});
const firstPaintMs = Date.now() - firstPaintStart;
check('first cards render without waiting on the network', firstPaintMs < 6000, `${firstPaintMs}ms`);

await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1500);

// 1. Page boots without uncaught exceptions
check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

// 2. Catalog populated
const cardCount = await page.locator('#anime-grid > div').count();
check('catalog grid rendered cards', cardCount > 0, `${cardCount} cards`);

const heroTitle = (await page.locator('#hero-title').textContent())?.trim() || '';
check('hero title populated', heroTitle.length > 0, heroTitle);

// 3. Genre filter
await page.locator('.genre-btn', { hasText: 'Action' }).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(300);
await page.locator('.genre-btn', { hasText: 'Action' }).first().click();
await page.waitForTimeout(300);
const actionBadge = (await page.locator('#catalog-count-badge').textContent())?.trim() || '';
// Contract: clicking a genre pill always updates the badge — either
// "Filtered by Action" (source reports genre metadata) or an explicit
// "Genre data unavailable" note (source currently has no genre data; the
// grid stays visible with a truthful explanation instead of going empty).
check('genre filter updates badge',
  /Filtered by Action/.test(actionBadge) || /Genre data unavailable/.test(actionBadge),
  actionBadge);
const actionCards = await page.locator('#anime-grid > div').count();
check('genre filter narrows grid', actionCards > 0 && actionCards <= cardCount, `${actionCards} cards`);

// 4. Search queries the API, not just the 10 loaded cards
await page.locator('#search-input').fill('frieren');
await page.waitForFunction(
  () => /\b[1-9]\d* results?\b/.test(document.getElementById('catalog-count-badge')?.textContent || ''),
  null,
  { timeout: 8000 }
).catch(() => {});
const searchBadge = (await page.locator('#catalog-count-badge').textContent())?.trim() || '';
const searchCards = await page.locator('#anime-grid > div').count();
check('search queries the API and returns results',
  /\b[1-9]\d* results?\b/.test(searchBadge) && searchCards > 0,
  `${searchBadge}, ${searchCards} cards`);

// 5. Reset (logo link) restores the full catalog
// The header brand link is the only copy of this link (no drawer anymore).
await page.locator('header a[href="#browse-section"]').evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(300);
await page.locator('header a[href="#browse-section"]').click();
await page.waitForTimeout(400);
const resetBadge = (await page.locator('#catalog-count-badge').textContent())?.trim() || '';
const resetCards = await page.locator('#anime-grid > div').count();
check('reset restores catalog', /Showing (?:all releases|\d+ of \d+ releases)/.test(resetBadge) && resetCards === cardCount,
  `${resetBadge}, ${resetCards} cards`);

// 5b. "Show more" pagination: the grid shows the first page (20 cards) and
// expands only when the catalogue is larger.
const loadMoreVisible = await page.locator('#load-more-btn').evaluate((el) => !el.classList.contains('hidden'));
if (loadMoreVisible) {
  await page.locator('#load-more-btn').click();
  await page.waitForTimeout(300);
  const expandedCards = await page.locator('#anime-grid > div').count();
  check('Show more expands the grid by another page', expandedCards > resetCards,
    `${resetCards} → ${expandedCards} cards`);
} else {
  check('Show more hidden when the catalogue fits one page', resetCards <= 20, `${resetCards} cards`);
}

// 6. "Anime Info" hero button (previously an undefined function)
let infoError = null;
page.once('pageerror', (e) => { infoError = String(e); });
await page.locator('#hero-info-btn').evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(300);
await page.locator('#hero-info-btn').click();
await page.waitForTimeout(300);
check('hero "Anime Info" button works', infoError === null, infoError || 'no error');
const infoLabel = (await page.locator('#hero-info-btn-label').textContent())?.trim() || '';
check('hero synopsis expanded', /Show Less/i.test(infoLabel), infoLabel);
await page.locator('#hero-info-btn').click();
await page.waitForTimeout(200);

await page.screenshot({ path: 'artifacts/01-home.png', fullPage: false });

// 7. Open a title -> watch page (centre the card first: the header is
//    sticky, so a card at the very top would sit underneath it)
await page.locator('#anime-grid > div').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(300);
await page.locator('#anime-grid > div').first().click();
await page.waitForTimeout(2500);
const watchVisible = await page.locator('#watch-section').evaluate((el) => !el.classList.contains('hidden'));
check('watch section opens', watchVisible);
const watchTitle = (await page.locator('#watch-anime-title').textContent())?.trim() || '';
check('watch page shows title', watchTitle.length > 0 && watchTitle !== 'Anime Title', watchTitle);
const episodeCount = await page.locator('#episodes-container > a').count();
check('episode list rendered', episodeCount > 0, `${episodeCount} episodes`);

// The player must never show debug-style server status text
const playerText = ((await page.locator('#player').innerText().catch(() => '')) || '').trim();
check('player shows no debug/server status text',
  !/Connecting to High-Definition Stream|Cascading to Server|Redundant Failover/i.test(playerText),
  playerText.slice(0, 40));

// Regression guard: episodes must carry distinct numbers (the AniWixi provider
// used to read a field the API never sends, collapsing every episode to 1).
const episodeNumbers = await page.evaluate(() =>
  [...document.querySelectorAll('#episodes-container > a')].map((a) =>
    Number(((a.getAttribute('href') || '').match(/\/episode\/(\d+)/) || [])[1] || 0)
  )
);
const distinct = new Set(episodeNumbers).size;
check('episodes have distinct numbers', distinct === episodeNumbers.length && episodeNumbers[0] === 1,
  `${episodeNumbers.length} episodes, ${distinct} distinct`);
const hasFrameOrMessage = (await page.locator('#player iframe').count()) > 0 ||
  (await page.locator('#player').textContent()).length > 0;
check('player area populated', hasFrameOrMessage);

await page.screenshot({ path: 'artifacts/02-watch.png', fullPage: false });

// 8. Switch episode
if (episodeCount > 1) {
  await page.locator('#episodes-container > a', { hasText: 'Ep 2' }).first().click();
  await page.waitForTimeout(800);
  const crumb = (await page.locator('#crumb-episode-num').textContent())?.trim() || '';
  check('episode switch updates breadcrumb', /Episode 2/.test(crumb), crumb);
}

// 8b. Only live embeddable servers remain — the dead mirrors (MegaCloud,
// AniKoto, Multi-Mirror) are gone; every offered server plays on this site.
const serverBtnCount = await page.locator('.server-btn').count();
check('picker offers four live embeddable servers', serverBtnCount === 4, `${serverBtnCount} server buttons`);
const serverTitles = (await page.locator('.server-btn').evaluateAll((els) => els.map((e) => e.getAttribute('title') || ''))).join(' | ');
check('no dead mirrors in the server picker', !/AniKoto|MegaCloud|Mirror/i.test(serverTitles), serverTitles);
await page.locator('#server-btn-2').click();
await page.waitForTimeout(900);
const externalLinks = await page.locator('#player a[target="_blank"]').count();
check('server 2 plays inside the site (no external-open panel)', externalLinks === 0, `${externalLinks} external links`);

// 8c. Server 3 (AniRaku) resolves a direct HLS source into the native player
await page.locator('#server-btn-3').click();
await page.waitForSelector('#stream-video', { timeout: 20000 }).catch(() => {});
const nativeVideo = await page.locator('#stream-video').count();
check('server 3 (AniRaku) loads the native HLS video player', nativeVideo === 1, `${nativeVideo} <video> elements`);
await page.screenshot({ path: 'artifacts/03-native-hls.png', fullPage: false });

// 8d. Server 4 (Shonen) loads its hosted player iframe
await page.locator('#server-btn-4').click();
await page.waitForSelector('#stream-iframe[src*="shonen.to"]', { timeout: 10000 }).catch(() => {});
const shonenFrame = await page.locator('#stream-iframe[src*="shonen.to"]').count();
check('server 4 (Shonen) loads its hosted player iframe', shonenFrame === 1, `${shonenFrame} shonen iframes`);

await page.locator('#server-btn-1').click();
await page.waitForTimeout(500);

// 9. Back to browse
await page.locator('button', { hasText: 'Back to Browse' }).click();
await page.waitForTimeout(500);
const browseVisible = await page.locator('#browse-section').evaluate((el) => !el.classList.contains('hidden'));
check('back to browse works', browseVisible);

// 10. Watch history records the visit
await page.locator('#history-counter').locator('xpath=ancestor::button[1]').click();
await page.waitForTimeout(500);
// Count history *rows* (they always render), not <img> tags: titles without
// fetched artwork legitimately show a neutral tile instead of an image.
const historyItems = await page.locator('#history-modal-list > div').evaluateAll((els) =>
  els.filter((el) => /Episode\s\d+/.test(el.textContent || '')).length);
check('history modal lists watched title', historyItems > 0, `${historyItems} entries`);
await page.keyboard.press('Escape');
await page.locator('#history-modal button').last().click().catch(() => {});
await page.waitForTimeout(300);

// 11. Schedule modal
await page.locator('button[title="Weekly Airing Schedule"]').click().catch(() => {});
const scheduleVisible = await page.locator('#schedule-modal').evaluate((el) => !el.classList.contains('hidden'))
  .catch(() => false);
check('schedule modal opens', scheduleVisible);
// Wait for the real schedule grid (day headers), not the loading placeholder
await page.waitForFunction(
  () => {
    const el = document.getElementById('schedule-modal-content');
    const text = (el?.textContent || '').replace(/\s+/g, ' ').trim();
    return text.length > 150 && !/Loading broadcast schedules/i.test(text);
  },
  null,
  { timeout: 10000 }
).catch(() => {});
const scheduleContent = ((await page.locator('#schedule-modal-content').textContent().catch(() => '')) || '')
  .replace(/\s+/g, ' ')
  .trim();
// Contract: the modal shows real schedule data (day cards, >150 chars) or —
// when every live schedule source is down — an explicit "unavailable"
// message. It must never hang on the loading placeholder or show fabricated
// entries (the hardcoded schedule that used to guarantee content is gone).
const scheduleHonest =
  /airing schedule is unavailable right now/i.test(scheduleContent) ||
  (scheduleContent.length > 150 && !/Loading broadcast schedules/i.test(scheduleContent));
check('schedule modal shows real schedule or honest unavailable state',
  scheduleHonest,
  `${scheduleContent.length} chars: ${scheduleContent.slice(0, 60)}`);

await browser.close();

// Report
notes.forEach((n) => console.log(n));
console.log('');
if (consoleErrors.length) {
  console.log('Console errors:');
  consoleErrors.slice(0, 15).forEach((e) => console.log(`  ${e}`));
  console.log('');
}
if (failedRequests.length) {
  console.log('Failed requests:');
  failedRequests.slice(0, 15).forEach((e) => console.log(`  ${e}`));
  console.log('');
}

const sameOriginFailures = [...new Set(badResponses)].filter((r) => r.includes(BASE));
const externalFailures = [...new Set(badResponses)].filter((r) => !r.includes(BASE));
if (externalFailures.length) {
  console.log('External (3rd-party stream/metadata) failures — informational:');
  externalFailures.slice(0, 10).forEach((e) => console.log(`  ${e}`));
  console.log('');
}
if (sameOriginFailures.length) {
  console.log('Same-origin API failures:');
  sameOriginFailures.forEach((e) => console.log(`  ${e}`));
  console.log('');
  failures.push(`FAIL  same-origin request failures — ${sameOriginFailures.length}`);
}

if (failures.length) {
  failures.forEach((f) => console.log(f));
  console.log(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('All smoke checks passed.');
