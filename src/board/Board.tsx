import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import type { BoardScene, BoardUpdate } from './BoardScene';
import { fx } from '../audio/feedback';
import { t } from '../i18n';
import type { World } from '../sim/types';

/** Twist's bands: their floors show a compass, for the turntables and the facing north sensor. */
const COMPASS_BANDS = new Set(['ferry', 'garden', 'loom', 'lantern', 'pinnacle']);
/**
 * Where north points on screen after 0 to 3 quarter turns of the view, in degrees clockwise from
 * straight up. North runs along the board's isometric diagonal, so the angles aren't 90 apart.
 */
const NORTH_DEG = [63.4, 116.6, 243.4, 296.6];
/** Dockyard's bands: their floors show the tally board, LoopBot's one number (CR-TALLY). */
const TALLY_BANDS = new Set(['quay', 'crane', 'ropewalk', 'office', 'crest']);

/**
 * Phaser is most of the app's code, so it loads on its own: the tower map opens without it, and
 * preloadBoard() fetches it in the background so a floor still opens at once.
 */
let loading: Promise<typeof import('./BoardScene')> | null = null;
export function preloadBoard() {
  loading ??= import('./BoardScene');
  return loading;
}

interface Props {
  update: BoardUpdate;
  rotateSignal: number;
  /** The floor's band, which picks the board's palette. */
  band: string;
}

/** The board on screen now (there is only ever one), for the share image. */
let active: BoardScene | null = null;
export function snapshotBoard(): Promise<HTMLImageElement | null> {
  return active ? active.snapshot() : Promise.resolve(null);
}

/** Mounts the Phaser board inside React and pushes simulation snapshots into it. */
export function Board({ update, rotateSignal, band }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<BoardScene | null>(null);
  const latest = useRef(update);
  latest.current = update;

  useEffect(() => {
    const el = host.current!;
    let game: Phaser.Game | null = null;
    let gone = false;
    // Follow the board area's size (rotation, landscape layout, tablet split view).
    // Phaser's RESIZE mode sizes the canvas from its own reading of the parent, so refresh that
    // reading rather than calling scale.resize(), which used the old reading and left the board
    // one size behind (stuck small after the board area shrank and grew back).
    const ro = new ResizeObserver(() => {
      if (!game || !el.clientWidth || !el.clientHeight) return;
      game.scale.getParentBounds();
      game.scale.refresh();
    });
    void preloadBoard().then(({ createBoard, setBand }) => {
      if (gone) return;
      setBand(band);
      game = createBoard(el, (s) => {
        scene.current = s;
        active = s;
        s.show(latest.current);
      });
      ro.observe(el);
    });
    return () => {
      gone = true;
      ro.disconnect();
      if (active === scene.current) active = null;
      game?.destroy(true);
      game = null;
      scene.current = null;
    };
    // The board is mounted once per floor (the floor screen is keyed by floor id).
  }, []);

  useEffect(() => {
    scene.current?.show(update);
  }, [update]);

  useEffect(() => {
    if (rotateSignal) scene.current?.rotate();
  }, [rotateSignal]);

  // Tap LoopBot and it chirps back.
  const poke = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (scene.current?.poke(e.clientX - r.left, e.clientY - r.top)) fx.voice('poke');
  };

  return (
    <>
      <div className="board-canvas" ref={host} aria-hidden="true" onPointerDown={poke} />
      {COMPASS_BANDS.has(band) && <Compass deg={NORTH_DEG[rotateSignal % 4]} />}
      {TALLY_BANDS.has(band) && <TallyBoard n={update.world.tally} />}
      {update.world.twin && <TwinBadge world={update.world} />}
    </>
  );
}

/** A small compass in the board's corner. Its needle turns with the view, so it always points at the board's north. */
function Compass({ deg }: { deg: number }) {
  return (
    <div className="board-compass" role="img" aria-label={t('Compass: the needle points north')}>
      <div className="board-compass-needle" style={{ transform: `rotate(${deg}deg)` }}>
        <span className="board-compass-n" style={{ transform: `rotate(${-deg}deg)` }}>
          {t('N')}
        </span>
      </div>
    </div>
  );
}

/**
 * Twin Spires (CR-TWIN): who is who on the board, ticked off as each bot parks at its lift.
 * LoopBot's swatch uses the player's paint (the --bot-top variable), Echo's is always lilac.
 */
function TwinBadge({ world }: { world: World }) {
  const parked = (b: { x: number; y: number }) => world.tiles[b.y][b.x].type === 'exit';
  return (
    <div className="board-twins" role="img" aria-label={t('LoopBot and Echo both run your program')}>
      <span className={parked(world.bot) ? 'parked' : ''}>
        <i style={{ background: 'var(--bot-top, #f7f3ea)' }} />
        LoopBot
      </span>
      <span className={world.twin && parked(world.twin) ? 'parked' : ''}>
        <i style={{ background: '#c4b2ff' }} />
        {t('Echo')}
      </span>
    </div>
  );
}

/** Dockyard's tally board: a dockside flip sign with LoopBot's one number. The digit flips when it changes. */
function TallyBoard({ n }: { n: number }) {
  return (
    <div className="board-tally" role="img" aria-label={t('Tally: {n}', { n })}>
      <span className="board-tally-label">{t('tally')}</span>
      <span className="board-tally-n" key={n}>
        {n}
      </span>
    </div>
  );
}
