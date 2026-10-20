import React, { useState } from 'react';
import { Episode } from '../types/anipm';
import { formatTime, getWatchProgress } from '../services/watchProgressService';
import { Play, Check, Clock, Calendar, RefreshCw, LayoutGrid, List, Sparkles } from 'lucide-react';

interface EpisodeListProps {
  animeId: string | number;
  currentEpisode: number;
  episodes: Episode[];
  isLoading: boolean;
  onRefreshEpisodes: () => void;
  onSelectEpisode: (episodeNumber: number) => void;
}

export const EpisodeList: React.FC<EpisodeListProps> = ({
  animeId,
  currentEpisode,
  episodes,
  isLoading,
  onRefreshEpisodes,
  onSelectEpisode,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter episodes based on query
  const filteredEpisodes = episodes.filter((ep) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesNumber = String(ep.number).includes(q) || `ep ${ep.number}`.includes(q) || `episode ${ep.number}`.includes(q);
    const matchesTitle = ep.title ? ep.title.toLowerCase().includes(q) : false;
    return matchesNumber || matchesTitle;
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white tracking-tight">Episodes</h2>
            <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
              {episodes.length} available
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            High-definition streams available · Select any episode to stream
          </p>
        </div>

        {/* Controls: Search, View switch, Refresh */}
        <div className="flex items-center gap-2">
          {/* Search input */}
          <input
            type="text"
            placeholder="Search ep # or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-48"
          />

          {/* View toggle */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Refresh via player.getEpisodes() */}
          <button
            onClick={onRefreshEpisodes}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 hover:text-white rounded-lg text-xs transition-colors"
            title="Fetch fresh episode list via player.getEpisodes()"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Episodes container */}
      <div className="mt-5">
        {isLoading ? (
          <div className="py-16 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs">Calling player.getEpisodes()...</span>
          </div>
        ) : filteredEpisodes.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">
            No episodes matching "{searchQuery}".
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View Mode */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredEpisodes.map((ep) => {
              const isCurrent = ep.number === currentEpisode;
              const progress = getWatchProgress(animeId, ep.number);
              const progressPercent = progress ? progress.percentage : 0;
              const isCompleted = progress ? progress.completed : false;

              return (
                <div
                  key={ep.number}
                  onClick={() => onSelectEpisode(ep.number)}
                  className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 text-left flex flex-col ${
                    isCurrent
                      ? 'bg-indigo-950/30 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                      : 'bg-zinc-950/60 hover:bg-zinc-900 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  {/* Thumbnail container */}
                  <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
                    {ep.thumbnail ? (
                      <img
                        src={ep.thumbnail}
                        alt={ep.title || `Episode ${ep.number}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-700">
                        <Play className="w-8 h-8 opacity-40" />
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Episode Number badge */}
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[11px] font-semibold font-mono text-zinc-200 border border-white/10">
                        EP {ep.number}
                      </span>
                    </div>

                    {/* Completion or Runtime badge */}
                    <div className="absolute top-2 right-2">
                      {isCompleted ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/90 text-white text-[10px] font-medium shadow">
                          <Check className="w-3 h-3 stroke-[2.5]" />
                          <span>Watched</span>
                        </span>
                      ) : ep.runtimeSeconds ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-mono text-zinc-300">
                          {formatTime(ep.runtimeSeconds)}
                        </span>
                      ) : null}
                    </div>

                    {/* Play hover button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>

                    {/* Watch progress bar at bottom of thumbnail */}
                    {progressPercent > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
                        <div
                          className={`h-full ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Episode details */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className={`text-xs font-semibold line-clamp-1 ${
                          isCurrent ? 'text-indigo-300' : 'text-zinc-200 group-hover:text-white'
                        }`}>
                          {ep.title || `Episode ${ep.number}`}
                        </h3>
                      </div>

                      {ep.aired && (
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
                          <Calendar className="w-3 h-3" />
                          <span>{ep.aired}</span>
                        </div>
                      )}
                    </div>

                    {/* Progress percentage footer */}
                    <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                        <span className="text-[10px] uppercase font-mono tracking-wider">
                          {ep.available?.dub ? 'Sub / Dub' : 'Sub'}
                        </span>
                      </span>

                      {progress && progressPercent > 0 && !isCompleted && (
                        <span className="text-[10px] font-mono text-indigo-400">
                          {Math.round(progressPercent)}% watched
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View Mode */
          <div className="space-y-2">
            {filteredEpisodes.map((ep) => {
              const isCurrent = ep.number === currentEpisode;
              const progress = getWatchProgress(animeId, ep.number);
              const progressPercent = progress ? progress.percentage : 0;
              const isCompleted = progress ? progress.completed : false;

              return (
                <div
                  key={ep.number}
                  onClick={() => onSelectEpisode(ep.number)}
                  className={`group p-3 rounded-xl border flex items-center justify-between gap-4 cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-indigo-950/30 border-indigo-500/80'
                      : 'bg-zinc-950/60 hover:bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail preview */}
                    <div className="relative w-20 h-12 rounded-lg bg-zinc-900 overflow-hidden shrink-0">
                      {ep.thumbnail ? (
                        <img
                          src={ep.thumbnail}
                          alt={ep.title || `Episode ${ep.number}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700">
                          <Play className="w-4 h-4" />
                        </div>
                      )}
                      {progressPercent > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
                          <div
                            className={`h-full ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-300">EP {ep.number}</span>
                        <span className="text-zinc-600">·</span>
                        <h3 className={`text-xs font-semibold truncate ${
                          isCurrent ? 'text-indigo-400' : 'text-zinc-200 group-hover:text-white'
                        }`}>
                          {ep.title || `Episode ${ep.number}`}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono mt-0.5">
                        {ep.runtimeSeconds && <span>{formatTime(ep.runtimeSeconds)}</span>}
                        {ep.aired && <span>{ep.aired}</span>}
                        <span>{ep.available?.dub ? 'Sub / Dub' : 'Sub'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Status */}
                  <div className="flex items-center gap-3 shrink-0">
                    {isCompleted ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                        <Check className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    ) : progressPercent > 0 ? (
                      <span className="text-[11px] font-mono text-indigo-400">
                        {Math.round(progressPercent)}%
                      </span>
                    ) : null}

                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isCurrent
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 group-hover:bg-indigo-600 group-hover:text-white'
                    }`}>
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
