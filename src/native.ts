import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Android's system Back: close the open sheet (settings, hints, results) if there is one,
 * otherwise leave the floor for the tower map, and from the map send the app to the background.
 * Every sheet closes when its backdrop is tapped, so Back taps the top one.
 */
export function listenForBack(onFloor: () => boolean) {
  if (Capacitor.getPlatform() !== 'android') return () => {};
  const handle = App.addListener('backButton', () => {
    const backdrops = document.querySelectorAll<HTMLElement>('.results-backdrop');
    if (backdrops.length) return backdrops[backdrops.length - 1].click();
    if (onFloor()) return;
    void App.minimizeApp();
  });
  return () => void handle.then((h) => h.remove());
}
