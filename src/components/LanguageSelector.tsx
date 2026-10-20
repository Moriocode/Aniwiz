import React from 'react';
import { Language } from '../types/anipm';

interface LanguageSelectorProps {
  currentLanguage: Language | 'vostfr';
  onSelectLanguage: (lang: Language | 'vostfr') => void;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onSelectLanguage,
  className = ''
}) => {
  const options: Array<{ id: Language | 'vostfr'; label: string; desc: string }> = [
    { id: 'sub', label: 'SUB', desc: 'English Subtitles' },
    { id: 'dub', label: 'DUB', desc: 'English Dubbing' },
    { id: 'vostfr', label: 'VOSTFR', desc: 'French Subtitles' }
  ];

  return (
    <div className={`inline-flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 ${className}`}>
      {options.map((opt) => {
        const isActive = currentLanguage === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onSelectLanguage(opt.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all active:scale-95 ${
              isActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            title={opt.desc}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
