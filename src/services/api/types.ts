/**
 * Unified Anime Streaming Data Types & Interfaces
 * Designed for modular multi-provider integration (HiAnime, AniWatch, AniList, Consumet, etc.)
 */

export interface AnimeItem {
  id: string;
  anilistId?: number;
  slug?: string;
  title: string;
  altTitle?: string;
  japaneseTitle?: string;
  synopsis: string;
  poster: string;
  banner?: string;
  rating: number; // e.g. 9.2
  score?: string; // e.g. "88%"
  quality: 'HD' | 'FHD' | '4K' | 'SD';
  type: 'TV' | 'Movie' | 'OVA' | 'ONA' | 'Special';
  duration: string; // e.g. "24m"
  year: number;
  season?: string;
  status: 'Ongoing' | 'Completed' | 'Upcoming';
  genres: string[];
  studios: string[];
  totalEpisodes: number;
  subEpisodes?: number;
  dubEpisodes?: number;
  rank?: number;
  isPopular?: boolean;
  isTrending?: boolean;
}

export interface AnimeEpisode {
  id: string;
  number: number;
  title: string;
  japaneseTitle?: string;
  isFiller: boolean;
  durationSeconds?: number;
  thumbnail?: string;
  airedAt?: string;
}

export type StreamAudioMode = 'sub' | 'dub' | 'raw';

export interface StreamServerOption {
  id: string | number;
  name: string; // e.g. "Server 1 (HD-1)", "Server 2 (MegaCloud)"
  serverId: number;
  type: StreamAudioMode;
  embedUrl: string;
  quality?: string;
  subtitle?: string | null;
  isPrimary?: boolean;
}

export interface StreamSourceResult {
  streamUrl: string;
  type: 'iframe' | 'hls' | 'mp4';
  serverName: string;
  audioMode: StreamAudioMode;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  subtitles?: Array<{ lang: string; url: string; default?: boolean }>;
  variants?: Array<{ name: string; quality: string; url?: string }>;
}

export interface AiringScheduleItem {
  day: string;
  date: string;
  animes: Array<{
    title: string;
    episode: number;
    time: string;
    anilistId?: number;
    poster?: string;
  }>;
}

/**
 * Standard Provider Contract for GitHub-based Scrapers & API Integrations
 */
export interface IAnimeProvider {
  readonly name: string;
  readonly id: string;
  readonly version: string;
  readonly website?: string;

  getSpotlight(): Promise<AnimeItem[]>;
  getTrending(): Promise<AnimeItem[]>;
  getTopAiring(): Promise<AnimeItem[]>;
  getLatestEpisodes(): Promise<AnimeItem[]>;
  search(query: string, page?: number): Promise<{ results: AnimeItem[]; total: number }>;
  getSuggestions(query: string): Promise<Array<{ id: string; title: string; poster: string; rating: number }>>;
  getAnimeDetails(id: string): Promise<AnimeItem | null>;
  getEpisodes(id: string): Promise<AnimeEpisode[]>;
  getServers(animeId: string, episodeNumber: number): Promise<{
    sub: StreamServerOption[];
    dub: StreamServerOption[];
    raw?: StreamServerOption[];
  }>;
  getStreamSource(animeId: string, episodeNumber: number, serverId: number, audio: StreamAudioMode): Promise<StreamSourceResult>;
  getSchedules?(): Promise<AiringScheduleItem[]>;
}
