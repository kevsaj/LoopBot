import type { Program, Routine } from '../sim/types';
import { toCode } from '../sim/program';

interface Props {
  program: Program;
  routines: Routine[];
  activeIds: Set<string>;
  crashId: string | null;
}

/** ED-9 to ED-11: the same program as read-only Python-like code, with the running line lit. */
export function CodeView({ program, routines, activeIds, crashId }: Props) {
  const lines = toCode(program, routines);
  return (
    <pre className="code-view" aria-label="Program as code (read only)">
      {lines.map((l, i) => (
        <div
          key={i}
          className={`code-line${l.blockId && activeIds.has(l.blockId) ? ' active' : ''}${l.blockId && l.blockId === crashId ? ' crashed' : ''}`}
        >
          <span className="code-no">{i + 1}</span>
          {l.text || ' '}
        </div>
      ))}
    </pre>
  );
}
