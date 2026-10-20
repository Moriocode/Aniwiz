import React from 'react';
import { Quality } from '../types/anipm';

interface QualitySelectorProps {
  currentQuality: number | string | null;
  qualities?: Quality[];
  onSelectQuality: (height: number) => void;
  className?: string;
}

export const QualitySelector: React.FC<QualitySelectorProps> = ({
  currentQuality,
  qualities = [
    { height: 1080, bitrate: null },
    { height: 720, bitrate: null },
    { height: 480, bitrate: null }
  ],
  onSelectQuality,
  className = ''
}) => {
  return (
    <div className={`inline-flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 ${className}`}>
      {qualities.map((q) => {
        const isActive = Number(currentQuality) === q.height;
        return (
          <button
            key={q.height}
            onClick={() => onSelectQuality(q.height)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all active:scale-95 ${
              isActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            title={`${q.height}p Resolution`}
          >
            {q.height}
          </button>
        );
      })}
    </div>
  );
};
