export type MediaType = 'video' | 'manga';

export interface MediaItem {
  id: string;
  title: string;
  altTitle?: string;
  type: MediaType;
  coverImage: string;
  bannerImage: string;
  synopsis: string;
  genres: string[];
  status: 'Ongoing' | 'Completed';
  year: number;
  rating: number;
  views: number;
  authorOrStudio: string;
  episodes?: VideoEpisode[];
  chapters?: MangaChapter[];
}

export interface VideoQualityOption {
  label: string;
  height: number;
  src: string;
}

export interface VideoEpisode {
  id: string;
  number: number;
  title: string;
  durationSeconds: number;
  thumbnail: string;
  releasedAt: string;
  videoSources: VideoQualityOption[];
}

export interface MangaChapter {
  id: string;
  number: number;
  title: string;
  releasedAt: string;
  pageCount: number;
  pages: string[];
}

export interface UserProgress {
  mediaId: string;
  type: MediaType;
  itemNumber: number; // Episode or Chapter number
  currentTime?: number;
  duration?: number;
  percent: number;
  updatedAt: number;
  completed: boolean;
}

export type AdZone = 'header-top' | 'sidebar-sticky' | 'below-media';

export interface AdSlotProps {
  zone: AdZone;
  className?: string;
}
