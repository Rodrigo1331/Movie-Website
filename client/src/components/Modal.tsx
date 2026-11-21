import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Spinner } from './ui';

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md animate-scale-in rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-2xl shadow-black">
        <button className="btn-ghost absolute top-3 right-3 p-2" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </button>
        <h2 className="pr-8 font-display text-xl font-semibold text-ink-100">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', pending, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm leading-relaxed text-ink-300">{message}</div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button className="btn-danger" onClick={onConfirm} disabled={pending} autoFocus>
          {pending && <Spinner className="size-4" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
