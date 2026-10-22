/**
 * Layout regression check for the cleaned-up shell:
 * centred mobile wordmark, search shortcut, ONE bottom navigation bar,
 * horizontal category tabs, one card grid under an English "Latest Episodes"
 * heading, and the Continue Watching row.
 *
 * Usage: npm run dev   (in another shell)   then   node scripts/layout-check.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const failures = [];
const passes = [];

function check(label, condition, detail = '') {
  if (condition) passes.push(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  else failures.push(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();

/* ------------------------------------------------------------------ */
/* Mobile                                                             */
/* ------------------------------------------------------------------ */
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await mobile.newPage();
const mobileErrors = [];
page.on('pageerror', (e) => mobileErrors.push(String(e)));

await page.goto(BASE, { waitUntil: 'commit', timeout: 45000 });
await page.waitForFunction(() => document.querySelectorAll('#anime-grid > div').length > 0, null, { timeout: 15000 });
await page.waitForTimeout(800);

const viewport = page.viewportSize();
const logoBox = await page.locator('header a[href="#browse-section"]').first().boundingBox();
const logoCentre = logoBox.x + logoBox.width / 2;
check('mobile logo is horizontally centred', Math.abs(logoCentre - viewport.width / 2) <= 2,
  `logo centre ${logoCentre.toFixed(1)} vs viewport centre ${(viewport.width / 2).toFixed(1)}`);

const searchBtnBox = await page.locator('#mobile-search-btn').boundingBox();
check('search shortcut sits on the far right', searchBtnBox.x + searchBtnBox.width > viewport.width - 16,
  `right edge ${(searchBtnBox.x + searchBtnBox.width).toFixed(1)}`);

// No second menu: the drawer and its trigger must be gone entirely.
const drawerCount = await page.locator('#side-drawer, #drawer-open-btn').count();
check('no side drawer / drawer trigger in the DOM', drawerCount === 0, `${drawerCount} nodes`);
const navCount = await page.locator('nav[aria-label]').count();
const navLabelsList = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label]')].map((n) => n.getAttribute('aria-label')));
check('bottom bar is the only navigation menu',
  (await page.locator('#bottom-nav').count()) === 1 && navCount === 3 &&
  navLabelsList.includes('Mobile primary navigation') && !navLabelsList.some((l) => /drawer/i.test(l)),
  navLabelsList.join(' | '));

// Category tabs
const tabs = await page.locator('.category-tab').allTextContents();
check('category tabs render content types', tabs.length >= 1 && tabs.some((t) => /Anime/i.test(t)), tabs.join(' | '));
const activeTabBorder = await page.locator('.category-tab[aria-current="true"]').evaluate((el) => getComputedStyle(el).borderBottomColor);
check('active category tab has the accent underline', /rgb\(229,\s*9,\s*20\)/.test(activeTabBorder), activeTabBorder);

if (tabs.length > 1) {
  const target = page.locator('.category-tab').nth(1);
  const label = (await target.textContent()).trim();
  await target.click();
  await page.waitForTimeout(500);
  const current = (await page.locator('.category-tab[aria-current="true"]').textContent()).trim();
  check('category tab switches the active state', current === label, `${label} → ${current}`);
  await page.locator('.category-tab').first().click();
  await page.waitForTimeout(300);
}

// Bottom navigation
const navBox = await page.locator('#bottom-nav > div').boundingBox();
check('bottom nav floats at the bottom of the viewport',
  navBox.y + navBox.height > viewport.height - 40 && navBox.y > viewport.height - 120,
  `bottom ${(navBox.y + navBox.height).toFixed(1)} of ${viewport.height}`);
const navItems = await page.locator('.bottom-nav-item').allTextContents();
const navLabels = navItems.map((t) => t.trim());
check('bottom nav has exactly five shortcuts',
  navLabels.length === 5 && ['Home', 'Explore', 'Search', 'My List', 'History'].every((l) => navLabels.includes(l)),
  navLabels.join(' | '));
const labelFont = await page.locator('.bottom-nav-item span').first().evaluate((el) => getComputedStyle(el).fontSize);
const iconAboveLabel = await page.locator('.bottom-nav-item').first().evaluate((el) => {
  const svg = el.querySelector('svg').getBoundingClientRect();
  const span = el.querySelector('span').getBoundingClientRect();
  return span.top >= svg.bottom - 2;
});
check('bottom nav shows small labels under the icons', parseFloat(labelFont) <= 11 && iconAboveLabel, labelFont);

// Single content section: one grid, English headings only
const gridIds = await page.evaluate(() => [...document.querySelectorAll('[id$="-grid"]')].map((el) => el.id));
check('exactly one card grid renders the anime',
  gridIds.length === 1 && gridIds[0] === 'anime-grid', gridIds.join(', ') || 'none');
check('single catalogue section', (await page.locator('section#all-anime').count()) === 1);
const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
// textContent (not innerText) so the hidden Continue Watching heading still counts
const allText = (await page.evaluate(() => document.body.textContent || '')).replace(/\s+/g, ' ');
const indoHit = allText.match(/Episode Terbaru|Lanjutkan Menonton|Semua\b/);
check('headings are English-only',
  /Latest Episodes/.test(allText) && /Continue Watching/.test(allText) && !indoHit,
  indoHit ? `found "${indoHit[0]}" near ${JSON.stringify(allText.slice(Math.max(0, indoHit.index - 40), indoHit.index + 40))}`
    : (/Latest Episodes/.test(bodyText) && /Continue Watching/.test(allText) ? 'Latest Episodes + Continue Watching present' : 'heading missing'));
check('View All button exists', (await page.getByRole('button', { name: 'View All' }).count()) === 1);

// View All clears an active scope and restores the full grid
await page.locator('.genre-btn', { hasText: 'Action' }).first().click();
await page.waitForTimeout(400);
const filteredCount = await page.locator('#anime-grid > div').count();
await page.getByRole('button', { name: 'View All' }).click();
await page.waitForTimeout(600);
const viewAllBadge = (await page.locator('#catalog-count-badge').textContent())?.trim() || '';
const fullCount = await page.locator('#anime-grid > div').count();
check('View All clears filters and shows the whole grid',
  /Showing all releases/.test(viewAllBadge) && fullCount >= filteredCount,
  `${viewAllBadge}, ${filteredCount} → ${fullCount} cards`);

// Continue Watching is history-driven
check('Continue Watching stays hidden with no history',
  await page.locator('#continue-watching-section').evaluate((el) => el.classList.contains('hidden')));

// Seed history + progress, reload, verify the landscape row
await page.evaluate(() => {
  localStorage.setItem('anistream_history_v2', JSON.stringify([
    { id: '154587', title: "Frieren: Beyond Journey's End", poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600', episode: 3, watchedAt: Date.now() },
  ]));
  localStorage.setItem('prog-154587-3', JSON.stringify({ currentTime: 600, duration: 1440 }));
});
await page.reload({ waitUntil: 'commit' });
await page.waitForFunction(() => document.querySelectorAll('#anime-grid > div').length > 0, null, { timeout: 15000 });
await page.waitForTimeout(800);

const cwVisible = await page.locator('#continue-watching-section').evaluate((el) => !el.classList.contains('hidden'));
const cwCard = page.locator('#continue-watching-row > button').first();
const cwBox = await cwCard.boundingBox();
check('Continue Watching shows saved history', cwVisible && (await page.locator('#continue-watching-row > button').count()) > 0);
check('Continue Watching uses broad landscape thumbnails', cwBox && cwBox.width / cwBox.height > 1.5,
  cwBox ? `${cwBox.width.toFixed(0)}x${cwBox.height.toFixed(0)}` : 'missing');
const progressWidth = await cwCard.locator('div[style*="width"]').first().evaluate((el) => el.style.width).catch(() => '');
check('Continue Watching shows saved progress', /%$/.test(progressWidth), progressWidth);

// My List: save from a catalogue card, open via bottom nav (centre the card
// first — the sticky header covers the very top of the viewport)
await page.locator('#anime-grid > div').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(300);
await page.locator('#anime-grid > div').first().locator('button[title="Save to My List"]').click();
await page.waitForTimeout(300);
const savedCount = await page.evaluate(() => JSON.parse(localStorage.getItem('anistream_mylist_v1') || '[]').length);
check('card heart saves a title to My List', savedCount === 1, `${savedCount} saved`);
await page.locator('.bottom-nav-item[data-nav="mylist"]').click();
await page.waitForTimeout(400);
const myListVisible = await page.locator('#mylist-modal').evaluate((el) => !el.classList.contains('hidden'));
const myListItems = await page.locator('#mylist-modal-list img').count();
check('My List shortcut opens the saved list', myListVisible && myListItems === 1, `${myListItems} entries`);
await page.screenshot({ path: 'artifacts/mobile-mylist.png' });
await page.locator('#mylist-modal button', { hasText: 'Done' }).click();
await page.waitForTimeout(300);

// Search shortcut expands the search row and focuses it
await page.locator('#mobile-search-btn').click();
await page.waitForTimeout(300);
const searchOpen = await page.locator('#search-shell').evaluate((el) => !el.classList.contains('hidden'));
const searchFocused = await page.evaluate(() => document.activeElement?.id === 'search-input');
check('search shortcut opens and focuses the search field', searchOpen && searchFocused);

// Home shortcut returns to the top and closes the search overlay
await page.locator('.bottom-nav-item[data-nav="home"]').click();
await page.waitForTimeout(500);
const searchClosedAfterHome = await page.locator('#search-shell').evaluate((el) => el.classList.contains('hidden'));
const tabsVisibleAgain = await page.locator('#category-tabs').isVisible();
check('Home shortcut closes the search overlay', searchClosedAfterHome && tabsVisibleAgain);
await page.screenshot({ path: 'artifacts/mobile-home.png' });

// Regression: the logo/link returns to the main page. Nothing may stay parked
// over the hero — the sticky header must not cover it, and an open search row
// must be closed by the click.
await page.evaluate(() => window.scrollTo(0, 700));
await page.waitForTimeout(200);
await page.locator('#mobile-search-btn').click();
await page.waitForTimeout(300);
await page.locator('header a[href="#browse-section"]').click();
await page.waitForTimeout(800);
const heroState = await page.evaluate(() => {
  const hero = document.getElementById('hero-banner').getBoundingClientRect();
  const header = document.querySelector('header').getBoundingClientRect();
  return {
    heroTop: Math.round(hero.top),
    headerBottom: Math.round(header.bottom),
    shellHidden: document.getElementById('search-shell').classList.contains('hidden'),
    navHomeActive: document.querySelector('.bottom-nav-item[data-nav="home"]')?.classList.contains('text-brand') || false,
  };
});
check('logo link closes the search overlay and marks Home active',
  heroState.shellHidden && heroState.navHomeActive,
  `shellHidden=${heroState.shellHidden} navHome=${heroState.navHomeActive}`);
check('hero banner sits clear of the sticky header after the logo link',
  heroState.heroTop >= heroState.headerBottom,
  `hero top ${heroState.heroTop} vs header bottom ${heroState.headerBottom}`);

check('no uncaught mobile page errors', mobileErrors.length === 0, mobileErrors.join(' | '));
await mobile.close();

/* ------------------------------------------------------------------ */
/* Desktop                                                            */
/* ------------------------------------------------------------------ */
const desktop = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const deskPage = await desktop.newPage();
const deskErrors = [];
deskPage.on('pageerror', (e) => deskErrors.push(String(e)));
await deskPage.goto(BASE, { waitUntil: 'commit', timeout: 45000 });
await deskPage.waitForFunction(() => document.querySelectorAll('#anime-grid > div').length > 0, null, { timeout: 15000 });
await deskPage.waitForTimeout(900);

check('desktop hides the mobile bottom nav', await deskPage.locator('#bottom-nav').isHidden());
check('desktop shows the inline search bar', await deskPage.locator('#search-input').isVisible());
check('desktop shows the history action', await deskPage.locator('#history-counter').isVisible());
check('desktop has no drawer', (await deskPage.locator('#side-drawer, #drawer-open-btn').count()) === 0);
// The offline fallback was removed upstream; wait for the live catalogue.
await deskPage.waitForFunction(() => document.querySelectorAll('#anime-grid > div').length > 4, null, { timeout: 8000 }).catch(() => {});
check('desktop renders the catalogue grid',
  (await deskPage.locator('#anime-grid > div').count()) >= 4,
  `${await deskPage.locator('#anime-grid > div').count()} cards`);
await deskPage.screenshot({ path: 'artifacts/desktop-home.png' });
check('no uncaught desktop page errors', deskErrors.length === 0, deskErrors.join(' | '));

await browser.close();

passes.forEach((p) => console.log(p));
if (failures.length) {
  failures.forEach((f) => console.log(f));
  console.log(`\n${failures.length} layout check(s) failed.`);
  process.exit(1);
}
console.log('\nAll layout checks passed.');
