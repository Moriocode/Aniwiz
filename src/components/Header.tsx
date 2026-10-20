import React, { useState } from 'react';
import { Film, BookOpen, Search, X, History, Sparkles } from 'lucide-react';
import { MediaType } from '../types/media';

interface HeaderProps {
  activeTypeFilter: 'all' | MediaType;
  onFilterChange: (type: 'all' | MediaType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenHistory: () => void;
  onLogoClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTypeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onOpenHistory,
  onLogoClick,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0B0E14]/90 backdrop-blur-md border-b border-[#1A202C] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Type filters */}
        <div className="flex items-center gap-6">
          <div
            onClick={onLogoClick}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-red-600/30 group-hover:scale-105 transition-transform">
              <Film className="w-4 h-4 fill-current" />
            </div>
            <div className="flex items-center">
              <span className="text-base sm:text-lg font-black tracking-tight text-white">
                Ani<span className="text-red-500">Stream</span>
              </span>
              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-[#141A26] border border-[#232B3E] text-zinc-400 font-semibold">
                HD
              </span>
            </div>
          </div>

          {/* Navigation Category Filter Tabs (unboxed, clean) */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-zinc-400">
            <button
              type="button"
              onClick={() => onFilterChange('all')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeTypeFilter === 'all'
                  ? 'bg-[#151B27] text-white font-semibold border border-[#232B3E]'
                  : 'hover:text-white hover:bg-[#121620]'
              }`}
            >
              All Releases
            </button>
            <button
              type="button"
              onClick={() => onFilterChange('video')}
              className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                activeTypeFilter === 'video'
                  ? 'bg-[#151B27] text-white font-semibold border border-[#232B3E]'
                  : 'hover:text-white hover:bg-[#121620]'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Native Video</span>
            </button>
            <button
              type="button"
              onClick={() => onFilterChange('manga')}
              className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                activeTypeFilter === 'manga'
                  ? 'bg-[#151B27] text-white font-semibold border border-[#232B3E]'
                  : 'hover:text-white hover:bg-[#121620]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Manga Reading</span>
            </button>
          </nav>
        </div>

        {/* Search input & User actions */}
        <div className="flex items-center gap-3">
          <div className="relative w-40 sm:w-64 lg:w-72">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search title, studio..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[#10141D] border border-[#1E2536] rounded-md pl-8 pr-8 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenHistory}
            className="p-2 rounded bg-[#10141D] hover:bg-[#161C28] border border-[#1E2536] text-zinc-400 hover:text-white transition-colors"
            title="Watch & Read History"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
