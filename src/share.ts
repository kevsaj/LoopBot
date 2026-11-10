// Sharing text (the daily challenge result). On the phones this opens the native share sheet;
// Android's WebView has no Web Share API, so before this it could only copy to the clipboard.

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

const cancelled = (err: unknown) => {
  const e = err as { name?: string; message?: string };
  return e?.name === 'AbortError' || /cancel/i.test(e?.message ?? '');
};

export async function shareText(text: string): Promise<ShareResult> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ text, dialogTitle: 'Share your LoopBot result' });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (err) {
    return cancelled(err) ? 'cancelled' : 'failed';
  }
}
