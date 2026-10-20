import React from 'react';
import { Play, Info, Star, Flame } from 'lucide-react';
import { MediaItem } from '../types/media';

interface HeroProps {
  item: MediaItem;
  onPlay: (item: MediaItem) => void;
  onDetails: (item: MediaItem) => void;
}

export const Hero: React.FC<HeroProps> = ({ item, onPlay, onDetails }) => {
  if (!item) return null;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl min-h-[320px] sm:min-h-[380px] flex items-end p-6 sm:p-10 mb-8">
      {/* Background Cover Image with Gradient Vignette */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 scale-105"
        style={{ backgroundImage: `url('${item.bannerImage || item.coverImage}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-transparent to-transparent" />

      {/* Hero Content */}
      <div className="relative z-10 max-w-2xl space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
            <Star className="w-3.5 h-3.5 fill-current" />
            {item.rating || 9.1}
          </span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-300 font-mono">{item.status || 'Ongoing'}</span>
          <span className="text-zinc-500">·</span>
          <span className="flex items-center gap-1 text-indigo-400">
            <Flame className="w-3.5 h-3.5" />
            Spotlight
          </span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          {item.title}
        </h1>

        <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 leading-relaxed max-w-xl">
          {item.synopsis}
        </p>

        {/* Genres */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {item.genres?.slice(0, 4).map((g) => (
            <span
              key={g}
              className="px-2 py-0.5 rounded-md bg-zinc-900/80 border border-zinc-700/60 text-[11px] font-medium text-zinc-300 backdrop-blur-sm"
            >
              {g}
            </span>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => onPlay(item)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Watch Episode 1</span>
          </button>
          <button
            onClick={() => onDetails(item)}
            className="px-4 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs sm:text-sm transition flex items-center gap-1.5 border border-zinc-700/60 active:scale-95 backdrop-blur-sm"
          >
            <Info className="w-4 h-4" />
            <span>Details</span>
          </button>
        </div>
      </div>
    </div>
  );
};
