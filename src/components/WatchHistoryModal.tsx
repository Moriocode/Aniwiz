import React from 'react';
import { WatchProgressRecord } from '../types/anipm';
import { formatTime } from '../services/watchProgressService';
import { History, Play, Trash2, X, CheckCircle2, Clock } from 'lucide-react';

interface WatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: WatchProgressRecord[];
  onResume: (record: WatchProgressRecord) => void;
  onClearAll: () => void;
  onClearItem: (animeId: string | number, episode: number) => void;
}

export const WatchHistoryModal: React.FC<WatchHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onResume,
  onClearAll,
  onClearItem,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Watch Progress & History</h2>
              <p className="text-xs text-zinc-400">Stored in browser localStorage</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-zinc-400 hover:text-red-400 px-2.5 py-1 rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 divide-y divide-zinc-800/50">
          {history.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 space-y-2">
              <Clock className="w-8 h-8 mx-auto opacity-40 text-zinc-400" />
              <p className="text-xs">No watch history recorded yet.</p>
              <p className="text-[11px] text-zinc-600">Start playing any episode to begin tracking watch progress automatically.</p>
            </div>
          ) : (
            history.map((record) => {
              const formattedDate = new Date(record.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={`${record.animeId}_${record.episode}`}
                  className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white truncate">
                        {record.animeTitle || `Anime #${record.animeId}`}
                      </span>
                      <span className="text-[11px] font-mono font-medium text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        EP {record.episode}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono mt-1">
                      <span>{formatTime(record.currentTime)} / {formatTime(record.duration)}</span>
                      <span>·</span>
                      <span className={record.completed ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}>
                        {record.completed ? 'Completed' : `${Math.round(record.percentage)}%`}
                      </span>
                      <span>·</span>
                      <span className="text-zinc-500">{formattedDate}</span>
                    </div>

                    {/* Progress line */}
                    <div className="w-full max-w-xs h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full ${record.completed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${record.percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => onResume(record)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Resume</span>
                    </button>
                    <button
                      onClick={() => onClearItem(record.animeId, record.episode)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
