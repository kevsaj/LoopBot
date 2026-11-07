import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Android's system Back: close the open sheet (settings, hints, results) if there is one,
 * otherwise let the app go up a screen (`goUp` returns false at the top), and from the top
 * send the app to the background.
 * Every sheet closes when its backdrop is tapped, so Back taps the top one.
 */
export function listenForBack(goUp: () => boolean) {
  if (Capacitor.getPlatform() !== 'android') return () => {};
  const handle = App.addListener('backButton', () => {
    const backdrops = document.querySelectorAll<HTMLElement>('.results-backdrop');
    if (backdrops.length) return backdrops[backdrops.length - 1].click();
    if (goUp()) return;
    void App.minimizeApp();
  });
  return () => void handle.then((h) => h.remove());
}
