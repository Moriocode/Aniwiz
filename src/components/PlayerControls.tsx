import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Monitor,
  Settings,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { Language, PlayerState, Quality } from '../types/anipm';
import { formatTime } from '../services/watchProgressService';

interface PlayerControlsProps {
  state: PlayerState;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSeekBy: (delta: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSetLanguage: (lang: Language) => void;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
  onSetPlaybackRate: (rate: number) => void;
  onSetQuality: (height: number) => void;
  onToggleTheater: () => void;
  onToggleAutoNext: () => void;
  onToggleAutoSkip: () => void;
  onToggleFullscreen: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  state,
  onTogglePlay,
  onSeek,
  onSeekBy,
  onPrevious,
  onNext,
  onSetLanguage,
  onSetVolume,
  onToggleMute,
  onSetPlaybackRate,
  onSetQuality,
  onToggleTheater,
  onToggleAutoNext,
  onToggleAutoSkip,
  onToggleFullscreen,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const duration = state.duration > 0 ? state.duration : 1440;
  const currentTime = state.currentTime || 0;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  const handleProgressBarMouseLeave = () => {
    setHoverTime(null);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pos * duration);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl select-none">
      {/* Scrubbable Progress Bar */}
      <div className="space-y-1 mb-3">
        <div
          ref={progressBarRef}
          onClick={handleProgressBarClick}
          onMouseMove={handleProgressBarMouseMove}
          onMouseLeave={handleProgressBarMouseLeave}
          className="relative h-2 w-full bg-zinc-800 rounded-full cursor-pointer group py-1 -my-1"
        >
          {/* Track background */}
          <div className="w-full h-1.5 bg-zinc-800 group-hover:h-2.5 rounded-full overflow-hidden transition-all relative">
            {/* Active progress fill */}
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full relative transition-[width] duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Hover Scrubbing Line */}
          {hoverTime !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/60 pointer-events-none"
              style={{ left: `${hoverPosition}%` }}
            />
          )}

          {/* Hover Time Tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute bottom-4 -translate-x-1/2 bg-zinc-950 border border-zinc-700 text-white font-mono text-[11px] px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-20"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Scrub Handle / Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        {/* Timestamps & Info Row */}
        <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-zinc-200">{formatTime(currentTime)}</span>
            <span className="text-zinc-600">/</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-indigo-400 font-semibold">{Math.round(progressPercent)}% watched</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">Ep {state.episode}</span>
          </div>
        </div>
      </div>

      {/* Control Buttons Deck */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Left: Playback controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Previous Episode */}
          <button
            onClick={onPrevious}
            disabled={!state.hasPrevious}
            className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white transition-colors"
            title="Previous Episode"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Seek -10s */}
          <button
            onClick={() => onSeekBy(-10)}
            className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="Rewind 10 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Play / Pause Toggle */}
          <button
            onClick={onTogglePlay}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-colors"
            title={state.paused ? 'Play' : 'Pause'}
          >
            {state.paused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            <span className="text-xs font-semibold">{state.paused ? 'Play' : 'Pause'}</span>
          </button>

          {/* Seek +10s */}
          <button
            onClick={() => onSeekBy(10)}
            className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="Fast forward 10 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Next Episode */}
          <button
            onClick={onNext}
            disabled={!state.hasNext}
            className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white transition-colors"
            title="Next Episode"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-1.5 ml-2 group">
            <button
              onClick={onToggleMute}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title={state.muted ? 'Unmute' : 'Mute'}
            >
              {state.muted || state.volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : state.volume < 0.5 ? (
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
              value={state.muted ? 0 : state.volume}
              onChange={(e) => onSetVolume(parseFloat(e.target.value))}
              className="w-16 sm:w-20 accent-indigo-500 h-1 bg-zinc-700 rounded-lg cursor-pointer"
              title="Volume"
            />
          </div>
        </div>

        {/* Right: Language, Settings, Theater, Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* SUB / DUB Toggle */}
          <div className="flex items-center bg-zinc-800/90 rounded-lg p-0.5 border border-zinc-700/60">
            <button
              onClick={() => onSetLanguage('sub')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                state.lang === 'sub'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              SUB
            </button>
            <button
              onClick={() => onSetLanguage('dub')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                state.lang === 'dub'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              DUB
            </button>
          </div>

          {/* Speed / Rate Selector */}
          <select
            value={state.playbackRate}
            onChange={(e) => onSetPlaybackRate(parseFloat(e.target.value))}
            className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs rounded-lg px-2 py-1.5 border border-zinc-700/80 focus:outline-none focus:border-indigo-500 cursor-pointer"
            title="Playback Speed"
          >
            <option value="0.75">0.75x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2.0x</option>
          </select>

          {/* Quality Selector */}
          {state.qualities && state.qualities.length > 0 && (
            <select
              value={state.quality?.height || 1080}
              onChange={(e) => onSetQuality(parseInt(e.target.value))}
              className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs rounded-lg px-2 py-1.5 border border-zinc-700/80 focus:outline-none focus:border-indigo-500 cursor-pointer"
              title="Stream Quality"
            >
              {state.qualities.map((q) => (
                <option key={q.height} value={q.height}>
                  {q.height}p
                </option>
              ))}
            </select>
          )}

          {/* Additional Settings Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg border transition-colors ${
                showSettings
                  ? 'bg-zinc-800 text-white border-zinc-600'
                  : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white border-transparent'
              }`}
              title="Playback Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {showSettings && (
              <div className="absolute right-0 bottom-full mb-2 w-56 bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-2xl z-30 space-y-2 animate-in fade-in zoom-in-95">
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  Playback Preferences
                </div>

                {/* Auto-Next */}
                <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer hover:text-white py-1">
                  <span>Auto-Play Next</span>
                  <input
                    type="checkbox"
                    checked={state.autoNext}
                    onChange={onToggleAutoNext}
                    className="accent-indigo-500 rounded cursor-pointer"
                  />
                </label>

                {/* Auto-Skip */}
                <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer hover:text-white py-1">
                  <span>Auto-Skip Intros</span>
                  <input
                    type="checkbox"
                    checked={state.autoSkip}
                    onChange={onToggleAutoSkip}
                    className="accent-indigo-500 rounded cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Theater Mode Toggle */}
          <button
            onClick={onToggleTheater}
            className={`p-2 rounded-lg transition-colors ${
              state.theater
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white'
            }`}
            title="Toggle Theater Mode"
          >
            <Monitor className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={onToggleFullscreen}
            className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            title="Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
