// Types shared by the server and the client. Type-only: import with `import type`.

export interface SectionRef {
  id: number;
  name: string;
}

export interface Section extends SectionRef {
  slug: string;
  position: number;
  isDefault: boolean;
  movieCount: number;
  createdAt: string;
}

/** Aspects that can be rated separately from the overall score. */
export type RatingAspect = 'story' | 'characters' | 'acting' | 'soundtrack' | 'enjoyment';

/** Optional per-aspect scores (0–10). Unrated aspects are simply absent. */
export type AspectRatings = Partial<Record<RatingAspect, number>>;

export interface Review {
  body: string;
  dateWatched: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Movie {
  id: number;
  tmdbId: number | null;
  title: string;
  releaseDate: string | null;
  releaseYear: number | null;
  director: string | null;
  description: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  runtime: number | null;
  genres: string[];
  rating: number | null;
  ratedAt: string | null;
  aspectRatings: AspectRatings;
  review: Review | null;
  sections: SectionRef[];
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Payload to add a movie (with optional rating, review and sections in one go). */
export interface MovieInput {
  tmdbId?: number | null;
  title: string;
  releaseDate?: string | null;
  releaseYear?: number | null;
  director?: string | null;
  description?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  runtime?: number | null;
  genres?: string[];
  rating?: number | null;
  /** Replaces all aspect scores; `{}` or null clears them. */
  aspectRatings?: AspectRatings | null;
  review?: string | null;
  dateWatched?: string | null;
  sectionIds?: number[];
}

export type MovieUpdate = Partial<MovieInput>;

export interface ReviewInput {
  rating: number | null;
  aspectRatings?: AspectRatings | null;
  body: string;
  dateWatched: string | null;
}

export type SortField = 'rating' | 'release' | 'title' | 'added' | 'reviewed';
export type SortOrder = 'asc' | 'desc';

export interface MovieListQuery {
  q?: string;
  genre?: string;
  year?: number;
  minRating?: number;
  maxRating?: number;
  section?: number;
  sort?: SortField;
  order?: SortOrder;
  limit?: number;
}

export interface LibraryFacets {
  genres: { name: string; count: number }[];
  years: number[];
}

export interface Stats {
  totalMovies: number;
  ratedMovies: number;
  writtenReviews: number;
  averageRating: number | null;
  highestRating: number | null;
  totalRuntimeMinutes: number;
  watchedThisYear: number;
  genreCount: number;
  sectionCount: number;
  ratingDistribution: { bucket: number; count: number }[];
  topGenres: { name: string; count: number; averageRating: number | null }[];
  topDirectors: { name: string; count: number; averageRating: number | null }[];
  recentlyReviewed: Movie[];
  highestRated: Movie[];
}

export interface TmdbSearchResult {
  tmdbId: number;
  title: string;
  releaseDate: string | null;
  releaseYear: number | null;
  posterUrl: string | null;
  overview: string | null;
  genres: string[];
  inLibraryId: number | null;
}

export interface TmdbSearchResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: TmdbSearchResult[];
}

export interface TmdbMovieDetails {
  tmdbId: number;
  title: string;
  releaseDate: string | null;
  releaseYear: number | null;
  director: string | null;
  description: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  runtime: number | null;
  genres: string[];
  inLibraryId: number | null;
}

export interface TmdbStatus {
  configured: boolean;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: unknown;
}
