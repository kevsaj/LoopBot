// Unlock toasts: one at a time at the top of the screen, a chime, then gone after ~2.8 s.

import { useEffect } from 'react';
import type { Toast } from './useRewards';
import { fx } from '../audio/feedback';

export function Toasts({ toasts, onDone }: { toasts: Toast[]; onDone(id: string): void }) {
  const t = toasts[0];
  useEffect(() => {
    if (!t) return;
    fx.ding();
    const timer = window.setTimeout(() => onDone(t.id), 2800);
    return () => window.clearTimeout(timer);
  }, [t, onDone]);
  if (!t) return null;
  return (
    <div className="reward-toast" role="status" key={t.id} onClick={() => onDone(t.id)}>
      <span className="reward-toast-icon" aria-hidden="true">
        {t.icon}
      </span>
      <span>{t.text}</span>
    </div>
  );
}
