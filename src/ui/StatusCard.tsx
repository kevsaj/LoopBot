// One look for every "nothing here yet" and "something went wrong" moment: an icon, a short title,
// one line, and at most one button. Used by the store sheets, hint packs, My floors, achievements.

import { useCallback, useEffect, useState } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { fx } from '../audio/feedback';
import { t } from '../i18n';

export function StatusCard({
  icon,
  title,
  text,
  action,
  onAction,
  tone = 'empty',
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: string;
  onAction?: () => void;
  tone?: 'empty' | 'error';
}) {
  return (
    <div className={`status-card ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="status-icon" aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <p className="status-title">{title}</p>
      {text && <p className="status-text">{text}</p>}
      {action && onAction && (
        <button type="button" className="pill status-action" onClick={() => (fx.tap(), onAction())}>
          {action}
        </button>
      )}
    </div>
  );
}

/** The store couldn't be reached: say so plainly, and offer to try again. */
export function StoreOffline({ onRetry }: { onRetry: () => void }) {
  return <StatusCard tone="error" icon="cloud_off" title={t("Can't reach the store")} text={t('Check your connection, then try again.')} action={t('Try again')} onAction={onRetry} />;
}

/**
 * Loads something from the store, with a retry: `value` is 'loading' until the store answers,
 * then the answer (null when the store couldn't be reached), and `retry` asks again.
 */
export function useStoreLoad<T>(load: () => Promise<T>): { value: T | 'loading'; retry: () => void } {
  const [value, setValue] = useState<T | 'loading'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setValue('loading');
    void load().then((v) => live && setValue(v));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { value, retry };
}
