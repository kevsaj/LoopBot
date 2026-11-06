import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import type { BoardScene, BoardUpdate } from './BoardScene';
import { createBoard } from './BoardScene';

interface Props {
  update: BoardUpdate;
  rotateSignal: number;
}

/** Mounts the Phaser board inside React and pushes simulation snapshots into it. */
export function Board({ update, rotateSignal }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<BoardScene | null>(null);
  const latest = useRef(update);
  latest.current = update;

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    scene.current?.show(update);
  }, [update]);

  useEffect(() => {
    if (rotateSignal) scene.current?.rotate();
  }, [rotateSignal]);

  return <div className="board-canvas" ref={host} aria-hidden="true" />;
}
