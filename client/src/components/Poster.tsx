import { useLayoutEffect, useRef, useState } from 'react';
import { Clapperboard } from 'lucide-react';
import { cx } from '../lib/format';

interface PosterProps {
  src: string | null;
  title: string;
  className?: string;
  eager?: boolean;
}

/** Movie poster with a stylised fallback when there is no image or it fails to load. */
export function Poster({ src, title, className, eager }: PosterProps) {
  // Track state per src so a new src starts fresh without a reset effect.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const img = useRef<HTMLImageElement>(null);

  // Cached images are complete before paint: mark them loaded to avoid a skeleton flash.
  useLayoutEffect(() => {
    if (src && img.current?.complete && img.current.naturalWidth > 0) setLoadedSrc(src);
  }, [src]);

  const loaded = !!src && loadedSrc === src;
  const showImage = src && failedSrc !== src;
  return (
    <div className={cx('relative aspect-[2/3] overflow-hidden bg-ink-800', className)}>
      {showImage ? (
        <>
          {!loaded && <div className="skeleton absolute inset-0" />}
          <img
            ref={img}
            src={src}
            alt={`${title} poster`}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            onLoad={() => setLoadedSrc(src)}
            onError={() => setFailedSrc(src)}
            className={cx('size-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
          />
        </>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-ink-700 via-ink-800 to-ink-900 p-4 text-center">
          <Clapperboard className="size-8 text-ink-500" />
          <span className="line-clamp-3 font-display text-sm font-semibold text-ink-300">{title}</span>
        </div>
      )}
    </div>
  );
}
