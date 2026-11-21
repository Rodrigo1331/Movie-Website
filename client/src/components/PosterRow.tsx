import { useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Movie } from '@moviesite/shared';
import { PosterCard } from './PosterCard';
import { SectionHeading } from './ui';

/** Horizontally scrolling shelf of posters with arrow controls. */
export function PosterRow({ title, eyebrow, movies, action }: { title: string; eyebrow?: string; movies: Movie[]; action?: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section className="group/row">
      <SectionHeading
        title={title}
        eyebrow={eyebrow}
        action={
          <div className="flex items-center gap-1">
            {action}
            <button className="btn-ghost hidden p-2 sm:inline-flex" onClick={() => scroll(-1)} aria-label="Scroll left">
              <ChevronLeft className="size-5" />
            </button>
            <button className="btn-ghost hidden p-2 sm:inline-flex" onClick={() => scroll(1)} aria-label="Scroll right">
              <ChevronRight className="size-5" />
            </button>
          </div>
        }
      />
      <div ref={scroller} className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto scroll-px-4 px-4 pt-2 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6">
        {movies.map((movie, i) => (
          <PosterCard key={movie.id} movie={movie} index={i} className="w-36 shrink-0 snap-start sm:w-44" />
        ))}
      </div>
    </section>
  );
}
