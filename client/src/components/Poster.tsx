import { useEffect, useState } from 'react';
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
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  const showImage = src && !failed;
  return (
    <div className={cx('relative aspect-[2/3] overflow-hidden bg-ink-800', className)}>
      {showImage ? (
        <>
          {!loaded && <div className="skeleton absolute inset-0" />}
          <img
            src={src}
            alt={`${title} poster`}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
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
