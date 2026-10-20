import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, ArrowUp } from 'lucide-react';
import { MangaChapter } from '../types/media';

interface MangaReaderProps {
  mediaId: string;
  chapter: MangaChapter;
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
  hasNextChapter?: boolean;
  hasPrevChapter?: boolean;
}

export const MangaReader: React.FC<MangaReaderProps> = ({
  mediaId,
  chapter,
  onNextChapter,
  onPrevChapter,
  hasNextChapter = false,
  hasPrevChapter = false,
}) => {
  const [fitWidth, setFitWidth] = useState<'normal' | 'wide' | 'full'>('normal');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const pages = chapter.pages && chapter.pages.length > 0
    ? chapter.pages
    : [
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=80',
      ];

  // Scroll to top on chapter change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentPage(1);
  }, [chapter.id]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getWidthClass = () => {
    if (fitWidth === 'normal') return 'max-w-3xl';
    if (fitWidth === 'wide') return 'max-w-5xl';
    return 'max-w-full';
  };

  return (
    <div className="w-full flex flex-col items-center select-none" ref={containerRef}>
      {/* Minimalist Reader Action Bar */}
      <div className="sticky top-16 z-30 w-full bg-[#0B0E14]/90 backdrop-blur-md border-b border-[#1A202C] py-2 px-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-red-600 text-white">
            CH {chapter.number}
          </span>
          <span className="text-zinc-200 font-semibold truncate max-w-xs sm:max-w-md">
            {chapter.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Width Mode Toggle */}
          <div className="hidden sm:flex items-center bg-[#131824] rounded border border-[#1e2536] p-0.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setFitWidth('normal')}
              className={`px-2 py-0.5 rounded transition-colors ${
                fitWidth === 'normal' ? 'bg-[#1E2536] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setFitWidth('wide')}
              className={`px-2 py-0.5 rounded transition-colors ${
                fitWidth === 'wide' ? 'bg-[#1E2536] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Wide
            </button>
            <button
              type="button"
              onClick={() => setFitWidth('full')}
              className={`px-2 py-0.5 rounded transition-colors ${
                fitWidth === 'full' ? 'bg-[#1E2536] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Fit Full
            </button>
          </div>

          {/* Prev/Next chapter buttons */}
          <button
            type="button"
            disabled={!hasPrevChapter}
            onClick={onPrevChapter}
            className="p-1.5 rounded bg-[#131824] hover:bg-[#1E2536] disabled:opacity-30 disabled:cursor-not-allowed border border-[#1e2536] text-zinc-300 transition-colors"
            title="Previous Chapter"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!hasNextChapter}
            onClick={onNextChapter}
            className="p-1.5 rounded bg-[#131824] hover:bg-[#1E2536] disabled:opacity-30 disabled:cursor-not-allowed border border-[#1e2536] text-zinc-300 transition-colors"
            title="Next Chapter"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Continuous Vertical Manga Pages Canvas */}
      <div className={`w-full ${getWidthClass()} my-6 space-y-2 flex flex-col items-center transition-all duration-200`}>
        {pages.map((pageUrl, idx) => (
          <div
            key={idx}
            className="relative w-full bg-[#11151E] rounded overflow-hidden shadow-2xl border border-[#1A202C]/60"
          >
            <img
              src={pageUrl}
              alt={`Chapter ${chapter.number} Page ${idx + 1}`}
              className="w-full h-auto object-cover"
              loading="lazy"
            />
            {/* Page number badge indicator */}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur font-mono text-[10px] text-zinc-400 pointer-events-none">
              {idx + 1} / {pages.length}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Chapter Navigation Bar */}
      <div className="w-full max-w-xl my-8 p-4 bg-[#11151E] border border-[#1A202C] rounded-lg flex items-center justify-between text-xs">
        <button
          type="button"
          disabled={!hasPrevChapter}
          onClick={onPrevChapter}
          className="px-4 py-2 rounded bg-[#1C2333] hover:bg-[#252E42] disabled:opacity-30 disabled:cursor-not-allowed border border-[#2b354c] text-zinc-200 transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Chapter</span>
        </button>

        <button
          type="button"
          onClick={scrollToTop}
          className="p-2 rounded bg-[#131824] hover:bg-[#1E2536] text-zinc-400 hover:text-white transition-colors"
          title="Back to Top"
        >
          <ArrowUp className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={!hasNextChapter}
          onClick={onNextChapter}
          className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center gap-1 shadow"
        >
          <span>Next Chapter</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
