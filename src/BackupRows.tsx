// Settings > Your progress: copy a backup code, or paste one to bring progress back
// (new phone, reinstall). See src/storage/backup.ts for the format.

import { useState } from 'react';
import { fx } from './audio/feedback';
import { makeBackupCode, readBackupCode, restoreBackupCode } from './storage/backup';
import { t } from './i18n';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older WebViews: select a hidden textarea and copy
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function BackupRows() {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'show'>('idle');
  const [code, setCode] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [paste, setPaste] = useState('');
  const [error, setError] = useState('');

  const copy = async () => {
    fx.tap();
    const c = makeBackupCode();
    setCode(c);
    setCopied((await copyText(c)) ? 'copied' : 'show');
  };

  const restore = () => {
    if (!readBackupCode(paste)) {
      fx.denied();
      setError(t("That code doesn't look right. Check that you copied all of it."));
      return;
    }
    if (!window.confirm(t('Replace the progress on this device with the progress in this code?'))) return;
    const r = restoreBackupCode(paste);
    if (!r.ok) return setError(t(r.reason));
    fx.tap();
    window.location.reload();
  };

  return (
    <>
      <div className="set-item">
        <button type="button" className="set-row set-link" onClick={() => void copy()}>
          <span className="set-label">{t('Copy backup code')}</span>
          <span className="set-value">{copied === 'copied' ? t('Copied') : ''}</span>
        </button>
        <p className="set-caption">
          {copied === 'show'
            ? t('Copy this code somewhere safe:')
            : t('A code with your floors, stars, hints and streak. Paste it in a note or email it to yourself.')}
        </p>
        {copied === 'show' && <textarea className="fb-text backup-code" readOnly value={code} rows={3} onFocus={(e) => e.target.select()} />}
      </div>
      <div className="set-item">
        <button type="button" className="set-row set-link" aria-expanded={restoring} onClick={() => (fx.tap(), setRestoring(!restoring), setError(''))}>
          <span className="set-label">{t('Restore from a backup code')}</span>
          <span className="set-chevron" aria-hidden="true">
            {restoring ? '⌄' : '›'}
          </span>
        </button>
        {restoring ? (
          <div className="backup-restore">
            <textarea
              className="fb-text backup-code"
              rows={3}
              placeholder={t('Paste your code (starts with LB1-)')}
              value={paste}
              onChange={(e) => (setPaste(e.target.value), setError(''))}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {error && <p className="set-caption fb-error">{error}</p>}
            <button type="button" className="pill primary" disabled={!paste.trim()} onClick={restore}>
              {t('Restore')}
            </button>
          </div>
        ) : (
          <p className="set-caption">{t('For a new phone or after reinstalling. Replaces the progress on this device.')}</p>
        )}
      </div>
    </>
  );
}
