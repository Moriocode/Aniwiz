import React, { useState } from 'react';
import { Terminal, Trash2, X, ChevronRight, ChevronDown, Pause, Play } from 'lucide-react';

export interface LoggedEvent {
  id: string;
  name: string;
  timestamp: number;
  data: any;
}

interface EventInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: LoggedEvent[];
  onClear: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
}

export const EventInspectorModal: React.FC<EventInspectorModalProps> = ({
  isOpen,
  onClose,
  events,
  onClear,
  isPaused,
  onTogglePause,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterEvent, setFilterEvent] = useState<string>('all');

  if (!isOpen) return null;

  const eventTypes = Array.from(new Set(events.map((e) => e.name)));

  const filteredEvents = events.filter((e) => {
    if (filterEvent === 'all') return true;
    return e.name === filterEvent;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">AniPM SDK Event Stream</h2>
                <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                  {events.length} events
                </span>
              </div>
              <p className="text-xs text-zinc-400">Live callback events captured from player.on(event)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePause}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 ${
                isPaused
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              <span>{isPaused ? 'Resume Stream' : 'Pause'}</span>
            </button>

            <button
              onClick={onClear}
              className="text-xs text-zinc-400 hover:text-red-400 px-2.5 py-1 rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-4 py-2.5 bg-zinc-950/60 border-b border-zinc-800/80 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-zinc-500 text-[11px] uppercase tracking-wider shrink-0 font-medium">Filter:</span>
          <button
            onClick={() => setFilterEvent('all')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-colors shrink-0 ${
              filterEvent === 'all' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
            }`}
          >
            All ({events.length})
          </button>
          {eventTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterEvent(type)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-colors shrink-0 ${
                filterEvent === type ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Events List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1 font-mono text-xs">
          {filteredEvents.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 font-sans text-xs">
              No events recorded yet. Play, seek, switch episodes, or alter settings in the player.
            </div>
          ) : (
            filteredEvents.map((e) => {
              const isExpanded = expandedId === e.id;
              const timeStr = new Date(e.timestamp).toLocaleTimeString(undefined, {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3,
              });

              return (
                <div
                  key={e.id}
                  className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-2.5 hover:border-zinc-700 transition-colors"
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : e.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                      )}
                      <span className={`font-semibold ${
                        e.name === 'timeupdate'
                          ? 'text-sky-400'
                          : e.name === 'episodechange' || e.name === 'episodes'
                          ? 'text-amber-400'
                          : e.name === 'ready' || e.name === 'loaded'
                          ? 'text-emerald-400'
                          : 'text-indigo-400'
                      }`}>
                        {e.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-zinc-500 text-[11px]">
                      <span>{timeStr}</span>
                    </div>
                  </div>

                  {/* Summary row */}
                  {e.name === 'timeupdate' && (
                    <div className="mt-1 text-[11px] text-zinc-400 pl-5.5">
                      currentTime: {Math.round(e.data?.currentTime * 10) / 10}s / {Math.round(e.data?.duration)}s
                    </div>
                  )}

                  {e.name === 'episodechange' && (
                    <div className="mt-1 text-[11px] text-zinc-400 pl-5.5">
                      Switched to Episode {e.data?.episode} (Lang: {e.data?.lang})
                    </div>
                  )}

                  {/* Expanded JSON payload */}
                  {isExpanded && (
                    <pre className="mt-2.5 p-2.5 bg-black/60 rounded-md border border-zinc-800 text-[11px] text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(e.data, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
