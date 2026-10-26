import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';

/** A panel that slides in from the right (from the bottom on phones). Esc or the backdrop closes it. */
export function Sheet({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      before?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div className="sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}>
        <button className="sheet-close" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
