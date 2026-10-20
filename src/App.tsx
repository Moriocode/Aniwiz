import React, { useState, useEffect, useMemo } from 'react';
import { MediaItem, MediaType, VideoEpisode, MangaChapter } from './types/media';
import { fetchMangaCatalog, DEFAULT_CATALOG } from './services/rapidApiService';
import { AdSlot } from './components/AdSlot';
import { Header } from './components/Header';
import { MediaCard } from './components/MediaCard';
import { MediaDetail } from './components/MediaDetail';
import { MediaViewer } from './components/MediaViewer';
import { HistoryModal } from './components/HistoryModal';
import { Film, BookOpen, Star, Sparkles, Flame, Play, Clock, TrendingUp } from 'lucide-react';

export default function App() {
  const [catalog, setCatalog] = useState<MediaItem[]>(DEFAULT_CATALOG);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<'catalog' | 'detail' | 'viewer'>('catalog');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<VideoEpisode | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<MangaChapter | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | MediaType>('all');
  const [genreFilter, setGenreFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  // Fetch catalog from RapidAPI Manga Eden / cache on load
  useEffect(() => {
    async function loadCatalog() {
      setLoading(true);
      const data = await fetchMangaCatalog();
      setCatalog(data);
      setLoading(false);
    }
    loadCatalog();
  }, []);

  // Filter catalog by media type, genre, and search query
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      // Type filter
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;

      // Genre filter
      if (genreFilter !== 'All' && !item.genres.includes(genreFilter)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchAlt = item.altTitle ? item.altTitle.toLowerCase().includes(q) : false;
        const matchStudio = item.authorOrStudio.toLowerCase().includes(q);
        const matchGenre = item.genres.some((g) => g.toLowerCase().includes(q));
        if (!matchTitle && !matchAlt && !matchStudio && !matchGenre) return false;
      }

      return true;
    });
  }, [catalog, typeFilter, genreFilter, searchQuery]);

  // Featured spotlight banner item
  const spotlightItem = useMemo(() => {
    return catalog.find((i) => i.id === 'frieren-journey') || catalog[0];
  }, [catalog]);

  // Navigate to Media Detail
  const handleSelectMedia = (item: MediaItem) => {
    setSelectedMedia(item);
    setCurrentView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigate to Video Player
  const handleSelectEpisode = (ep: VideoEpisode) => {
    setSelectedEpisode(ep);
    setCurrentView('viewer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigate to Manga Reader
  const handleSelectChapter = (ch: MangaChapter) => {
    setSelectedChapter(ch);
    setCurrentView('viewer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Return to Catalog View
  const handleReturnToCatalog = () => {
    setCurrentView('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open item directly from History modal
  const handleResumeFromHistory = (item: MediaItem, progressNumber: number) => {
    setSelectedMedia(item);
    if (item.type === 'video' && item.episodes) {
      const ep = item.episodes.find((e) => e.number === progressNumber) || item.episodes[0];
      setSelectedEpisode(ep);
      setCurrentView('viewer');
    } else if (item.type === 'manga' && item.chapters) {
      const ch = item.chapters.find((c) => c.number === progressNumber) || item.chapters[0];
      setSelectedChapter(ch);
      setCurrentView('viewer');
    } else {
      setCurrentView('detail');
    }
  };

  // All unique genres from catalog for filter bar
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((item) => item.genres.forEach((g) => set.add(g)));
    return ['All', ...Array.from(set).slice(0, 7)];
  }, [catalog]);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6] flex flex-col font-sans selection:bg-red-600/30 selection:text-red-200">
      
      {/* ========================================================================= */}
      {/* [AD REVENUE ZONE 1]: Responsive horizontal banner directly above header  */}
      {/* ========================================================================= */}
      <AdSlot zone="header-top" />

      {/* Global Header Navigation */}
      <Header
        activeTypeFilter={typeFilter}
        onFilterChange={(t) => {
          setTypeFilter(t);
          if (currentView !== 'catalog') setCurrentView('catalog');
        }}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (currentView !== 'catalog') setCurrentView('catalog');
        }}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onLogoClick={handleReturnToCatalog}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        
        {/* VIEW 1: HOMEPAGE CATALOG */}
        {currentView === 'catalog' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            
            {/* Spotlight Hero Banner (Featured Release) */}
            {!searchQuery && spotlightItem && (
              <div className="relative rounded-xl overflow-hidden bg-[#0F131C] border border-[#1A202C] shadow-2xl group">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-40 transition-transform duration-700 group-hover:scale-102"
                  style={{ backgroundImage: `url('${spotlightItem.bannerImage}')` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/70 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0B0E14] via-[#0B0E14]/80 to-transparent" />
                </div>

                <div className="relative p-6 sm:p-10 max-w-2xl space-y-3 z-10">
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <span className="text-red-500 font-bold uppercase tracking-wider">Spotlight Release</span>
                    <span>·</span>
                    <span className="text-amber-400 font-bold">★ {spotlightItem.rating.toFixed(1)}</span>
                    <span>·</span>
                    <span>{spotlightItem.year}</span>
                  </div>

                  <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                    {spotlightItem.title}
                  </h1>

                  <p className="text-xs sm:text-sm text-zinc-300 line-clamp-3 leading-relaxed">
                    {spotlightItem.synopsis}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSelectMedia(spotlightItem)}
                      className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-lg shadow-red-600/20 transition-all hover:scale-102"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Watch Episode 1</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectMedia(spotlightItem)}
                      className="px-4 py-2.5 rounded-lg bg-[#151B27] hover:bg-[#1C2433] border border-[#232B3E] text-zinc-300 hover:text-white text-xs font-medium transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Layout Grid: Catalog Content & [AD REVENUE ZONE 2]: Sticky Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              
              {/* Left / Main Column (Catalog Cards) */}
              <div className="lg:col-span-3 space-y-6">
                
                {/* Catalog Controls & Filter Pills */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#1A202C]">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {searchQuery ? `Search Results for "${searchQuery}"` : 'Trending Releases'}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Showing {filteredCatalog.length} titles
                    </p>
                  </div>

                  {/* Genre Filter Tabs */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                    {allGenres.map((genre) => (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => setGenreFilter(genre)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors shrink-0 ${
                          genreFilter === genre
                            ? 'bg-[#151B27] text-white font-semibold border border-[#232B3E]'
                            : 'text-zinc-400 hover:text-white hover:bg-[#121620]'
                        }`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Asymmetric / Tight Card Grid */}
                {loading ? (
                  <div className="py-24 text-center text-zinc-500 text-xs">
                    Loading entertainment catalog...
                  </div>
                ) : filteredCatalog.length === 0 ? (
                  <div className="py-24 text-center text-zinc-500 text-xs space-y-2">
                    <p>No titles found matching your search or filters.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setGenreFilter('All');
                        setTypeFilter('all');
                      }}
                      className="text-red-400 hover:underline"
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5">
                    {filteredCatalog.map((item) => (
                      <MediaCard
                        key={item.id}
                        item={item}
                        onClick={handleSelectMedia}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Right Sidebar: [AD REVENUE ZONE 2] Sticky Box & Quick Ranking */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* [AD REVENUE ZONE 2]: Sticky Vertical Box in Sidebar */}
                <AdSlot zone="sidebar-sticky" />

                {/* Top Ranking Titles List */}
                <div className="bg-[#0F131C] border border-[#1A202C] rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider pb-2 border-b border-[#1A202C]">
                    <Flame className="w-3.5 h-3.5 text-red-500" />
                    <span>Top Rated This Week</span>
                  </div>

                  <div className="space-y-2 divide-y divide-[#1A202C]/60 text-xs">
                    {catalog.slice(0, 5).map((top, idx) => (
                      <div
                        key={top.id}
                        onClick={() => handleSelectMedia(top)}
                        className="pt-2 first:pt-0 flex items-center justify-between gap-2 cursor-pointer hover:text-red-400 group transition-colors"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="font-mono text-xs font-bold text-zinc-500 group-hover:text-red-500 w-4">
                            0{idx + 1}
                          </span>
                          <span className="text-zinc-200 group-hover:text-white font-medium truncate">
                            {top.title}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-amber-400 font-bold shrink-0">
                          ★ {top.rating.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RapidAPI Infrastructure Info */}
                <div className="bg-[#0D1017] border border-[#1A202C] rounded-lg p-3.5 text-[11px] font-mono text-zinc-500 space-y-1">
                  <div className="text-zinc-300 font-semibold text-xs">API Infrastructure</div>
                  <div>Gateway: RapidAPI Manga Eden</div>
                  <div>Key Header: [Configured via Env]</div>
                  <div>Streaming: Direct HTML5 .mp4</div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW 2: MEDIA DETAIL PAGE */}
        {currentView === 'detail' && selectedMedia && (
          <MediaDetail
            item={selectedMedia}
            onSelectEpisode={handleSelectEpisode}
            onSelectChapter={handleSelectChapter}
            onBack={handleReturnToCatalog}
          />
        )}

        {/* VIEW 3: MEDIA CONSUMPTION VIEWER */}
        {currentView === 'viewer' && selectedMedia && (
          <MediaViewer
            item={selectedMedia}
            currentEpisode={selectedEpisode || undefined}
            currentChapter={selectedChapter || undefined}
            onSelectEpisode={(ep) => setSelectedEpisode(ep)}
            onSelectChapter={(ch) => setSelectedChapter(ch)}
            onBackToDetail={() => setCurrentView('detail')}
          />
        )}

      </main>

      {/* Global Footer */}
      <footer className="border-t border-[#1A202C] bg-[#0A0D13] text-zinc-500 text-xs py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-white font-black">Manga<span className="text-red-500">Stream</span></span>
            <span>·</span>
            <span>Native HTML5 Video Streaming & Manga Eden Reader</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-500">
            <span>CLS-Protected Ad Zones</span>
            <span>·</span>
            <span>No External Redirects</span>
            <span>·</span>
            <span>Direct .mp4 Playback</span>
          </div>
        </div>
      </footer>

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        catalog={catalog}
        onOpenItem={handleResumeFromHistory}
      />
    </div>
  );
}
