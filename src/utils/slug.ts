/**
 * URL slug helpers.
 *
 * Shared by the browser router (index.html) and the sitemap route handler
 * (server/seoRoutes.ts) so a title always produces exactly one URL. Keep the
 * output ASCII-only: Google indexes it cleanly and the same slug survives
 * copy/paste, even for titles with accents or Japanese punctuation.
 */

export interface SlugSource {
  id: string | number;
  title: string;
}

/** Turn a title into a lowercase ASCII slug: "Kaguya-sama: Love Is War" → "kaguya-sama-love-is-war". */
export function slugifyTitle(title: string): string {
  const slug = String(title ?? '')
    .normalize('NFKD')
    // Strip combining marks so "Pokémon" and "Pokemon" share one URL.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'anime';
}

/**
 * Assign one slug per catalogue entry, in catalogue order.
 *
 * Duplicate titles (remakes, seasons sharing a name) get their upstream id as
 * a suffix, which keeps every URL stable and unique without an external store.
 * Both the router and the sitemap run this over the same ordered catalogue, so
 * the generated links match exactly.
 */
export function buildAnimeSlugMap(items: SlugSource[]): Map<string, string> {
  const byId = new Map<string, string>();
  const owners = new Map<string, string>();

  for (const item of items) {
    if (!item || item.id == null) continue;
    const id = String(item.id);
    if (byId.has(id)) continue;

    const base = slugifyTitle(item.title);
    let slug = base;
    if (owners.has(slug) && owners.get(slug) !== id) {
      slug = `${base}-${id}`;
      let suffix = 2;
      while (owners.has(slug) && owners.get(slug) !== id) {
        slug = `${base}-${id}-${suffix}`;
        suffix += 1;
      }
    }

    byId.set(id, slug);
    owners.set(slug, id);
  }

  return byId;
}

export const SITE_NAME = 'AniStream';

/** `/anime/kaguya-sama-love-is-war` */
export function animePath(slug: string): string {
  return `/anime/${slug}`;
}

/** `/anime/kaguya-sama-love-is-war/episode/3` */
export function animeEpisodePath(slug: string, episode: number): string {
  return `/anime/${slug}/episode/${Number(episode)}`;
}
