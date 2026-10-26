import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Motion helpers. Everything here is skipped when the person prefers reduced motion.

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Things that rise into view as you scroll. Matches by class, so pages need no extra markup. */
const REVEAL = '.card, .glance-tile, .parent-card, .step, .feature, .status-card, .appt, .med, .rem, .team-list li, .day-line li, .fact, .plan-card, .memories > li';

/**
 * Cards fade and rise into view the first time they're seen, siblings slightly staggered.
 * Watches the DOM so content that loads later (after a skeleton) animates too.
 */
export function useScrollReveal() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('sr-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    );
    const seen = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll(REVEAL).forEach((el) => {
        if (seen.has(el) || el.closest('.modal, .drawer, .menu-pop')) return;
        seen.add(el);
        const index = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        (el as HTMLElement).style.setProperty('--sr-delay', `${Math.min(index, 6) * 60}ms`);
        el.classList.add('sr');
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, [pathname]);
}

/** A number that counts to its value (and glides to new values when data refreshes). */
export function useAnimatedNumber(value: number, ms = 750): number {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0);
  const from = useRef(prefersReducedMotion() ? value : 0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);
  return shown;
}
