import type { ReactNode } from 'react';
import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { cx } from '../lib/format';

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cx('animate-spin', className ?? 'size-5')} aria-hidden />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-ink-400" role="status" aria-label="Loading">
      <Spinner className="size-7" />
    </div>
  );
}

export function EmptyState(props: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex animate-fade-up flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-white/5 p-4 text-gold-500 [&>svg]:size-7">{props.icon}</div>
      <h3 className="font-display text-xl font-semibold text-ink-100">{props.title}</h3>
      {props.children && <p className="mt-2 max-w-md text-sm text-ink-400">{props.children}</p>}
      {props.action && <div className="mt-6">{props.action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div className="flex flex-col items-center rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-12 text-center">
      <TriangleAlert className="mb-3 size-7 text-red-400" />
      <p className="text-sm text-ink-200">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-5" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-ink-200',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({ title, action, eyebrow }: { title: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-[0.2em] text-gold-500 uppercase">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-semibold text-ink-100">{title}</h2>
      </div>
      {action}
    </div>
  );
}
