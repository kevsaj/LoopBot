import { useEffect, useRef, useState } from 'react';
import type { LevelFile, Program, Routine } from '../sim/types';
import { countCommands, toCode } from '../sim/program';
import { parseCode } from '../sim/code';

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

interface EditorProps {
  program: Program;
  routines: Routine[];
  level: LevelFile;
  onApply(p: Program, commands: number): void;
  onError(message: string): void;
  onClose(): void;
}

/**
 * Rooftop pro mode (ED-11): the code view as a text box. Run turns the text into blocks with the
 * same syntax the read-only view shows; a mistake names its line and leaves the blocks alone.
 */
export function CodeEditor({ program, routines, level, onApply, onError, onClose }: EditorProps) {
  const [text, setText] = useState(() => toCode(program, routines).map((l) => l.text).join('\n') + '\n');
  const [error, setError] = useState<{ line: number; error: string } | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => box.current?.focus(), []);
  const apply = () => {
    const r = parseCode(text, level);
    if (!r.ok) {
      setError(r);
      onError(`line ${r.line}: ${r.error}`);
      return;
    }
    setError(null);
    onApply(r.program, countCommands(r.program));
    onClose();
  };
  const lines = text.split('\n').length;
  return (
    <div className="code-editor">
      <div className="code-edit-area">
        <pre className="code-gutter" aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => (
            <span key={i} className={error?.line === i + 1 ? 'bad' : undefined}>
              {i + 1}
              {'\n'}
            </span>
          ))}
        </pre>
        <textarea
          ref={box}
          className="code-input"
          value={text}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          wrap="off"
          rows={Math.max(6, lines)}
          aria-label="Type your program as code"
          aria-invalid={!!error}
          onChange={(e) => (setText(e.target.value), setError(null))}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              // Tab indents by four spaces instead of leaving the box.
              e.preventDefault();
              const t = e.currentTarget;
              const { selectionStart: a, selectionEnd: b } = t;
              const next = text.slice(0, a) + '    ' + text.slice(b);
              setText(next);
              requestAnimationFrame(() => t.setSelectionRange(a + 4, a + 4));
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              apply();
            } else if (e.key === 'Enter') {
              // A new line keeps the indent, one level deeper after a line ending in ":".
              e.preventDefault();
              const t = e.currentTarget;
              const { selectionStart: a, selectionEnd: b } = t;
              const line = text.slice(text.lastIndexOf('\n', a - 1) + 1, a);
              const indent = (line.match(/^ */)?.[0] ?? '') + (/:\s*$/.test(line) ? '    ' : '');
              const next = text.slice(0, a) + '\n' + indent + text.slice(b);
              setText(next);
              const at = a + 1 + indent.length;
              requestAnimationFrame(() => t.setSelectionRange(at, at));
            }
          }}
        />
      </div>
      {error && (
        <p className="code-error" role="alert">
          Line {error.line}: {error.error}
        </p>
      )}
      <div className="code-actions">
        <button type="button" className="pill" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="pill primary" onClick={apply}>
          Use this code
        </button>
      </div>
    </div>
  );
}
