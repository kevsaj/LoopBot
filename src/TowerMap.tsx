// The tower map: home after the first floor (doc: "Screens and flows").
// Floors stack bottom to top like the building; cleared floors light up.

import { useEffect, useRef } from 'react';
import type { LevelFile } from './sim/types';
import type { Progress } from './progress';
import { isUnlocked } from './progress';
import { fx } from './audio/feedback';

interface Props {
  levels: LevelFile[];
  progress: Progress;
  current: number;
  onPick(index: number): void;
  onSettings(): void;
}

export function TowerMap({ levels, progress, current, onPick, onSettings }: Props) {
  const ids = levels.map((l) => l.id);
  const totalStars = ids.reduce((n, id) => n + (progress.stars[id] ?? 0), 0);
  const currentRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <div className="tower">
      <header className="topbar">
        <div className="floor-title">
          <span className="floor-pick">Tower 1</span>
          <span className="floor-name">Meridian Spire</span>
        </div>
        <div className="tower-stars" aria-label={`${totalStars} of ${ids.length * 3} stars`}>
          ★ {totalStars} / {ids.length * 3}
        </div>
        <button type="button" className="icon-btn" aria-label="Settings" onClick={onSettings}>
          ⚙
        </button>
      </header>
      <div className="tower-scroll">
        <div className="tower-band">The Lobby · Floors 1 to 10</div>
        <ol className="tower-floors" reversed>
          {levels
            .map((l, i) => ({ l, i }))
            .reverse()
            .map(({ l, i }) => {
              const open = isUnlocked(progress, ids, i);
              const stars = progress.stars[l.id] ?? 0;
              const boss = (i + 1) % 10 === 0;
              return (
                <li key={l.id} ref={i === current ? currentRef : undefined}>
                  <button
                    type="button"
                    className={`tower-floor${stars ? ' cleared' : ''}${open ? '' : ' locked'}${boss ? ' boss' : ''}${i === current ? ' current' : ''}`}
                    disabled={!open}
                    onClick={() => {
                      fx.tap();
                      onPick(i);
                    }}
                    aria-label={open ? `Floor ${i + 1}, ${l.title}, ${stars} stars` : `Floor ${i + 1}, locked`}
                  >
                    <span className="tf-num">{i + 1}</span>
                    <span className="tf-title">{open ? l.title : 'Locked'}</span>
                    <span className="tf-stars" aria-hidden="true">
                      {[1, 2, 3].map((s) => (
                        <span key={s} className={s <= stars ? 'on' : ''}>
                          ★
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
        </ol>
        <div className="tower-ground">Sub-basement</div>
      </div>
    </div>
  );
}
