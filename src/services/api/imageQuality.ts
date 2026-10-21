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
