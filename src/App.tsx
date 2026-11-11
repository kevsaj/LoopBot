import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LEVELS } from './levels';
import { FloorScreen } from './editor/FloorScreen';
import { TowerMap } from './TowerMap';
import { TitleScreen } from './TitleScreen';
import { SettingsSheet } from './SettingsSheet';
import { isUnlocked, loadProgress, saveProgress } from './progress';
import type { Progress } from './progress';
import { fx } from './audio/feedback';
import { initMusic, setMusicTheme, themeForFloor } from './audio/music';
import { useRewards } from './rewards/useRewards';
import { Locker } from './rewards/Locker';
import { Toasts } from './rewards/Toasts';
import { applyLookCss, loadLook } from './rewards/looks';
import type { Look } from './rewards/looks';
import { refreshReminders } from './reminder';
import { reducedMotion } from './fx/confetti';
import { preloadBoard } from './board/Board';
import { listenForBack } from './native';
import { startTelemetry } from './telemetry';
import { Interlude } from './story/Interlude';
import { interludeAfter, markInterludeSeen } from './story/interludes';
import type { Interlude as Beat } from './story/interludes';
import type { LevelFile } from './sim/types';
import { currentStreak, yesterday, dailyLevel, dateKey, loadDaily, pruneOldDailies, recordDailyClear, saveDaily } from './daily';
import type { DailyState } from './daily';

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
  // Every launch opens on the title screen, whose intro plays once per session; its Play button
  // goes to the next floor (Floor 1 for a new player), and the tower map is one tap further.
  const [screen, setScreen] = useState<'title' | 'map' | 'floor' | 'daily'>('title');
  // The daily challenge: today's floor once it's loaded, and the screen to go back to.
  const [daily, setDailyState] = useState<DailyState>(loadDaily);
  // Re-plan the week of daily reminders on launch and whenever the daily changes (a clear skips today's).
  useEffect(() => void refreshReminders(daily), [daily]);
  const [dailyFloor, setDailyFloor] = useState<{ date: string; level: LevelFile } | null>(null);
  const dailyFrom = useRef<'title' | 'map'>('title');
  const [booted, setBooted] = useState(false);
  const onBooted = useCallback(() => setBooted(true), []);
  const [settings, setSettings] = useState(false);
  // The board engine loads after the first screen is up, so opening a floor never waits on it.
  useEffect(() => {
    void preloadBoard();
    startTelemetry();
    initMusic();
  }, []);

  const setProgress = useCallback((update: (p: Progress) => Progress) => {
    setProgressState((p) => {
      const next = update(p);
      saveProgress(next);
      return next;
    });
  }, []);
  // Elevator doors: they close, the floor changes behind them, and they open with a ding.
  const [doors, setDoors] = useState<'closing' | 'opening' | null>(null);
  const doorTimer = useRef<number | undefined>(undefined);
  const ride = useCallback((arrive: () => void) => {
    if (reducedMotion()) return arrive();
    window.clearTimeout(doorTimer.current);
    setDoors('closing');
    doorTimer.current = window.setTimeout(() => {
      arrive();
      fx.ding();
      setDoors('opening');
      doorTimer.current = window.setTimeout(() => setDoors(null), 520);
    }, 380);
  }, []);
  const go = useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(LEVELS.length - 1, i));
      ride(() => {
        setIndex(n);
        setScreen('floor');
        try {
          localStorage.setItem('loopbot.floor', String(n));
        } catch {
          /* ignore */
        }
      });
    },
    [ride],
  );
  const openDaily = useCallback(
    (from: 'title' | 'map') => {
      const date = dateKey();
      dailyFrom.current = from;
      setProgress((p) => pruneOldDailies(date, p));
      void dailyLevel(date).then((level) =>
        ride(() => {
          setDailyFloor({ date, level });
          setScreen('daily');
        }),
      );
    },
    [ride, setProgress],
  );
  const clearDaily = useCallback((date: string, stars: number) => {
    setDailyState((s) => {
      const next = recordDailyClear(s, date, stars);
      saveDaily(next);
      return next;
    });
  }, []);
  const elevator = doors && (
    <div className={`elevator ${doors}`} aria-hidden="true">
      <span className="door left" />
      <span className="door right" />
    </div>
  );

  // Android Back walks up: floor, tower map, title screen, then out of the app.
  const screenRef = useRef(screen);
  screenRef.current = screen;
  useEffect(
    () =>
      listenForBack(() => {
        if (screenRef.current === 'title') return false;
        setScreen(screenRef.current === 'floor' ? 'map' : screenRef.current === 'daily' ? dailyFrom.current : 'title');
        return true;
      }),
    [],
  );

  const ids = useMemo(() => LEVELS.map((l) => l.id), []);
  // Never open a locked floor (e.g. a saved index from before progress existed).
  const safeIndex = isUnlocked(progress, ids, index) ? index : 0;
  const level = LEVELS[safeIndex];
  /** Leaving a tower floor: play the band's story beat first if it's due. */
  const leaveFloor = (next: () => void) => {
    const due = interludeAfter(safeIndex + 1, (progress.stars[level.id] ?? 0) > 0);
    if (due) setBeat({ beat: due, then: next });
    else next();
  };
  // Achievements, unlocked looks and the toasts for anything new.
  const rewards = useRewards(ids, progress, daily);
  const [look, setLook] = useState<Look>(loadLook);
  const [locker, setLocker] = useState(false);
  // A story beat waiting to play before the next screen (PATCH's radio call, or the ending).
  const [beat, setBeat] = useState<{ beat: Beat; then: () => void } | null>(null);
  useEffect(() => applyLookCss(look), [look]);
  const openLocker = () => {
    setLocker(true);
    rewards.markAllSeen();
  };
  const overlays = (
    <>
      {beat && (
        <Interlude
          beat={beat.beat}
          onDone={() => {
            markInterludeSeen(beat.beat.id);
            setBeat(null);
            beat.then();
          }}
        />
      )}
      {locker && <Locker stats={rewards.stats} earned={rewards.earned} look={look} onLook={setLook} onClose={() => setLocker(false)} />}
      <Toasts toasts={rewards.toasts} onDone={rewards.dismissToast} />
    </>
  );
  // Each band of the tower has its own theme; the title and tower map share one.
  useEffect(() => {
    setMusicTheme(screen === 'floor' ? themeForFloor(safeIndex + 1) : screen === 'daily' ? 'daily' : 'title');
  }, [screen, safeIndex]);

  if (screen === 'title') {
    return (
      <>
        <TitleScreen
          levels={LEVELS}
          progress={progress}
          booted={booted}
          onBooted={onBooted}
          onPlay={go}
          onTower={() => setScreen('map')}
          onSettings={() => setSettings(true)}
          daily={daily}
          onDaily={() => openDaily('title')}
          onLocker={openLocker}
          lockerNew={rewards.hasNew}
        />
        {settings && <SettingsSheet progress={progress} setProgress={setProgress} onClose={() => setSettings(false)} />}
        {overlays}
        {elevator}
      </>
    );
  }
  if (screen === 'map') {
    return (
      <>
        <TowerMap
          levels={LEVELS}
          progress={progress}
          current={safeIndex}
          onPick={go}
          onSettings={() => setSettings(true)}
          onHome={() => setScreen('title')}
          daily={daily}
          onDaily={() => openDaily('map')}
          onLocker={openLocker}
          lockerNew={rewards.hasNew}
        />
        {settings && <SettingsSheet progress={progress} setProgress={setProgress} onClose={() => setSettings(false)} />}
        {overlays}
        {elevator}
      </>
    );
  }
  if (screen === 'daily' && dailyFloor) {
    const { date, level: today } = dailyFloor;
    return (
      <>
        <FloorScreen
          key={today.id}
          level={today}
          floorNumber={0}
          floorCount={LEVELS.length}
          progress={progress}
          setProgress={setProgress}
          onGo={go}
          onTower={() => setScreen(dailyFrom.current)}
          daily={{
            date,
            best: daily.best[date] ?? 0,
            streak: currentStreak(daily, date),
            froze: daily.last === date && (daily.frozen ?? []).includes(yesterday(date)),
            onClear: (stars) => clearDaily(date, stars),
          }}
        />
        {overlays}
        {elevator}
      </>
    );
  }
  // Keyed by floor, so each floor mounts its own editor and autosave slot.
  return (
    <>
      <FloorScreen
        key={level.id}
        level={level}
        floorNumber={safeIndex + 1}
        floorCount={LEVELS.length}
        progress={progress}
        setProgress={setProgress}
        onGo={(i) => leaveFloor(() => go(i))}
        onTower={() => leaveFloor(() => setScreen('map'))}
      />
      {overlays}
      {elevator}
    </>
  );
}
