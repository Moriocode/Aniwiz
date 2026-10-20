import { WatchProgressRecord } from '../types/anipm';

const STORAGE_KEY_PREFIX = 'anipm_progress_';
const HISTORY_INDEX_KEY = 'anipm_watch_history_index';

export function getProgressKey(animeId: string | number, episode: number): string {
  return `${STORAGE_KEY_PREFIX}${animeId}_ep${episode}`;
}

export function saveWatchProgress(
  animeId: string | number,
  animeTitle: string,
  episode: number,
  currentTime: number,
  duration: number
): WatchProgressRecord {
  const safeDuration = duration > 0 ? duration : 1440; // fallback standard 24 min episode if 0
  const percentage = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));
  const completed = percentage >= 90 || (safeDuration > 60 && safeDuration - currentTime < 45);

  const record: WatchProgressRecord = {
    animeId,
    animeTitle,
    episode,
    currentTime: Math.round(currentTime * 10) / 10,
    duration: Math.round(safeDuration),
    percentage: Math.round(percentage * 10) / 10,
    updatedAt: Date.now(),
    completed,
  };

  try {
    const key = getProgressKey(animeId, episode);
    localStorage.setItem(key, JSON.stringify(record));

    // Update index of watched episodes
    const rawIndex = localStorage.getItem(HISTORY_INDEX_KEY);
    let index: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    if (!index.includes(key)) {
      index.unshift(key);
      // Keep up to 100 entries
      index = index.slice(0, 100);
      localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(index));
    }
  } catch (err) {
    console.warn('[WatchProgress] Could not save progress to localStorage:', err);
  }

  return record;
}

export function getWatchProgress(animeId: string | number, episode: number): WatchProgressRecord | null {
  try {
    const key = getProgressKey(animeId, episode);
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as WatchProgressRecord;
  } catch (err) {
    console.warn('[WatchProgress] Could not read progress:', err);
    return null;
  }
}

export function getAllWatchHistory(): WatchProgressRecord[] {
  try {
    const rawIndex = localStorage.getItem(HISTORY_INDEX_KEY);
    if (!rawIndex) return [];
    const index: string[] = JSON.parse(rawIndex);
    const results: WatchProgressRecord[] = [];

    for (const key of index) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          results.push(JSON.parse(data));
        } catch {
          // ignore corrupted item
        }
      }
    }

    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.warn('[WatchProgress] Could not read history:', err);
    return [];
  }
}

export function clearWatchHistory(animeId?: string | number, episode?: number): void {
  try {
    if (animeId !== undefined && episode !== undefined) {
      const key = getProgressKey(animeId, episode);
      localStorage.removeItem(key);
      const rawIndex = localStorage.getItem(HISTORY_INDEX_KEY);
      if (rawIndex) {
        const index: string[] = JSON.parse(rawIndex);
        localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(index.filter((k) => k !== key)));
      }
    } else if (animeId !== undefined) {
      const rawIndex = localStorage.getItem(HISTORY_INDEX_KEY);
      if (rawIndex) {
        const index: string[] = JSON.parse(rawIndex);
        const prefix = `${STORAGE_KEY_PREFIX}${animeId}_ep`;
        for (const key of index) {
          if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
          }
        }
        localStorage.setItem(
          HISTORY_INDEX_KEY,
          JSON.stringify(index.filter((k) => !k.startsWith(prefix)))
        );
      }
    } else {
      // Clear all
      const rawIndex = localStorage.getItem(HISTORY_INDEX_KEY);
      if (rawIndex) {
        const index: string[] = JSON.parse(rawIndex);
        for (const key of index) {
          localStorage.removeItem(key);
        }
      }
      localStorage.removeItem(HISTORY_INDEX_KEY);
    }
  } catch (err) {
    console.warn('[WatchProgress] Could not clear history:', err);
  }
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const mm = minutes.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}
