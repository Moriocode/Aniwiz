/**
 * Shared AniWixi (WordPress REST) client.
 *
 * AniWixi reflects the caller's Origin in `Access-Control-Allow-Origin`, so the
 * browser can call the API directly. The local `/api/aniwixi/*` proxy is kept
 * as a fallback for networks that block it (and it adds browser-like headers
 * upstream).
 */

const DIRECT_BASE = 'https://aniwixi.xyz/wp-json/aniwixi/v1';
const PROXY_BASE = '/api/aniwixi';
const DIRECT_TIMEOUT_MS = 7000;
const PROXY_TIMEOUT_MS = 8000;

async function fetchJson(url: string, timeoutMs: number): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET one AniWixi API path (e.g. `anime?page=1&per_page=50`, `search?q=naruto`,
 * `anilist/20`). Returns the parsed JSON body, or null when both the direct
 * request and the proxy fail.
 */
export async function requestAniwixi<T = any>(path: string): Promise<T | null> {
  const direct = await fetchJson(`${DIRECT_BASE}/${path}`, DIRECT_TIMEOUT_MS);
  if (direct) return direct as T;

  const proxied = await fetchJson(`${PROXY_BASE}/${path}`, PROXY_TIMEOUT_MS);
  return (proxied as T) || null;
}
