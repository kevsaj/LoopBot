import { useCallback, useState } from 'react';
import { LEVELS } from './levels';
import { FloorScreen } from './editor/FloorScreen';
import { loadProgress, saveProgress } from './progress';
import type { Progress } from './progress';

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
  const [progress, setProgressState] = useState<Progress>(loadProgress);
  const setProgress = useCallback((update: (p: Progress) => Progress) => {
    setProgressState((p) => {
      const next = update(p);
      saveProgress(next);
      return next;
    });
  }, []);
  const go = useCallback((i: number) => {
    const n = Math.max(0, Math.min(LEVELS.length - 1, i));
    setIndex(n);
    try {
      localStorage.setItem('loopbot.floor', String(n));
    } catch {
      /* ignore */
    }
  }, []);
  const level = LEVELS[index];
  // Keyed by floor, so each floor mounts its own editor and autosave slot.
  return (
    <FloorScreen
      key={level.id}
      level={level}
      floorNumber={index + 1}
      floorCount={LEVELS.length}
      progress={progress}
      setProgress={setProgress}
      onGo={go}
    />
  );
}
