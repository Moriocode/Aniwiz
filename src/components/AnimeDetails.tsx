import React from 'react';
import { AnimePreset } from '../data/animePresets';
import { Sparkles, Tv, Calendar, Tag, ExternalLink } from 'lucide-react';

interface AnimeDetailsProps {
  anime: AnimePreset;
  currentEpisode: number;
}

export const AnimeDetails: React.FC<AnimeDetailsProps> = ({ anime, currentEpisode }) => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-col md:flex-row gap-5 items-start">
      {/* Cover poster */}
      <div className="w-24 sm:w-28 aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 shadow-md">
        <img
          src={anime.coverImage}
          alt={anime.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1 text-xs">
          <span className="font-mono text-indigo-400 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
            AniList #{anime.id}
          </span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400">{anime.format}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400">{anime.season} {anime.year}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-emerald-400 font-mono font-medium">Episode {currentEpisode} of {anime.totalEpisodes}</span>
        </div>

        <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">{anime.title}</h1>
        {anime.romaji && (
          <p className="text-xs text-zinc-400 italic mb-2">{anime.romaji}</p>
        )}

        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed line-clamp-3 mb-3">
          {anime.description}
        </p>

        {/* Genres */}
        <div className="flex flex-wrap items-center gap-1.5">
          {anime.genres.map((genre) => (
            <span
              key={genre}
              className="text-[11px] font-medium text-zinc-400 bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 rounded-md"
            >
              {genre}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
