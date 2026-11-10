// Sharing text (the daily challenge result). On the phones this opens the native share sheet;
// Android's WebView has no Web Share API, so before this it could only copy to the clipboard.

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export type ShareResult = 'shared' | 'copied' | 'saved' | 'cancelled' | 'failed';

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

/**
 * Shares a picture. On the phones the PNG is written to the app's cache folder (no permission
 * needed) and handed to the share sheet; in a browser it uses Web Share with files, or downloads it.
 */
export async function shareImage(png: Blob, text: string, name = 'loopbot.png'): Promise<ShareResult> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const data = await blobToBase64(png);
      const { uri } = await Filesystem.writeFile({
        path: name,
        data,
        directory: Directory.Cache,
      });
      await Share.share({
        text,
        files: [uri],
        dialogTitle: 'Share your LoopBot solution',
      });
      return 'shared';
    }
    const file = new File([png], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return 'shared';
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(png);
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return 'saved';
  } catch (err) {
    return cancelled(err) ? 'cancelled' : 'failed';
  }
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}
