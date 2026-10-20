import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, List, ArrowLeft } from 'lucide-react';
import { MediaItem, VideoEpisode, MangaChapter } from '../types/media';
import { NativeVideoPlayer } from './NativeVideoPlayer';
import { MangaReader } from './MangaReader';
import { AdSlot } from './AdSlot';

interface MediaViewerProps {
  item: MediaItem;
  currentEpisode?: VideoEpisode;
  currentChapter?: MangaChapter;
  onSelectEpisode: (ep: VideoEpisode) => void;
  onSelectChapter: (ch: MangaChapter) => void;
  onBackToDetail: () => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  item,
  currentEpisode,
  currentChapter,
  onSelectEpisode,
  onSelectChapter,
  onBackToDetail,
}) => {
  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [showDrawer, setShowDrawer] = useState<boolean>(false);

  const isVideo = item.type === 'video';

  // Navigation helpers
  const episodes = item.episodes || [];
  const chapters = item.chapters || [];

  const currentEpIndex = currentEpisode ? episodes.findIndex((e) => e.id === currentEpisode.id) : 0;
  const currentChIndex = currentChapter ? chapters.findIndex((c) => c.id === currentChapter.id) : 0;

  const hasNextEp = currentEpIndex < episodes.length - 1;
  const hasPrevEp = currentEpIndex > 0;

  const hasNextCh = currentChIndex < chapters.length - 1;
  const hasPrevCh = currentChIndex > 0;

  const handleNextEp = () => {
    if (hasNextEp) onSelectEpisode(episodes[currentEpIndex + 1]);
  };

  const handlePrevEp = () => {
    if (hasPrevEp) onSelectEpisode(episodes[currentEpIndex - 1]);
  };

  const handleNextCh = () => {
    if (hasNextCh) onSelectChapter(chapters[currentChIndex + 1]);
  };

  const handlePrevCh = () => {
    if (hasPrevCh) onSelectChapter(chapters[currentChIndex - 1]);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Breadcrumb Navigation & Content Switcher */}
      <div className="flex items-center justify-between text-xs py-1 border-b border-[#1A202C]">
        <div className="flex items-center gap-2 truncate">
          <button
            type="button"
            onClick={onBackToDetail}
            className="text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-300 font-semibold truncate max-w-xs sm:max-w-md">
            {item.title}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-red-400 font-mono font-bold">
            {isVideo
              ? `EP ${currentEpisode?.number || 1}`
              : `CH ${currentChapter?.number || 1}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick list drawer toggle */}
          <button
            type="button"
            onClick={() => setShowDrawer(!showDrawer)}
            className="px-2.5 py-1 rounded bg-[#131824] hover:bg-[#1E2536] border border-[#232B3E] text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors font-mono"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isVideo ? 'Episodes' : 'Chapters'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Consumption Canvas */}
      <div className={`transition-all duration-300 ${theaterMode ? 'w-full' : 'max-w-6xl mx-auto'}`}>
        {isVideo && currentEpisode && (
          <NativeVideoPlayer
            mediaId={item.id}
            episode={currentEpisode}
            theaterMode={theaterMode}
            onToggleTheater={() => setTheaterMode(!theaterMode)}
            onNextEpisode={handleNextEp}
            hasNextEpisode={hasNextEp}
            onEpisodeEnded={() => {
              if (hasNextEp) handleNextEp();
            }}
          />
        )}

        {!isVideo && currentChapter && (
          <MangaReader
            mediaId={item.id}
            chapter={currentChapter}
            onNextChapter={handleNextCh}
            onPrevChapter={handlePrevCh}
            hasNextChapter={hasNextCh}
            hasPrevChapter={hasPrevCh}
          />
        )}
      </div>

      {/* [AD REVENUE ZONE 3]: Full-width container positioned directly underneath the main media view area */}
      <div className={`${theaterMode ? 'w-full' : 'max-w-6xl mx-auto'}`}>
        <AdSlot zone="below-media" />
      </div>

      {/* Quick Jump Drawer Modal / Flyout */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-80 sm:w-96 bg-[#0E121A] border-l border-[#1A202C] h-full flex flex-col p-4 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#1A202C]">
              <h3 className="font-bold text-sm text-white">
                {isVideo ? 'Select Episode' : 'Select Chapter'}
              </h3>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-3 space-y-1 divide-y divide-[#1A202C]/40">
              {isVideo
                ? episodes.map((ep) => {
                    const isSelected = currentEpisode?.id === ep.id;
                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => {
                          onSelectEpisode(ep);
                          setShowDrawer(false);
                        }}
                        className={`w-full p-2.5 rounded text-left flex items-center justify-between text-xs transition-colors ${
                          isSelected
                            ? 'bg-red-600/15 border border-red-500/40 text-white font-semibold'
                            : 'hover:bg-[#161C28] text-zinc-300'
                        }`}
                      >
                        <div className="truncate">
                          <span className="font-mono text-red-400 font-bold mr-2">EP {ep.number}</span>
                          <span>{ep.title}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-2">
                          {Math.round(ep.durationSeconds / 60)}m
                        </span>
                      </button>
                    );
                  })
                : chapters.map((ch) => {
                    const isSelected = currentChapter?.id === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => {
                          onSelectChapter(ch);
                          setShowDrawer(false);
                        }}
                        className={`w-full p-2.5 rounded text-left flex items-center justify-between text-xs transition-colors ${
                          isSelected
                            ? 'bg-red-600/15 border border-red-500/40 text-white font-semibold'
                            : 'hover:bg-[#161C28] text-zinc-300'
                        }`}
                      >
                        <div className="truncate">
                          <span className="font-mono text-red-400 font-bold mr-2">CH {ch.number}</span>
                          <span>{ch.title}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-2">
                          {ch.pageCount}p
                        </span>
                      </button>
                    );
                  })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
