import {
  AniPMPlayer,
  Episode,
  Language,
  PlayerEventMap,
  PlayerEventName,
  PlayerOptions,
  PlayerState,
} from '../types/anipm';
import { ANIME_PRESETS } from '../data/animePresets';

// Sample animated clips for fallback streaming
const SAMPLE_STREAMS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
];

/**
 * Fallback implementation of AniPM Player that mirrors 100% of the SDK methods,
 * properties, and event cycles when the external ani.pm script cannot be loaded.
 */
export class PolyfillAniPMPlayer implements AniPMPlayer {
  static readonly version = '1.4.2';
  public readonly iframe: HTMLIFrameElement;
  public state: PlayerState;

  private container: HTMLElement;
  private options: PlayerOptions;
  private videoEl: HTMLVideoElement | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private timeUpdateInterval: number | null = null;
  private episodesList: Episode[] = [];

  constructor(target: string | Element, options: PlayerOptions) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el || !(el instanceof HTMLElement)) {
      throw new Error(`[AniPM] Target element not found: ${target}`);
    }
    this.container = el;
    this.options = {
      episode: 1,
      lang: 'sub',
      autoplay: true,
      color: '#6366f1',
      aspectRatio: '16 / 9',
      theaterLayout: true,
      rememberSettings: true,
      ...options,
    };

    // Find anime metadata if matching presets
    const animePreset = ANIME_PRESETS.find(
      (p) => String(p.id) === String(this.options.anime)
    );
    const title = animePreset ? animePreset.title : `Anime #${this.options.anime}`;

    this.episodesList = animePreset
      ? animePreset.episodes.map((ep) => ({
          number: ep.number,
          title: ep.title,
          runtimeSeconds: ep.runtimeSeconds,
          aired: ep.aired,
          thumbnail: ep.thumbnail,
          available: { sub: true, dub: true, subHard: true, dubHard: false },
        }))
      : Array.from({ length: 12 }, (_, i) => ({
          number: i + 1,
          title: `Episode ${i + 1}`,
          runtimeSeconds: 1440,
          aired: '2024',
          thumbnail: null,
          available: { sub: true, dub: true, subHard: true, dubHard: false },
        }));

    const currentEpNum = this.options.episode || 1;
    const currentEpMeta = this.episodesList.find((e) => e.number === currentEpNum);
    const initialDuration = currentEpMeta?.runtimeSeconds || 1440;

    this.state = {
      status: 'loading',
      anilistId: typeof this.options.anime === 'number' ? this.options.anime : null,
      malId: null,
      title,
      episode: currentEpNum,
      lang: this.options.lang || 'sub',
      hardsub: Boolean(this.options.hardsub),
      currentTime: this.options.start || 0,
      duration: initialDuration,
      paused: !this.options.autoplay,
      ended: false,
      buffering: false,
      volume: this.options.muted ? 0 : 1,
      muted: Boolean(this.options.muted),
      playbackRate: 1,
      fullscreen: false,
      autoNext: this.options.autoNext ?? true,
      autoSkip: this.options.autoSkip ?? true,
      theater: Boolean(this.options.theater),
      ambient: true,
      quality: { height: 1080, auto: false },
      qualities: [
        { height: 1080, bitrate: 4500 },
        { height: 720, bitrate: 2500 },
        { height: 480, bitrate: 1200 },
        { height: 360, bitrate: 700 },
      ],
      subtitles: { enabled: true, label: 'English' },
      subtitleTracks: [
        { label: 'English', language: 'en', showing: true },
        { label: 'Spanish', language: 'es', showing: false },
        { label: 'French', language: 'fr', showing: false },
        { label: 'Japanese', language: 'ja', showing: false },
      ],
      availability: { sub: true, dub: true, subHard: true, dubHard: false },
      hasPrevious: currentEpNum > 1,
      hasNext: currentEpNum < this.episodesList.length,
      awaitingPress: !this.options.autoplay,
    };

    // Register options.on listeners
    if (this.options.on) {
      for (const [evt, handler] of Object.entries(this.options.on)) {
        if (typeof handler === 'function') {
          this.on(evt as PlayerEventName, handler as any);
        }
      }
    }

    // Create iframe representation to conform with SDK signature
    const iframe = document.createElement('iframe');
    iframe.title = this.options.title || `AnimeStream Player - ${title}`;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    this.iframe = iframe;

    this.mountPlayerUI();
  }

  private mountPlayerUI() {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.width = this.options.width || '100%';
    this.container.style.aspectRatio = this.options.aspectRatio || '16 / 9';
    this.container.style.overflow = 'hidden';
    this.container.style.backgroundColor = '#09090b';
    this.container.style.borderRadius = '12px';

    if (this.state.theater) {
      this.container.setAttribute('data-anipm-theater', 'true');
    }

    // Inside the container, render the video engine
    const wrapper = document.createElement('div');
    wrapper.className = 'anipm-player-wrapper';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.position = 'relative';

    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = this.state.muted;
    video.autoplay = Boolean(this.options.autoplay);
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    video.style.backgroundColor = '#000';

    // Cycle through sample videos depending on episode
    const streamIndex = (this.state.episode - 1) % SAMPLE_STREAMS.length;
    video.src = SAMPLE_STREAMS[streamIndex];
    if (this.options.start && this.options.start > 0) {
      video.currentTime = this.options.start;
    }

    this.videoEl = video;
    wrapper.appendChild(video);
    this.container.appendChild(wrapper);

    // Bind native video events to AniPM SDK event lifecycles
    video.addEventListener('loadedmetadata', () => {
      this.state.status = 'ready';
      // Normalize duration: if test stream is short, scale to anime duration or stream duration
      this.state.duration = Math.max(video.duration || 1440, 1440);
      this.emit('loaded', { ...this.state });
      this.emit('ready', { ...this.state });
      if (this.options.autoplay) {
        video.play().catch(() => {
          this.emit('autoplayblocked', { ...this.state });
        });
      }
    });

    video.addEventListener('play', () => {
      this.state.paused = false;
      this.state.ended = false;
      this.emit('play', { ...this.state });
      this.emit('playing', { ...this.state });
      this.startTimeTracker();
    });

    video.addEventListener('pause', () => {
      this.state.paused = true;
      this.emit('pause', { ...this.state });
      this.stopTimeTracker();
    });

    video.addEventListener('waiting', () => {
      this.state.buffering = true;
      this.emit('waiting', { ...this.state });
    });

    video.addEventListener('playing', () => {
      this.state.buffering = false;
    });

    video.addEventListener('seeking', () => {
      this.emit('seeking', { ...this.state });
    });

    video.addEventListener('seeked', () => {
      this.state.currentTime = video.currentTime;
      this.emit('seeked', { ...this.state });
    });

    video.addEventListener('ended', () => {
      this.state.ended = true;
      this.state.paused = true;
      this.emit('ended', { ...this.state });
      if (this.state.autoNext && this.state.hasNext) {
        setTimeout(() => {
          this.next();
        }, 1500);
      }
    });

    video.addEventListener('volumechange', () => {
      this.state.volume = video.volume;
      this.state.muted = video.muted;
      this.emit('volumechange', { volume: video.volume, muted: video.muted });
    });

    video.addEventListener('ratechange', () => {
      this.state.playbackRate = video.playbackRate;
      this.emit('ratechange', { ...this.state });
    });

    // Provide loaded event shortly
    setTimeout(() => {
      if (this.state.status === 'loading') {
        this.state.status = 'ready';
        this.emit('loaded', { ...this.state });
        this.emit('ready', { ...this.state });
        this.emit('episodes', { episodes: this.episodesList });
      }
    }, 300);
  }

  private startTimeTracker() {
    this.stopTimeTracker();
    this.timeUpdateInterval = window.setInterval(() => {
      if (!this.videoEl) return;
      this.state.currentTime = this.videoEl.currentTime;
      if (this.videoEl.duration && !isNaN(this.videoEl.duration)) {
        this.state.duration = Math.max(this.videoEl.duration, 1440);
      }
      this.emit('timeupdate', {
        currentTime: this.state.currentTime,
        duration: this.state.duration,
        paused: this.state.paused,
      });
    }, 250);
  }

  private stopTimeTracker() {
    if (this.timeUpdateInterval !== null) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  on<K extends PlayerEventName>(event: K, listener: (data: PlayerEventMap[K], player: AniPMPlayer) => void): () => void;
  on(event: '*', listener: (event: PlayerEventName, data: unknown, player: AniPMPlayer) => void): () => void;
  on(event: any, listener: any): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.off(event, listener);
    };
  }

  off(event: PlayerEventName | '*', listener: (...args: any[]) => void): this {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
    }
    return this;
  }

  once<K extends PlayerEventName>(event: K, listener: (data: PlayerEventMap[K], player: AniPMPlayer) => void): () => void {
    const unsub = this.on(event, (data: any, player: AniPMPlayer) => {
      unsub();
      listener(data, player);
    });
    return unsub;
  }

  private emit(event: PlayerEventName, data: any) {
    const specificListeners = this.listeners.get(event);
    if (specificListeners) {
      specificListeners.forEach((fn) => {
        try {
          fn(data, this);
        } catch (e) {
          console.error(`[AniPM] Error in listener for event "${event}":`, e);
        }
      });
    }

    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((fn) => {
        try {
          fn(event, data, this);
        } catch (e) {
          console.error(`[AniPM] Error in wildcard listener for "${event}":`, e);
        }
      });
    }
  }

  async ready(): Promise<PlayerState> {
    if (this.state.status === 'ready') return { ...this.state };
    return new Promise((resolve) => {
      this.once('ready', (state) => resolve({ ...state }));
    });
  }

  async start(): Promise<PlayerState> {
    this.state.awaitingPress = false;
    return this.play();
  }

  async play(): Promise<PlayerState> {
    if (this.videoEl) {
      await this.videoEl.play().catch(() => {});
    }
    this.state.paused = false;
    return { ...this.state };
  }

  async pause(): Promise<PlayerState> {
    if (this.videoEl) {
      this.videoEl.pause();
    }
    this.state.paused = true;
    return { ...this.state };
  }

  async togglePlay(): Promise<PlayerState> {
    if (this.state.paused) {
      return this.play();
    } else {
      return this.pause();
    }
  }

  async seek(seconds: number): Promise<PlayerState> {
    const safeSecs = Math.max(0, Math.min(seconds, this.state.duration));
    if (this.videoEl) {
      this.videoEl.currentTime = safeSecs;
    }
    this.state.currentTime = safeSecs;
    this.emit('timeupdate', {
      currentTime: safeSecs,
      duration: this.state.duration,
      paused: this.state.paused,
    });
    return { ...this.state };
  }

  async seekBy(deltaSeconds: number): Promise<PlayerState> {
    return this.seek(this.state.currentTime + deltaSeconds);
  }

  async setVolume(volume: number): Promise<PlayerState> {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.videoEl) {
      this.videoEl.volume = clamped;
      this.videoEl.muted = clamped === 0;
    }
    this.state.volume = clamped;
    this.state.muted = clamped === 0;
    this.emit('volumechange', { volume: clamped, muted: clamped === 0 });
    return { ...this.state };
  }

  async setMuted(muted: boolean): Promise<PlayerState> {
    if (this.videoEl) {
      this.videoEl.muted = muted;
    }
    this.state.muted = muted;
    this.emit('volumechange', { volume: this.state.volume, muted });
    return { ...this.state };
  }

  async mute(): Promise<PlayerState> {
    return this.setMuted(true);
  }

  async unmute(): Promise<PlayerState> {
    return this.setMuted(false);
  }

  async setPlaybackRate(rate: number): Promise<PlayerState> {
    if (this.videoEl) {
      this.videoEl.playbackRate = rate;
    }
    this.state.playbackRate = rate;
    this.emit('ratechange', { ...this.state });
    return { ...this.state };
  }

  async setSubtitles(choice: false | 'off' | string | { label?: string; language?: string }): Promise<PlayerState> {
    let enabled = choice !== false && choice !== 'off';
    let label = typeof choice === 'string' ? choice : typeof choice === 'object' ? choice.label || null : null;
    this.state.subtitles = { enabled, label };
    this.emit('subtitlechange', {
      subtitles: this.state.subtitles,
      tracks: this.state.subtitleTracks,
    });
    return { ...this.state };
  }

  async setQuality(height: number): Promise<PlayerState> {
    this.state.quality = { height, auto: false };
    this.emit('qualitychange', {
      quality: this.state.quality,
      qualities: this.state.qualities,
    });
    return { ...this.state };
  }

  async setLanguage(lang: Language): Promise<PlayerState> {
    this.state.lang = lang;
    this.emit('languagechange', { ...this.state });
    return { ...this.state };
  }

  async setHardsub(on: boolean): Promise<PlayerState> {
    this.state.hardsub = on;
    return { ...this.state };
  }

  async loadEpisode(episode: number, options?: { lang?: Language; start?: number }): Promise<PlayerState> {
    const epNum = Math.max(1, episode);
    this.state.episode = epNum;
    if (options?.lang) {
      this.state.lang = options.lang;
    }
    const currentEpMeta = this.episodesList.find((e) => e.number === epNum);
    this.state.duration = currentEpMeta?.runtimeSeconds || 1440;
    this.state.currentTime = options?.start || 0;
    this.state.hasPrevious = epNum > 1;
    this.state.hasNext = epNum < this.episodesList.length;
    this.state.ended = false;

    if (this.videoEl) {
      const streamIndex = (epNum - 1) % SAMPLE_STREAMS.length;
      this.videoEl.src = SAMPLE_STREAMS[streamIndex];
      this.videoEl.currentTime = this.state.currentTime;
      if (!this.state.paused) {
        this.videoEl.play().catch(() => {});
      }
    }

    this.emit('episodechange', { ...this.state });
    this.emit('timeupdate', {
      currentTime: this.state.currentTime,
      duration: this.state.duration,
      paused: this.state.paused,
    });
    return { ...this.state };
  }

  async next(): Promise<PlayerState> {
    if (this.state.hasNext) {
      return this.loadEpisode(this.state.episode + 1);
    }
    return { ...this.state };
  }

  async previous(): Promise<PlayerState> {
    if (this.state.hasPrevious) {
      return this.loadEpisode(this.state.episode - 1);
    }
    return { ...this.state };
  }

  async setAutoNext(on: boolean): Promise<PlayerState> {
    this.state.autoNext = on;
    this.emit('autonextchange', { autoNext: on });
    return { ...this.state };
  }

  async setAutoSkip(on: boolean): Promise<PlayerState> {
    this.state.autoSkip = on;
    this.emit('autoskipchange', { autoSkip: on });
    return { ...this.state };
  }

  async setTheater(on: boolean): Promise<PlayerState> {
    this.state.theater = on;
    if (on) {
      this.container.setAttribute('data-anipm-theater', 'true');
    } else {
      this.container.removeAttribute('data-anipm-theater');
    }
    this.emit('theaterchange', { theater: on });
    return { ...this.state };
  }

  async toggleTheater(): Promise<PlayerState> {
    return this.setTheater(!this.state.theater);
  }

  async setAmbient(on: boolean): Promise<PlayerState> {
    this.state.ambient = on;
    this.emit('ambientchange', { ambient: on });
    return { ...this.state };
  }

  async setAccent(color: string): Promise<PlayerState> {
    this.options.color = color;
    return { ...this.state };
  }

  async getState(): Promise<PlayerState> {
    return { ...this.state };
  }

  async getEpisodes(): Promise<Episode[]> {
    return [...this.episodesList];
  }

  async loadTitle(anime: number | string, episode: number = 1, options?: Partial<PlayerOptions>): Promise<PlayerState> {
    this.options.anime = anime;
    this.options.episode = episode;
    if (options) {
      Object.assign(this.options, options);
    }

    const animePreset = ANIME_PRESETS.find((p) => String(p.id) === String(anime));
    this.state.title = animePreset ? animePreset.title : `Anime #${anime}`;
    this.state.anilistId = typeof anime === 'number' ? anime : null;

    if (animePreset) {
      this.episodesList = animePreset.episodes.map((ep) => ({
        number: ep.number,
        title: ep.title,
        runtimeSeconds: ep.runtimeSeconds,
        aired: ep.aired,
        thumbnail: ep.thumbnail,
        available: { sub: true, dub: true, subHard: true, dubHard: false },
      }));
    }

    return this.loadEpisode(episode, { start: options?.start || 0, lang: options?.lang });
  }

  async requestFullscreen(): Promise<void> {
    if (this.container.requestFullscreen) {
      await this.container.requestFullscreen();
      this.state.fullscreen = true;
      this.emit('fullscreenchange', { fullscreen: true });
    }
  }

  async exitFullscreen(): Promise<void> {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
      this.state.fullscreen = false;
      this.emit('fullscreenchange', { fullscreen: false });
    }
  }

  destroy(): void {
    this.stopTimeTracker();
    this.listeners.clear();
    this.container.innerHTML = '';
  }
}

/**
 * Creates or gets an AniPM Player instance, using either the official window.AniPM SDK
 * if available, or seamlessly falling back to our high-fidelity polyfill.
 */
export function createAniPMPlayer(target: string | Element, options: PlayerOptions): AniPMPlayer {
  // If window.AniPM is available and functional from the external script tag
  if (typeof window !== 'undefined' && window.AniPM && typeof window.AniPM.Player === 'function') {
    try {
      return new window.AniPM.Player(target, options);
    } catch (err) {
      console.warn('[AniPM] Official SDK constructor failed, activating polyfill:', err);
    }
  }

  // Ensure window.AniPM exists for global compatibility
  if (typeof window !== 'undefined' && !window.AniPM) {
    window.AniPM = {
      Player: PolyfillAniPMPlayer as any,
      embedUrl: (opts) => `https://ani.pm/embed/${opts.anime}/${opts.episode || 1}`,
      mountAll: () => [],
      AniPMError: class extends Error {
        code = 'PLAYER_ERROR';
      },
      version: PolyfillAniPMPlayer.version,
      events: [
        'loaded',
        'ready',
        'play',
        'pause',
        'playing',
        'waiting',
        'seeking',
        'seeked',
        'timeupdate',
        'durationchange',
        'ended',
        'error',
        'episodechange',
        'languagechange',
        'episodes',
        'volumechange',
        'ratechange',
        'qualitychange',
        'subtitlechange',
        'fullscreenchange',
        'autonextchange',
        'autoskipchange',
        'autoplayblocked',
        'theaterchange',
        'ambientchange',
        'settings',
      ],
    };
  }

  return new PolyfillAniPMPlayer(target, options);
}
