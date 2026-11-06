import { useCallback, useState } from 'react';
import { LEVELS } from './levels';
import { FloorScreen } from './editor/FloorScreen';

function loadIndex() {
  try {
    const n = Number(localStorage.getItem('loopbot.floor') ?? 0);
    return Number.isInteger(n) && n >= 0 && n < LEVELS.length ? n : 0;
  } catch {
    return 0;
  }
}

export default function App() {
  const [index, setIndex] = useState(loadIndex);
  const go = useCallback((i: number) => {
    const n = Math.max(0, Math.min(LEVELS.length - 1, i));
    setIndex(n);
    try {
      localStorage.setItem('loopbot.floor', String(n));
    } catch {
      /* ignore */
    }
  }, []);
  const cleared = useCallback((stars: number) => {
    const level = LEVELS[index];
    try {
      const key = `loopbot.stars.${level.id}`;
      const best = Number(localStorage.getItem(key) ?? 0);
      if (stars > best) localStorage.setItem(key, String(stars));
    } catch {
      /* ignore */
    }
  }, [index]);
  const level = LEVELS[index];
  // Keyed by floor, so each floor mounts its own editor and autosave slot.
  return <FloorScreen key={level.id} level={level} floorNumber={index + 1} floorCount={LEVELS.length} onGo={go} onCleared={cleared} />;
}
