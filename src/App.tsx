import { useCallback, useState } from 'react';
import { LEVELS } from './levels';
import { FloorScreen } from './editor/FloorScreen';
import { TowerMap } from './TowerMap';
import { SettingsSheet } from './SettingsSheet';
import { isUnlocked, loadProgress, saveProgress } from './progress';
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
  const [progress, setProgressState] = useState<Progress>(loadProgress);
  const [index, setIndex] = useState(loadIndex);
  // A brand-new player goes straight to Floor 1; after that, the tower map is home.
  const [screen, setScreen] = useState<'map' | 'floor'>(() => (Object.keys(loadProgress().stars).length ? 'map' : 'floor'));
  const [settings, setSettings] = useState(false);

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
    setScreen('floor');
    try {
      localStorage.setItem('loopbot.floor', String(n));
    } catch {
      /* ignore */
    }
  }, []);

  const ids = LEVELS.map((l) => l.id);
  // Never open a locked floor (e.g. a saved index from before progress existed).
  const safeIndex = isUnlocked(progress, ids, index) ? index : 0;
  const level = LEVELS[safeIndex];

  if (screen === 'map') {
    return (
      <>
        <TowerMap levels={LEVELS} progress={progress} current={safeIndex} onPick={go} onSettings={() => setSettings(true)} />
        {settings && <SettingsSheet progress={progress} setProgress={setProgress} onClose={() => setSettings(false)} />}
      </>
    );
  }
  // Keyed by floor, so each floor mounts its own editor and autosave slot.
  return (
    <FloorScreen
      key={level.id}
      level={level}
      floorNumber={safeIndex + 1}
      floorCount={LEVELS.length}
      progress={progress}
      setProgress={setProgress}
      onGo={go}
      onTower={() => setScreen('map')}
    />
  );
}
