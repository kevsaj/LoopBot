import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LEVELS } from './levels';
import { TOWERS, towerOf } from './levels/towers';
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
import { currentStreak, yesterday, dailyLevel, dateKey, loadDaily, pruneOldDailies, recordArchiveClear, recordDailyClear, saveDaily } from './daily';
import { DailyArchive } from './daily/DailyArchive';
import type { DailyState } from './daily';
import { MAX_FREEZES, PLUS_MAX_FREEZES, dailyHintReward } from './daily';
import { MakerScreen, useMakerDraft } from './maker/MakerScreen';
import { MAKER } from './maker/draft';
import { hasPlus, initPurchases, onHintsGranted, plusUnlocked } from './store/purchases';
import { t, useLang } from './i18n';
import { localFloor } from './levels/localFloor';

/** Each tower remembers its own floor: Tower 1 keeps the original key so old saves carry over. */
const floorKey = (tower: number) => (tower === 1 ? 'loopbot.floor' : `loopbot.floor.t${tower}`);

function loadIndex(tower: number) {
  try {
    const n = Number(localStorage.getItem(floorKey(tower)) ?? 0);
    return Number.isInteger(n) && n >= 0 && n < towerOf(tower).levels.length ? n : 0;
  } catch {
    return 0;
  }
}

/** The tower being climbed. A Plus tower falls back to Tower 1 if Plus isn't unlocked here. */
function loadTower() {
  try {
    const t = towerOf(Number(localStorage.getItem('loopbot.tower') ?? 1));
    return t.plus && !plusUnlocked() ? 1 : t.n;
  } catch {
    return 1;
  }
}

export default function App() {
  const [progress, setProgressState] = useState<Progress>(loadProgress);
  const [tower, setTowerState] = useState(loadTower);
  const [index, setIndex] = useState(() => loadIndex(tower));
  // Floor names, hints and story in the player's language (ids and designs never change).
  const language = useLang();
  const levels = useMemo(() => towerOf(tower).levels.map(localFloor), [tower, language]);
  /** Switch towers: each one opens on the floor you were on there. */
  const setTower = useCallback((n: number) => {
    setTowerState(n);
    setIndex(loadIndex(n));
    try {
      localStorage.setItem('loopbot.tower', String(n));
    } catch {
      /* ignore */
    }
  }, []);
  // Every launch opens on the title screen, whose intro plays once per session; its Play button
  // goes to the next floor (Floor 1 for a new player), and the tower map is one tap further.
  const [screen, setScreen] = useState<'title' | 'map' | 'floor' | 'daily' | 'maker' | 'custom'>('title');
  // The floor maker's draft, and the player-made floor being played (a test of the draft, or a code).
  const [draft, setDraft] = useMakerDraft();
  const [customFloor, setCustomFloor] = useState<{ level: LevelFile; from: 'test' | 'code' } | null>(null);
  const playCustom = useCallback((level: LevelFile, from: 'test' | 'code') => {
    // Test play keeps the maker's program between tries; a new code starts with an empty program.
    const id = from === 'test' ? 'maker' : 'custom';
    if (from === 'code') {
      try {
        localStorage.removeItem('loopbot.editor.custom');
      } catch {
        /* ignore */
      }
    }
    setCustomFloor({ level: { ...level, id }, from });
    setScreen('custom');
  }, []);
  // The daily challenge: today's floor once it's loaded, and the screen to go back to.
  const [daily, setDailyState] = useState<DailyState>(loadDaily);
  // Re-plan the week of daily reminders on launch and whenever the daily changes (a clear skips today's),
  // (and when the language changes, so the notifications speak it too).
  useEffect(() => void refreshReminders(daily), [daily, language]);
  // The daily archive sheet (LoopBot Plus), opened from the tower map.
  const [archive, setArchive] = useState(false);
  const [dailyFloor, setDailyFloor] = useState<{ date: string; level: LevelFile } | null>(null);
  const dailyFrom = useRef<'title' | 'map'>('title');
  const [booted, setBooted] = useState(false);
  const onBooted = useCallback(() => setBooted(true), []);
  const [settings, setSettings] = useState(false);
  // The board engine loads after the first screen is up, so opening a floor never waits on it.
  useEffect(() => {
    void preloadBoard();
    startTelemetry();
    void initPurchases();
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
      const n = Math.max(0, Math.min(levels.length - 1, i));
      ride(() => {
        setIndex(n);
        setScreen('floor');
        try {
          localStorage.setItem(floorKey(tower), String(n));
        } catch {
          /* ignore */
        }
      });
    },
    [ride, levels, tower],
  );
  const openDaily = useCallback(
    (from: 'title' | 'map', date: string = dateKey()) => {
      dailyFrom.current = from;
      setArchive(false);
      setProgress((p) => pruneOldDailies(dateKey(), p, date));
      void dailyLevel(date).then((level) =>
        ride(() => {
          setDailyFloor({ date, level });
          setScreen('daily');
        }),
      );
    },
    [ride, setProgress],
  );
  const dailyRef = useRef(daily);
  dailyRef.current = daily;
  const clearDaily = useCallback(
    (date: string, stars: number) => {
      const before = dailyRef.current;
      // a past day from the archive keeps its stars, but only today's clear moves the streak or earns hints
      const today = date === dateKey();
      const next = today ? recordDailyClear(before, date, stars, hasPlus() ? PLUS_MAX_FREEZES : MAX_FREEZES) : recordArchiveClear(before, date, stars);
      saveDaily(next);
      dailyRef.current = next;
      setDailyState(next);
      // the first clear of the day earns a hint, and every 7-day streak 3 more
      const earned = today ? dailyHintReward(before, next, date) : 0;
      if (earned) setProgress((p) => ({ ...p, hints: p.hints + earned }));
    },
    [setProgress],
  );
  // Hints bought in the store, or the Plus bonus, go straight into the wallet.
  useEffect(() => onHintsGranted((n) => setProgress((p) => ({ ...p, hints: p.hints + n }))), [setProgress]);
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
        setScreen(screenRef.current === 'floor' ? 'map' : screenRef.current === 'daily' ? dailyFrom.current : screenRef.current === 'custom' ? 'maker' : 'title');
        return true;
      }),
    [],
  );

  const ids = useMemo(() => levels.map((l) => l.id), [levels]);
  // Achievements count Tower 1's floors.
  const t1ids = useMemo(() => LEVELS.map((l) => l.id), []);
  // Never open a locked floor (e.g. a saved index from before progress existed).
  const safeIndex = isUnlocked(progress, ids, index) ? index : 0;
  const level = levels[safeIndex];
  /** Leaving a tower floor: play the band's story beat first if it's due. */
  const leaveFloor = (next: () => void) => {
    const due = interludeAfter(safeIndex + 1, (progress.stars[level.id] ?? 0) > 0, undefined, tower);
    if (due) setBeat({ beat: due, then: next });
    else next();
  };
  // Achievements, unlocked looks and the toasts for anything new.
  const rewards = useRewards(t1ids, progress, daily);
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
      {archive && <DailyArchive daily={daily} onPlay={(date) => openDaily('map', date)} onClose={() => setArchive(false)} />}
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
    setMusicTheme(screen === 'floor' ? themeForFloor(safeIndex + 1, tower) : screen === 'daily' || screen === 'custom' ? 'daily' : 'title');
  }, [screen, safeIndex, tower]);

  if (screen === 'title') {
    return (
      <>
        <TitleScreen
          levels={levels}
          towerLabel={t('Tower {n} · {name}', { n: tower, name: t(towerOf(tower).name) })}
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
          onMaker={MAKER ? () => setScreen('maker') : undefined}
        />
        {settings && <SettingsSheet progress={progress} setProgress={setProgress} onClose={() => setSettings(false)} />}
        {overlays}
        {elevator}
      </>
    );
  }
  if (screen === 'maker') {
    return (
      <>
        <MakerScreen draft={draft} setDraft={setDraft} onBack={() => setScreen('title')} onPlay={playCustom} />
        {overlays}
      </>
    );
  }
  if (screen === 'custom' && customFloor) {
    const { level: custom, from } = customFloor;
    return (
      <>
        <FloorScreen
          key={`${custom.id}-${custom.title}`}
          level={custom}
          floorNumber={0}
          floorCount={levels.length}
          progress={progress}
          setProgress={setProgress}
          onGo={() => setScreen('maker')}
          onTower={() => setScreen('maker')}
          custom={{
            back: from === 'test' ? t('Floor maker · test') : t('Floor maker'),
            noPar: from === 'test' && !draft.solved,
            onClear: (commands, steps) => {
              if (from !== 'test') return;
              // The maker's best run sets par: fewest commands first, then fewest steps.
              const best = draft.solved;
              const better = !best || commands < best.commands || (commands === best.commands && steps < best.steps);
              const par = better ? { commands, steps } : best;
              if (better) setDraft((d) => ({ ...d, solved: par }));
              return t('Par is {commands} commands and {steps} steps. Your floor is ready to share.', { commands: par.commands, steps: par.steps });
            },
          }}
        />
        {overlays}
      </>
    );
  }
  if (screen === 'map') {
    return (
      <>
        <TowerMap
          key={tower}
          levels={levels}
          tower={tower}
          towers={TOWERS}
          onTowerPick={setTower}
          progress={progress}
          current={safeIndex}
          onPick={go}
          onSettings={() => setSettings(true)}
          onHome={() => setScreen('title')}
          daily={daily}
          onDaily={() => openDaily('map')}
          onArchive={() => setArchive(true)}
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
          level={localFloor(today)}
          floorNumber={0}
          floorCount={levels.length}
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
        floorCount={levels.length}
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
