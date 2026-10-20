import React, { useState } from 'react';
import {
  Play,
  BookOpen,
  ArrowUpDown,
  Search,
  Calendar,
  Clock,
  Check,
  Star,
  Eye,
  Bookmark,
  Share2,
} from 'lucide-react';
import { MediaItem, VideoEpisode, MangaChapter } from '../types/media';

interface MediaDetailProps {
  item: MediaItem;
  onSelectEpisode: (episode: VideoEpisode) => void;
  onSelectChapter: (chapter: MangaChapter) => void;
  onBack: () => void;
}

export const MediaDetail: React.FC<MediaDetailProps> = ({
  item,
  onSelectEpisode,
  onSelectChapter,
  onBack,
}) => {
  const [isReverseOrder, setIsReverseOrder] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  const isVideo = item.type === 'video';

  // Episodes or Chapters sorting
  const rawContent = isVideo ? (item.episodes || []) : (item.chapters || []);

  const filteredContent = rawContent.filter((c: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchNumber = String(c.number).includes(q);
    const matchTitle = c.title ? c.title.toLowerCase().includes(q) : false;
    return matchNumber || matchTitle;
  });

  const sortedContent = [...filteredContent].sort((a: any, b: any) => {
    return isReverseOrder ? b.number - a.number : a.number - b.number;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Back button */}
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onBack}
          className="text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <span>← Back to Catalog</span>
        </button>
      </div>

      {/* Hero Overview Header */}
      <div className="relative rounded-xl overflow-hidden bg-[#0F131C] border border-[#1A202C] p-6 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-start shadow-xl">
        {/* Cover image */}
        <div className="w-36 sm:w-48 aspect-[3/4] rounded-lg overflow-hidden bg-[#0A0D13] shrink-0 border border-[#232B3E] shadow-lg">
          <img
            src={item.coverImage}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Metadata tag header (unboxed clean text) */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono">
            <span className="text-red-400 font-semibold uppercase">{item.type}</span>
            <span>·</span>
            <span>{item.authorOrStudio}</span>
            <span>·</span>
            <span>{item.year}</span>
            <span>·</span>
            <span>{item.status}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            {item.title}
          </h1>

          {item.altTitle && (
            <p className="text-xs text-zinc-400 italic">{item.altTitle}</p>
          )}

          {/* Rating & Views */}
          <div className="flex items-center gap-4 text-xs font-mono pt-1">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span className="font-bold">{item.rating.toFixed(1)}</span>
              <span className="text-zinc-500">/ 10</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Eye className="w-3.5 h-3.5" />
              <span>{item.views.toLocaleString()} views</span>
            </div>
          </div>

          {/* Synopsis */}
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-3xl pt-1">
            {item.synopsis}
          </p>

          {/* Genres unboxed list */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            {item.genres.map((g) => (
              <span
                key={g}
                className="text-[11px] font-medium text-zinc-300 bg-[#151A25] border border-[#212838] px-2.5 py-0.5 rounded"
              >
                {g}
              </span>
            ))}
          </div>

          {/* Action Callouts */}
          <div className="flex flex-wrap items-center gap-3 pt-4">
            {isVideo && item.episodes && item.episodes.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectEpisode(item.episodes![0])}
                className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-red-600/20 transition-all hover:scale-102"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Episode 1</span>
              </button>
            )}

            {!isVideo && item.chapters && item.chapters.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectChapter(item.chapters![0])}
                className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-red-600/20 transition-all hover:scale-102"
              >
                <BookOpen className="w-4 h-4" />
                <span>Read Chapter 1</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsBookmarked(!isBookmarked)}
              className={`px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors ${
                isBookmarked
                  ? 'bg-zinc-800 text-red-400 border-red-500/40'
                  : 'bg-[#131824] hover:bg-[#1E2536] text-zinc-300 border-[#232B3E]'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              <span>{isBookmarked ? 'Saved' : 'Bookmark'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reverse-Chronological Content Menu (Episodes / Chapters) */}
      <div className="bg-[#0F131C] border border-[#1A202C] rounded-xl p-5 sm:p-6 space-y-4">
        {/* Menu header & tools */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1A202C]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                {isVideo ? 'Episodes' : 'Chapters'}
              </h2>
              <span className="text-xs font-mono text-zinc-400 bg-[#161C28] px-2 py-0.5 rounded border border-[#232B3E]">
                {rawContent.length} Total
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Listed in {isReverseOrder ? 'reverse-chronological order (newest first)' : 'chronological order'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={isVideo ? 'Filter ep #...' : 'Filter ch #...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#0A0D13] border border-[#1E2536] rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-red-500 w-36 sm:w-48"
              />
            </div>

            {/* Reverse / Chronological Toggle */}
            <button
              type="button"
              onClick={() => setIsReverseOrder(!isReverseOrder)}
              className="px-3 py-1.5 rounded-md bg-[#161C28] hover:bg-[#1E2536] border border-[#232B3E] text-zinc-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
              title="Toggle Sort Order"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isReverseOrder ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>
        </div>

        {/* Content Items List */}
        <div className="divide-y divide-[#1A202C]/60 max-h-[500px] overflow-y-auto pr-1">
          {sortedContent.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No items matching "{searchQuery}".
            </div>
          ) : (
            sortedContent.map((c: any) => (
              <div
                key={c.id}
                onClick={() => {
                  if (isVideo) onSelectEpisode(c as VideoEpisode);
                  else onSelectChapter(c as MangaChapter);
                }}
                className="py-3 px-2 rounded-lg hover:bg-[#141A26] flex items-center justify-between gap-4 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded bg-[#161C28] border border-[#232B3E] flex items-center justify-center font-mono text-xs font-bold text-zinc-300 group-hover:text-red-400 shrink-0">
                    {c.number}
                  </span>
                  <div className="truncate">
                    <div className="text-xs sm:text-sm font-semibold text-zinc-200 group-hover:text-white truncate">
                      {c.title || (isVideo ? `Episode ${c.number}` : `Chapter ${c.number}`)}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{c.releasedAt}</span>
                      </span>
                      <span>·</span>
                      {isVideo ? (
                        <span>{Math.round(c.durationSeconds / 60)} min</span>
                      ) : (
                        <span>{c.pageCount} pages</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-8 h-8 rounded bg-[#161C28] text-zinc-400 group-hover:bg-red-600 group-hover:text-white flex items-center justify-center transition-colors">
                    {isVideo ? <Play className="w-3.5 h-3.5 fill-current ml-0.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
