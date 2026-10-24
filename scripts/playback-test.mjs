/**
 * Per-server playback verification.
 *
 * For each of the five servers (HD-1 AniWixi embed, HD-2 ani.pm embed,
 * HD-3 native HLS, HD-4 Shonen embed, HD-5 Anigato embed) this asserts
 * *playback evidence*, not just that a player frame mounted:
 *   - HD-3: a <video> reaches readyState >= 2 with a real duration AND
 *     currentTime advances while playing.
 *   - HD-1/2/4/5: the cross-origin iframe actually navigates to its embed URL
 *     and the main resource answers HTTP 200 (no immediate error page).
 *
 * Usage: BASE_URL=http://127.0.0.1:3000 node scripts/playback-test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const failures = [];
const notes = [];

function check(label, condition, detail = '') {
  if (condition) notes.push(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  else failures.push(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const responses = new Map();
page.on('response', (res) => responses.set(res.url(), res.status()));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#anime-grid .group', { timeout: 30000 });

// Open the first real catalog card.
await page.click('#anime-grid .group');
await page.waitForSelector('#watch-section:not(.hidden)', { timeout: 15000 });
// The player only resolves streams once the episode list is ready — wait for
// it explicitly instead of sleeping a fixed amount (fixed sleeps made this
// test flaky against live API latency).
await page.waitForSelector('#episodes-container > a', { timeout: 20000 });
await page.waitForSelector('.server-btn', { timeout: 15000 });
await page.waitForTimeout(1500);

const serverButtons = await page.$$('.server-btn');
check('server picker exposes 5 servers', serverButtons.length === 5, `${serverButtons.length} buttons`);

async function framesSnapshot() {
  const snap = [];
  for (const f of page.frames()) {
    if (f === page.mainFrame()) continue;
    const url = f.url();
    snap.push({ url, status: responses.get(url) ?? null });
  }
  return snap;
}

/** Poll until a frame whose URL matches `pattern` exists (up to timeoutMs). */
async function waitForEmbedFrame(pattern, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frames = (await framesSnapshot()).filter((f) => f.url && !f.url.startsWith('about:'));
    const hit = frames.find((f) => pattern.test(f.url));
    if (hit) return hit;
    await page.waitForTimeout(500);
  }
  return null;
}

/** Click a server button and wait for its player surface to appear. */
async function activateServer(id) {
  await page.click(`#server-btn-${id}`);
  await page.waitForTimeout(1000);
}

// --- HD-3: native HLS (opt-in; HD-4 is the default) ---
{
  await activateServer(3);
  // Wait for the HLS player to mount rather than assuming a fixed delay.
  let videoSel = null;
  try {
    await page.waitForSelector('#watch-section video', { timeout: 15000 });
    videoSel = '#watch-section video';
  } catch { videoSel = null; }
  const info = await page.evaluate(async (sel) => {
    const v = sel ? document.querySelector(sel) : (document.querySelector('video'));
    if (!v) return { found: false };
    const before = v.currentTime;
    let playing = false;
    let err = null;
    try { await v.play(); playing = true; } catch (e) { err = String(e); }
    await new Promise((r) => setTimeout(r, 4000));
    return {
      found: true, playing, err,
      readyState: v.readyState,
      duration: Number.isFinite(v.duration) ? v.duration : null,
      before, after: v.currentTime,
      mediaError: v.error ? v.error.code : null,
      src: (v.currentSrc || v.src || '').slice(0, 120),
    };
  }, videoSel);
  check('HD-3 native HLS: video element found', info.found);
  if (info.found) {
    check('HD-3 native HLS: real duration loaded', info.duration > 60, `${info.duration}s`);
    check('HD-3 native HLS: readyState has data', info.readyState >= 2, `readyState=${info.readyState}`);
    check('HD-3 native HLS: currentTime advances', info.after > info.before, `${info.before.toFixed(2)} -> ${info.after.toFixed(2)}`);
    check('HD-3 native HLS: no media error', info.mediaError === null, `mediaError=${info.mediaError}`);
  }
}

// --- HD-1: AniWixi embed ---
{
  await activateServer(1);
  const embed = await waitForEmbedFrame(/aniwixi/);
  check('HD-1 AniWixi: embed iframe loaded', Boolean(embed), embed ? `${embed.url.slice(0, 100)} status=${embed.status}` : 'no iframe within 12s');
  if (embed) check('HD-1 AniWixi: embed responded HTTP 200', embed.status === 200, `status=${embed.status}`);
}

// --- HD-2: ani.pm embed ---
{
  await activateServer(2);
  const embed = await waitForEmbedFrame(/ani\.pm/);
  check('HD-2 ani.pm: embed iframe loaded', Boolean(embed), embed ? `${embed.url.slice(0, 100)} status=${embed.status}` : 'no iframe within 12s');
  if (embed) check('HD-2 ani.pm: embed responded HTTP 200', embed.status === 200, `status=${embed.status}`);
}

// --- HD-4: Shonen embed ---
{
  await activateServer(4);
  const embed = await waitForEmbedFrame(/shonen/);
  check('HD-4 Shonen: embed iframe loaded', Boolean(embed), embed ? `${embed.url.slice(0, 100)} status=${embed.status}` : 'no iframe within 12s');
  if (embed) check('HD-4 Shonen: embed responded HTTP 200', embed.status === 200, `status=${embed.status}`);
}

// --- HD-5: Anigato embed (server id 7) ---
{
  await activateServer(7);
  const embed = await waitForEmbedFrame(/anigato\.lol\/embed\/anime\//);
  check('HD-5 Anigato: embed iframe loaded', Boolean(embed), embed ? `${embed.url.slice(0, 110)} status=${embed.status}` : 'no iframe within 12s');
  if (embed) check('HD-5 Anigato: embed responded HTTP 200', embed.status === 200, `status=${embed.status}`);
}

// Known-external noise that originates inside third-party embeds, not in
// this app's code: blocked ad/tracker subresources (net errors, 404s) and
// ad frames inside provider embed pages that set X-Frame-Options (e.g.
// embed.settlar.io inside ani.pm/Shonen players).
const EXTERNAL_NOISE = [
  /net::ERR/,
  /Failed to load resource/,
  /404/,
  /Refused to display .* in a frame because it set ['"]?X-Frame-Options/i,
];
const severe = consoleErrors.filter((e) => !EXTERNAL_NOISE.some((re) => re.test(e)));
check('no unexpected console errors', severe.length === 0, severe.slice(0, 3).join(' | '));

await browser.close();

console.log('\n--- playback checks ---');
notes.forEach((n) => console.log(n));
failures.forEach((f) => console.log(f));
if (consoleErrors.length) console.log(`console errors: ${consoleErrors.length} (see above)`);
console.log(failures.length ? `\n${failures.length} check(s) failed.` : '\nAll playback checks passed.');
process.exit(failures.length ? 1 : 0);
