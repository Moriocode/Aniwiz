import React from 'react';
import { History, Play, Trash2, X, Clock, BookOpen } from 'lucide-react';
import { UserProgress, MediaItem } from '../types/media';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: MediaItem[];
  onOpenItem: (item: MediaItem, progressNumber: number) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onOpenItem,
}) => {
  if (!isOpen) return null;

  // Retrieve saved progress from localStorage
  const savedRecords: UserProgress[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('app_progress_')) {
        const raw = localStorage.getItem(key);
        if (raw) savedRecords.push(JSON.parse(raw));
      }
    }
  } catch (err) {}

  savedRecords.sort((a, b) => b.updatedAt - a.updatedAt);

  const clearAllHistory = () => {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('app_progress_')) keys.push(key);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      onClose();
    } catch (e) {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F131C] border border-[#1A202C] rounded-xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-4 border-b border-[#1A202C] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-white">Watch & Read History</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-2.5 divide-y divide-[#1A202C]/50 text-xs flex-1">
          {savedRecords.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 space-y-2">
              <Clock className="w-8 h-8 mx-auto opacity-30 text-zinc-400" />
              <p>No watch or reading history recorded yet.</p>
              <p className="text-[11px] text-zinc-600">Start watching an episode or reading a chapter to automatically save progress.</p>
            </div>
          ) : (
            savedRecords.map((rec) => {
              const matchedItem = catalog.find((c) => c.id === rec.mediaId);
              const title = matchedItem ? matchedItem.title : rec.mediaId;
              const dateStr = new Date(rec.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={`${rec.mediaId}_${rec.itemNumber}`}
                  className="pt-2.5 first:pt-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-100 truncate">{title}</div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      <span>{rec.type === 'video' ? 'EP' : 'CH'} {rec.itemNumber}</span>
                      <span className="mx-1.5 text-zinc-600">·</span>
                      <span className="text-red-400">{Math.round(rec.percent)}%</span>
                      <span className="mx-1.5 text-zinc-600">·</span>
                      <span className="text-zinc-500">{dateStr}</span>
                    </div>
                  </div>

                  {matchedItem && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenItem(matchedItem, rec.itemNumber);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-1 transition-colors shrink-0"
                    >
                      {rec.type === 'video' ? <Play className="w-3 h-3 fill-current" /> : <BookOpen className="w-3 h-3" />}
                      <span>Resume</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 bg-[#0B0E14] border-t border-[#1A202C] flex items-center justify-between text-xs">
          {savedRecords.length > 0 && (
            <button
              type="button"
              onClick={clearAllHistory}
              className="text-zinc-400 hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#161C28] border border-[#232B3E] text-zinc-300 hover:text-white transition-colors ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
