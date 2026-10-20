import React, { useState } from 'react';
import { generateVanillaSnippet } from '../utils/vanillaCodeSnippet';
import { Code2, Copy, Check, X, FileCode, BookOpen } from 'lucide-react';

interface VanillaCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  animeId: string | number;
  currentEpisode: number;
}

export const VanillaCodeModal: React.FC<VanillaCodeModalProps> = ({
  isOpen,
  onClose,
  animeId,
  currentEpisode,
}) => {
  const [activeTab, setActiveTab] = useState<'snippet' | 'types'>('snippet');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const codeSnippet = generateVanillaSnippet(animeId, currentEpisode);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Vanilla JavaScript Integration Guide</h2>
              <p className="text-xs text-zinc-400">
                Single-file HTML & JS embed using <code className="text-indigo-300 font-mono">player.getEpisodes()</code> and <code className="text-indigo-300 font-mono">loadEpisode</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="px-5 py-2.5 bg-zinc-950/70 border-b border-zinc-800 flex items-center gap-3">
          <button
            onClick={() => setActiveTab('snippet')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'snippet'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>Standalone HTML + Vanilla JS Code</span>
          </button>

          <button
            onClick={() => setActiveTab('types')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'types'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>AniPM TypeScript Reference (.d.ts)</span>
          </button>
        </div>

        {/* Code Content */}
        <div className="p-4 sm:p-5 overflow-y-auto bg-zinc-950 font-mono text-xs text-zinc-300 flex-1">
          {activeTab === 'snippet' ? (
            <pre className="whitespace-pre overflow-x-auto leading-relaxed text-zinc-300">
              {codeSnippet}
            </pre>
          ) : (
            <pre className="whitespace-pre overflow-x-auto leading-relaxed text-zinc-400 text-[11px]">
{`// Type definitions for the ani.pm Player SDK v1 · https://ani.pm/developers
// Usage with a bundler: declare the global, e.g. \`/// <reference path="./anipm-player.d.ts" />\`, and load
// https://ani.pm/embed/sdk/v1.js with a <script> tag (the SDK is also CommonJS-compatible).

export type Language = 'sub' | 'dub'
export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PlayerOptions {
  key?: string
  anime: number | string
  episode?: number
  lang?: Language
  hardsub?: boolean
  start?: number
  autoplay?: boolean
  muted?: boolean
  poster?: boolean
  autoNext?: boolean
  autoSkip?: boolean
  theater?: boolean
  theaterLayout?: boolean
  rememberSettings?: boolean
  reportPage?: boolean
  episodes?: boolean
  color?: string
  subtitles?: string
  title?: string
  width?: string
  height?: string | number
  aspectRatio?: string
  lazy?: boolean
  api?: boolean
  adult?: boolean
  on?: Partial<{ [K in PlayerEventName]: (data: PlayerEventMap[K], player: Player) => void }>
}

export declare class Player {
  constructor(target: string | Element, options: PlayerOptions)
  readonly iframe: HTMLIFrameElement
  readonly state: PlayerState
  on<K extends PlayerEventName>(event: K, listener: (data: PlayerEventMap[K], player: Player) => void): () => void
  ready(): Promise<PlayerState>
  play(): Promise<PlayerState>
  pause(): Promise<PlayerState>
  togglePlay(): Promise<PlayerState>
  seek(seconds: number): Promise<PlayerState>
  loadEpisode(episode: number, options?: { lang?: Language; start?: number }): Promise<PlayerState>
  next(): Promise<PlayerState>
  previous(): Promise<PlayerState>
  getEpisodes(): Promise<Episode[]>
  destroy(): void
}`}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
