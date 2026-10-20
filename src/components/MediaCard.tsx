import React from 'react';
import { Play, BookOpen, Star } from 'lucide-react';
import { MediaItem } from '../types/media';

interface MediaCardProps {
  item: MediaItem;
  onClick: (item: MediaItem) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, onClick }) => {
  const isVideo = item.type === 'video';
  const episodesCount = item.episodes ? item.episodes.length : 0;
  const chaptersCount = item.chapters ? item.chapters.length : 0;

  return (
    <div
      onClick={() => onClick(item)}
      className="group relative bg-[#10141D] border border-[#1A202C] hover:border-[#2E374A] rounded-lg overflow-hidden cursor-pointer transition-all duration-200 flex flex-col text-left hover:-translate-y-0.5 shadow-sm"
    >
      {/* Poster image container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0A0D13]">
        <img
          src={item.coverImage}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {/* Subtle shadow overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-transparent to-transparent opacity-70 group-hover:opacity-40 transition-opacity" />

        {/* Media type badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-black/80 text-white backdrop-blur border border-white/10">
            {isVideo ? 'VIDEO' : 'MANGA'}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#161C28] text-zinc-300 border border-[#232B3E]">
            {isVideo ? `${episodesCount} eps` : `${chaptersCount} ch`}
          </span>
        </div>

        {/* Score indicator */}
        <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur font-mono text-[10px] text-amber-400 font-bold border border-white/10">
          <Star className="w-2.5 h-2.5 fill-current" />
          <span>{item.rating.toFixed(1)}</span>
        </div>

        {/* Hover action icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
          <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
            {isVideo ? <Play className="w-4 h-4 fill-current ml-0.5" /> : <BookOpen className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Media Details */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-red-400 line-clamp-1 transition-colors">
            {item.title}
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5 font-mono line-clamp-1">
            {item.authorOrStudio} · {item.year}
          </p>
        </div>

        {/* Clean unboxed metadata with separators (no pill enclosures) */}
        <div className="mt-2.5 pt-2 border-t border-[#1A202C] flex items-center justify-between text-[11px] text-zinc-500">
          <span className="truncate max-w-[120px]">
            {item.genres.slice(0, 2).join(' · ')}
          </span>
          <span className="font-mono text-[10px] text-zinc-400">
            {item.status}
          </span>
        </div>
      </div>
    </div>
  );
};
