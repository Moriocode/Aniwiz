import React from 'react';
import { AdZone, AdSlotProps } from '../types/media';

export const AdSlot: React.FC<AdSlotProps> = ({ zone, className = '' }) => {
  if (zone === 'header-top') {
    return (
      <div
        className={`w-full flex items-center justify-center bg-[#0e121a] border-b border-[#1A202C] px-4 py-2 select-none overflow-hidden ${className}`}
        style={{ minHeight: '66px', height: '66px' }}
        data-ad-slot="header-top-leaderboard"
        data-ad-format="leaderboard"
      >
        <div className="w-full max-w-5xl h-full flex items-center justify-between px-4 py-1.5 rounded bg-[#131824] border border-[#1e2536] text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold px-1.5 py-0.5 rounded bg-[#0B0E14] border border-[#1e2536]">
              Ad · 728×90
            </span>
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-semibold text-zinc-200">High-Speed Cloud VPN for Uncapped 4K Anime Streams</span>
              <span className="text-zinc-500 text-[11px]">— Zero Logs & 60-day guarantee</span>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 px-3 py-1 rounded bg-[#1C2333] hover:bg-[#252E42] border border-[#2b354c] text-zinc-300 hover:text-white font-medium text-[11px] transition-colors"
          >
            Learn More
          </button>
        </div>
      </div>
    );
  }

  if (zone === 'sidebar-sticky') {
    return (
      <aside
        className={`sticky top-20 w-full rounded-lg bg-[#0F131C] border border-[#1A202C] p-4 select-none overflow-hidden flex flex-col justify-between ${className}`}
        style={{ minHeight: '260px', height: '260px' }}
        data-ad-slot="sidebar-sticky-box"
        data-ad-format="medium-rectangle-300x250"
      >
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          <span>Sponsored Partner</span>
          <span>300×250</span>
        </div>

        <div className="my-auto space-y-2 py-2">
          <div className="w-8 h-8 rounded bg-red-600/10 border border-red-600/30 flex items-center justify-center text-red-400 font-bold text-xs">
            PRO
          </div>
          <div className="text-sm font-bold text-zinc-100 leading-snug">
            Stream Official Simulcasts with Zero Buffering
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
            Get ultra-low latency direct peering for video & manga updates.
          </p>
        </div>

        <div className="pt-2 border-t border-[#1A202C] flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">AdSlot: sidebar-01</span>
          <button
            type="button"
            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold transition-colors"
          >
            Try Premium
          </button>
        </div>
      </aside>
    );
  }

  // Zone 'below-media'
  return (
    <div
      className={`w-full rounded-lg bg-[#0E121A] border border-[#1A202C] p-3 sm:px-6 select-none overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}
      style={{ minHeight: '90px', height: '90px' }}
      data-ad-slot="below-media-billboard"
      data-ad-format="billboard-970x90"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold px-1.5 py-0.5 rounded bg-[#0B0E14] border border-[#1e2536]">
          Advertisement
        </span>
        <div className="truncate">
          <div className="text-xs sm:text-sm font-semibold text-zinc-200 truncate">
            Collect Official Japanese Manga Volumes & Exclusive Figures
          </div>
          <div className="text-[11px] text-zinc-500 truncate">
            Authentic import merchandise shipped directly from Tokyo with express tracking
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          className="px-4 py-1.5 rounded bg-[#1C2333] hover:bg-[#252E42] border border-[#2b354c] text-zinc-200 hover:text-white font-medium text-xs transition-colors"
        >
          View Collection
        </button>
      </div>
    </div>
  );
};
