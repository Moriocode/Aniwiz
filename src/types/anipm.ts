/**
 * Type definitions for the ani.pm Player SDK v1
 * Reference: https://ani.pm/developers
 */

export type Language = 'sub' | 'dub';
export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface Quality {
  height: number;
  bitrate: number | null;
}

export interface SubtitleTrack {
  label: string;
  language: string;
  showing: boolean;
}

export interface Availability {
  sub: boolean;
  dub: boolean;
  subHard: boolean;
  dubHard: boolean;
}

export interface PlayerState {
  status: PlayerStatus;
  anilistId: number | null;
  malId: number | null;
  title: string;
  episode: number;
  lang: Language;
  hardsub: boolean;
  currentTime: number;
  duration: number;
  paused: boolean;
  ended: boolean;
  buffering: boolean;
  volume: number;
  muted: boolean;
  playbackRate: number;
  fullscreen: boolean;
  autoNext: boolean;
  autoSkip: boolean;
  /** Theater mode: the player's big-canvas presentation (pause menu, ambient glow). */
  theater: boolean;
  /** The ambient glow on this device; null until the player has said. */
  ambient: boolean | null;
  quality: { height: number | null; auto: boolean } | null;
  qualities: Quality[];
  subtitles: { enabled: boolean | null; label: string | null };
  subtitleTracks: SubtitleTrack[];
  availability: Availability | null;
  hasPrevious: boolean;
  hasNext: boolean;
  /** True while an autoplay: false player waits on its title poster for the viewer to press Play. */
  awaitingPress?: boolean;
}

export interface Episode {
  number: number;
  title: string | null;
  runtimeSeconds: number | null;
  aired: string | null;
  thumbnail: string | null;
  available: Availability;
}

export interface PlayerEventMap {
  loaded: PlayerState;
  ready: PlayerState;
  play: PlayerState;
  pause: PlayerState;
  playing: PlayerState;
  waiting: PlayerState;
  seeking: PlayerState;
  seeked: PlayerState;
  timeupdate: { currentTime: number; duration: number; paused: boolean };
  durationchange: PlayerState;
  ended: PlayerState;
  error: { code: string; message: string };
  episodechange: PlayerState;
  languagechange: PlayerState;
  episodes: { episodes: Episode[] };
  volumechange: { volume: number; muted: boolean } | PlayerState;
  ratechange: PlayerState;
  qualitychange: { quality: PlayerState['quality']; qualities: Quality[] };
  subtitlechange: { subtitles: PlayerState['subtitles']; tracks: SubtitleTrack[] };
  fullscreenchange: { fullscreen: boolean };
  autonextchange: { autoNext: boolean };
  autoskipchange: { autoSkip: boolean };
  autoplayblocked: PlayerState;
  theaterchange: { theater: boolean };
  ambientchange: { ambient: boolean };
  settings: { settings: unknown };
}

export type PlayerEventName = keyof PlayerEventMap;

export interface PlayerOptions {
  key?: string;
  anime: number | string;
  episode?: number;
  lang?: Language;
  hardsub?: boolean;
  start?: number;
  autoplay?: boolean;
  muted?: boolean;
  poster?: boolean;
  autoNext?: boolean;
  autoSkip?: boolean;
  theater?: boolean;
  theaterLayout?: boolean;
  rememberSettings?: boolean;
  reportPage?: boolean;
  episodes?: boolean;
  color?: string;
  subtitles?: string;
  title?: string;
  width?: string;
  height?: string | number;
  aspectRatio?: string;
  lazy?: boolean;
  api?: boolean;
  adult?: boolean;
  on?: Partial<{ [K in PlayerEventName]: (data: PlayerEventMap[K], player: AniPMPlayer) => void }>;
}

export interface AniPMPlayer {
  readonly iframe: HTMLIFrameElement;
  readonly state: PlayerState;
  on<K extends PlayerEventName>(event: K, listener: (data: PlayerEventMap[K], player: AniPMPlayer) => void): () => void;
  on(event: '*', listener: (event: PlayerEventName, data: unknown, player: AniPMPlayer) => void): () => void;
  off(event: PlayerEventName | '*', listener: (...args: any[]) => void): this;
  once<K extends PlayerEventName>(event: K, listener: (data: PlayerEventMap[K], player: AniPMPlayer) => void): () => void;
  ready(): Promise<PlayerState>;
  start(): Promise<PlayerState>;
  play(): Promise<PlayerState>;
  pause(): Promise<PlayerState>;
  togglePlay(): Promise<PlayerState>;
  seek(seconds: number): Promise<PlayerState>;
  seekBy(deltaSeconds: number): Promise<PlayerState>;
  setVolume(volume: number): Promise<PlayerState>;
  setMuted(muted: boolean): Promise<PlayerState>;
  mute(): Promise<PlayerState>;
  unmute(): Promise<PlayerState>;
  setPlaybackRate(rate: number): Promise<PlayerState>;
  setSubtitles(choice: false | 'off' | string | { label?: string; language?: string }): Promise<PlayerState>;
  setQuality(height: number): Promise<PlayerState>;
  setLanguage(lang: Language): Promise<PlayerState>;
  setHardsub(on: boolean): Promise<PlayerState>;
  loadEpisode(episode: number, options?: { lang?: Language; start?: number }): Promise<PlayerState>;
  next(): Promise<PlayerState>;
  previous(): Promise<PlayerState>;
  setAutoNext(on: boolean): Promise<PlayerState>;
  setAutoSkip(on: boolean): Promise<PlayerState>;
  setTheater(on: boolean): Promise<PlayerState>;
  toggleTheater(): Promise<PlayerState>;
  setAmbient(on: boolean): Promise<PlayerState>;
  setAccent(color: string): Promise<PlayerState>;
  getState(): Promise<PlayerState>;
  getEpisodes(): Promise<Episode[]>;
  loadTitle(anime: number | string, episode?: number, options?: Partial<PlayerOptions>): Promise<PlayerState>;
  requestFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  destroy(): void;
}

export interface WatchProgressRecord {
  animeId: string | number;
  animeTitle: string;
  episode: number;
  currentTime: number;
  duration: number;
  percentage: number;
  updatedAt: number;
  completed: boolean;
}

declare global {
  interface Window {
    AniPM?: {
      Player: new (target: string | Element, options: PlayerOptions) => AniPMPlayer;
      embedUrl: (options: PlayerOptions) => string;
      mountAll: (scope?: ParentNode) => AniPMPlayer[];
      AniPMError: new (message?: string) => Error & { code: string };
      version: string;
      events: PlayerEventName[];
    };
  }
}
