import { AnimeItem } from './types';
import { ANIME_PRESETS } from '../../data/animePresets';

/**
 * Offline fallback catalog.
 *
 * Rendered by index.html when every live provider (AniList, AniWixi, HiAnime,
 * Anivexa, AniKoto, ANIME-API) is unreachable, so the spotlight hero and the
 * catalog grid are never empty. Items are derived from ANIME_PRESETS, which
 * already carries real titles, synopses, cover art, genres and episode counts.
 */
const FALLBACK_RATINGS: Record<string, number> = {
  '154587': 9.1, // Frieren: Beyond Journey's End
  '113415': 8.5, // Jujutsu Kaisen
  '101922': 8.7, // Demon Slayer
  '151807': 8.3, // Solo Leveling
};

export const FALLBACK_ANIME_CATALOG: AnimeItem[] = ANIME_PRESETS.map((preset, index) => {
  const id = String(preset.id);
  const title = preset.title;

  return {
    id,
    anilistId: Number(preset.id),
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    title,
    altTitle: preset.romaji,
    synopsis: preset.description,
    poster: preset.coverImage,
    banner: preset.bannerImage,
    rating: FALLBACK_RATINGS[id] ?? 8.5,
    score: `${Math.round((FALLBACK_RATINGS[id] ?? 8.5) * 10)}%`,
    quality: 'HD',
    type: 'TV',
    duration: `${preset.episodes[0]?.runtimeSeconds
      ? Math.round(preset.episodes[0].runtimeSeconds / 60)
      : 24}m`,
    year: preset.year,
    season: preset.season,
    status: 'Completed',
    genres: preset.genres,
    studios: [],
    totalEpisodes: preset.totalEpisodes,
    subEpisodes: preset.totalEpisodes,
    dubEpisodes: Math.max(1, preset.totalEpisodes - 2),
    rank: index + 1,
    isTrending: true,
    isPopular: true,
  };
});
