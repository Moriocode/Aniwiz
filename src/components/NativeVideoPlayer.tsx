import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  Monitor,
  Settings,
  Sparkles,
} from 'lucide-react';
import { VideoEpisode, VideoQualityOption } from '../types/media';

interface NativeVideoPlayerProps {
  mediaId: string;
  episode: VideoEpisode;
  initialTime?: number;
  theaterMode: boolean;
  onToggleTheater: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEpisodeEnded?: () => void;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
}

export const NativeVideoPlayer: React.FC<NativeVideoPlayerProps> = ({
  mediaId,
  episode,
  initialTime = 0,
  theaterMode,
  onToggleTheater,
  onTimeUpdate,
  onEpisodeEnded,
  onNextEpisode,
  hasNextEpisode = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Sources and quality
  const sources = episode.videoSources && episode.videoSources.length > 0
    ? episode.videoSources
    : [{ label: '1080p', height: 1080, src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4' }];

  const [activeQuality, setActiveQuality] = useState<VideoQualityOption>(sources[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(episode.durationSeconds || 1440);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const totalSecs = Math.floor(secs);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Autohide controls on inactivity
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
        setShowQualityMenu(false);
        setShowSpeedMenu(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Initial time seek & source setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (initialTime > 0) {
      video.currentTime = initialTime;
    }
    video.play().catch(() => {
      setIsPlaying(false);
    });
  }, [episode.id]);

  // Video Native Listeners
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const cur = video.currentTime;
    const dur = video.duration || episode.durationSeconds || 1440;
    setCurrentTime(cur);
    setDuration(dur);

    // Track buffer range
    if (video.buffered.length > 0) {
      setBufferedTime(video.buffered.end(video.buffered.length - 1));
    }

    if (onTimeUpdate) {
      onTimeUpdate(cur, dur);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
    resetControlsTimeout();
  };

  const handleSeek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, Math.min(seconds, duration));
    video.currentTime = target;
    setCurrentTime(target);
  };

  const handleSeekOffset = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    handleSeek(video.currentTime + delta);
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressBarRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pct * 100);
    setHoverTime(pct * duration);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressBarRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    handleSeek(pct * duration);
  };

  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    video.volume = clamped;
    video.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      video.volume = 0.5;
      setVolume(0.5);
    }
  };

  const handleQualityChange = (q: VideoQualityOption) => {
    const video = videoRef.current;
    const savedTime = video ? video.currentTime : currentTime;
    const wasPlaying = video ? !video.paused : false;

    setActiveQuality(q);
    setShowQualityMenu(false);

    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = savedTime;
        if (wasPlaying) {
          videoRef.current.play().catch(() => {});
        }
      }
    }, 50);
  };

  const handleSpeedChange = (rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is in an input field
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
          e.preventDefault();
          handleSeekOffset(-10);
          break;
        case 'arrowright':
          e.preventDefault();
          handleSeekOffset(10);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 't':
          e.preventDefault();
          onToggleTheater();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
      className={`relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-[#1A202C] shadow-2xl select-none group ${
        theaterMode ? 'max-h-[85vh]' : ''
      }`}
    >
      {/* Native HTML5 Video Element */}
      <video
        ref={videoRef}
        src={activeQuality.src}
        playsInline
        preload="auto"
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (onEpisodeEnded) onEpisodeEnded();
        }}
      />

      {/* Center Large Play/Pause Watermark on Pause */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer transition-opacity z-10"
        >
          <div className="w-16 h-16 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-xl shadow-red-600/30 hover:scale-105 transition-transform">
            <Play className="w-7 h-7 fill-current ml-1" />
          </div>
        </div>
      )}

      {/* Top Overlay: Title & Indicators */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent flex items-center justify-between transition-opacity duration-300 z-20 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-600 text-white">
            EP {episode.number}
          </span>
          <span className="text-sm font-semibold text-zinc-100 truncate max-w-xs sm:max-w-md">
            {episode.title}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
          <span className="hidden sm:inline bg-[#131824] border border-[#1e2536] px-2 py-0.5 rounded text-[11px] text-zinc-300">
            Native .mp4 Stream
          </span>
        </div>
      </div>

      {/* Bottom Overlay: Custom Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-20 space-y-2 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrubber Progress Bar */}
        <div
          ref={progressBarRef}
          onClick={handleProgressBarClick}
          onMouseMove={handleProgressBarMouseMove}
          onMouseLeave={() => setHoverTime(null)}
          className="relative h-2 w-full bg-[#1E232F] rounded-full cursor-pointer py-1 -my-1 group/bar"
        >
          {/* Buffered track */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-[#2D3547] rounded-full transition-[width] duration-200 pointer-events-none"
            style={{ width: `${Math.min(100, bufferPercent)}%` }}
          />

          {/* Active progress track */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-red-600 rounded-full transition-[width] duration-75 pointer-events-none"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />

          {/* Scrub Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${progressPercent}%` }}
          />

          {/* Hover Time Tooltip */}
          {hoverTime !== null && hoverPosition !== null && (
            <div
              className="absolute bottom-5 -translate-x-1/2 bg-[#0B0E14] border border-[#232938] text-white font-mono text-[11px] px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Action Controls Deck */}
        <div className="flex items-center justify-between gap-2 text-xs pt-1">
          {/* Left Actions: Play, Seek, Volume, Timestamps */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 rounded hover:bg-[#1E232F] text-zinc-200 hover:text-white transition-colors"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => handleSeekOffset(-10)}
              className="p-1.5 rounded hover:bg-[#1E232F] text-zinc-400 hover:text-white transition-colors"
              title="Rewind 10s (Left Arrow)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleSeekOffset(10)}
              className="p-1.5 rounded hover:bg-[#1E232F] text-zinc-400 hover:text-white transition-colors"
              title="Forward 10s (Right Arrow)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Volume control */}
            <div className="flex items-center gap-1.5 ml-1">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded hover:bg-[#1E232F] text-zinc-300 hover:text-white transition-colors"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-14 sm:w-20 accent-red-600 h-1 bg-[#272F40] rounded cursor-pointer"
                title="Volume"
              />
            </div>

            {/* Timestamps */}
            <div className="flex items-center gap-1 font-mono text-[11px] text-zinc-400 ml-2">
              <span className="text-zinc-200">{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Actions: Speed, Quality, Theater, Fullscreen */}
          <div className="flex items-center gap-1.5">
            {/* Speed Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowQualityMenu(false);
                }}
                className="px-2 py-1 rounded hover:bg-[#1E232F] text-zinc-300 hover:text-white font-mono text-[11px] transition-colors"
                title="Playback Speed"
              >
                {playbackRate}x
              </button>

              {showSpeedMenu && (
                <div className="absolute right-0 bottom-full mb-2 bg-[#0E121A] border border-[#1E232F] rounded-lg p-1 shadow-xl z-30 min-w-[70px]">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleSpeedChange(rate)}
                      className={`w-full text-left px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                        playbackRate === rate ? 'bg-red-600 text-white font-semibold' : 'text-zinc-400 hover:bg-[#1A202C] hover:text-zinc-200'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quality Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowQualityMenu(!showQualityMenu);
                  setShowSpeedMenu(false);
                }}
                className="px-2 py-1 rounded hover:bg-[#1E232F] text-zinc-300 hover:text-white font-mono text-[11px] flex items-center gap-1 transition-colors"
                title="Stream Resolution"
              >
                <span>{activeQuality.label}</span>
              </button>

              {showQualityMenu && (
                <div className="absolute right-0 bottom-full mb-2 bg-[#0E121A] border border-[#1E232F] rounded-lg p-1 shadow-xl z-30 min-w-[100px]">
                  {sources.map((q) => (
                    <button
                      key={q.height}
                      type="button"
                      onClick={() => handleQualityChange(q)}
                      className={`w-full text-left px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                        activeQuality.height === q.height ? 'bg-red-600 text-white font-semibold' : 'text-zinc-400 hover:bg-[#1A202C] hover:text-zinc-200'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theater Mode Button */}
            <button
              type="button"
              onClick={onToggleTheater}
              className={`p-1.5 rounded transition-colors ${
                theaterMode ? 'bg-red-600/20 text-red-400' : 'hover:bg-[#1E232F] text-zinc-400 hover:text-white'
              }`}
              title="Theater Mode (T)"
            >
              <Monitor className="w-4 h-4" />
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded hover:bg-[#1E232F] text-zinc-400 hover:text-white transition-colors"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
