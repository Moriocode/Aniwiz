/**
 * Thumbnail quality upgrade.
 *
 * Some upstream anime CDNs serve low-resolution poster variants under `hd-1`
 * path segments (e.g. `.../poster/hd-1/<slug>.jpg`). The `hd-4` rendition is
 * the authentic high-definition poster the providers themselves display.
 *
 * Every image URL that enters the app is passed through `toHiResImage`, which
 * intercepts any `hd-1` path segment and rewrites it to `hd-4`, so the grid,
 * hero banner and detail views always pull the high-definition artwork
 * instead of the low-res variant. URLs without the segment pass through
 * untouched, and the rewrite is case-insensitive but otherwise literal, so it
 * can never mangle unrelated parts of a URL.
 */

/** Matches the low-res `hd-1` CDN path segment in any position/casing. */
const LOW_RES_SEGMENT = /hd-1/gi;

/**
 * Rewrite a poster/banner/thumbnail URL from the low-resolution `hd-1`
 * rendition to the high-definition `hd-4` one.
 *
 * Returns the input unchanged for non-strings and empty values so callers can
 * pipe optional fields through without null checks.
 */
export function toHiResImage<T extends string | null | undefined>(url: T): T {
  if (!url || typeof url !== 'string') return url;
  return url.replace(LOW_RES_SEGMENT, 'hd-4') as T;
}

/**
 * Card-sized renditions.
 *
 * Grid and rail cards display posters at roughly 144–190 CSS pixels wide, but
 * full-size AniList covers weigh 150–570 KB each. A srcset used to offer
 * `large`/`extraLarge` to high-DPI screens; phones then picked the 460 px
 * file, so 23 visible covers alone pulled ~5.9 MB (and the 900 px candidate
 * 404s for PNG covers). `toCardImage` returns the 230 px `medium` rendition
 * for every card instead: still 1.2–1.6× the CSS box, at roughly a third of
 * the bytes.
 *
 * Only AniList covers are rewritten: their renditions are addressable in the
 * URL path (`/cover/large/bx…`). Every other provider URL passes through
 * untouched — its rendition scheme is not verifiable here, and a wrong guess
 * would 404 the poster. Detail views (watch page, hero backdrop) keep the
 * full-size URL they are given.
 */

/** Matches the AniList cover rendition segment in the URL path. */
const ANILIST_COVER_SEGMENT = /\/cover\/(extraLarge|large|medium)\//;

/** True when this URL is an AniList cover whose rendition we can address. */
function isAniListCover(url: string): boolean {
  return url.includes('anilist.co') && ANILIST_COVER_SEGMENT.test(url);
}

/** Rewrite an AniList cover to the `medium` (~230×334) card rendition. */
export function toCardImage<T extends string | null | undefined>(url: T): T {
  if (!url || typeof url !== 'string' || !isAniListCover(url)) return url;
  return url.replace(ANILIST_COVER_SEGMENT, '/cover/medium/') as T;
}

