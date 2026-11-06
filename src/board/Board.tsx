import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import type { BoardScene, BoardUpdate } from './BoardScene';
import { createBoard, setBand } from './BoardScene';
import { fx } from '../audio/feedback';

interface Props {
  update: BoardUpdate;
  rotateSignal: number;
  /** The floor's band, which picks the board's palette. */
  band: string;
}

/** Mounts the Phaser board inside React and pushes simulation snapshots into it. */
export function Board({ update, rotateSignal, band }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<BoardScene | null>(null);
  const latest = useRef(update);
  latest.current = update;

  useEffect(() => {
    setBand(band);
    const el = host.current!;
    let game: Phaser.Game | null = createBoard(el, (s) => {
      scene.current = s;
      s.show(latest.current);
    });
    // Follow the board area's size (rotation, landscape layout, tablet split view).
    const ro = new ResizeObserver(() => {
      if (game && el.clientWidth && el.clientHeight) game.scale.resize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
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

  return <div className="board-canvas" ref={host} aria-hidden="true" onPointerDown={poke} />;
}
