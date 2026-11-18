// Spoken updates for screen readers (TalkBack, VoiceOver, NVDA): one hidden live region for the
// whole app. announce() says a line without moving focus. Sighted players never see it.

let polite: HTMLElement | null = null;
let assertive: HTMLElement | null = null;
let timer: number | undefined;

function region(kind: 'polite' | 'assertive'): HTMLElement {
  const el = document.createElement('div');
  el.className = 'sr-only';
  el.setAttribute('aria-live', kind);
  el.setAttribute('aria-atomic', 'true');
  el.dataset.announcer = kind;
  document.body.appendChild(el);
  return el;
}

/**
 * Say a line. 'assertive' interrupts whatever the screen reader is saying (for something the
 * player asked for, like Describe board); 'polite' waits its turn.
 */
export function announce(text: string, kind: 'polite' | 'assertive' = 'polite') {
  if (typeof document === 'undefined' || !text) return;
  const el = kind === 'polite' ? (polite ??= region('polite')) : (assertive ??= region('assertive'));
  // Empty it first so the same line twice in a row is still read out.
  el.textContent = '';
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    el.textContent = text;
  }, 60);
}
