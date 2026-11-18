// Keyboard and screen reader behaviour for every sheet (settings, hints, results, store, maker):
// when an element with role="dialog" appears, focus moves into it, Tab stays inside it, and when it
// closes focus goes back to the button that opened it. Escape closes it the way Android's Back
// does, by tapping its backdrop. One watcher covers every sheet, so new sheets get it for free.

const opener = new WeakMap<Element, Element | null>();
const open: HTMLElement[] = [];

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(d: HTMLElement): HTMLElement[] {
  return [...d.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => e.getClientRects().length > 0);
}

function opened(d: HTMLElement) {
  if (open.includes(d)) return;
  opener.set(d, document.activeElement);
  open.push(d);
  d.setAttribute('aria-modal', 'true');
  if (!d.hasAttribute('tabindex')) d.tabIndex = -1;
  // Focus the sheet itself, so a screen reader reads its name first, then the player moves on.
  // (Skipped when something inside already took focus, like the feedback text box.)
  requestAnimationFrame(() => {
    if (!d.contains(document.activeElement)) d.focus({ preventScroll: true });
  });
}

function closed(d: HTMLElement) {
  const i = open.indexOf(d);
  if (i < 0) return;
  open.splice(i, 1);
  const back = opener.get(d);
  // Only if focus was lost with the sheet: don't pull it back from wherever the player went.
  if (back instanceof HTMLElement && back.isConnected && (document.activeElement === document.body || document.activeElement === null)) {
    back.focus({ preventScroll: true });
  }
}

function scan() {
  for (const d of document.querySelectorAll<HTMLElement>('[role="dialog"]')) opened(d);
  for (const d of [...open]) if (!d.isConnected) closed(d);
}

function onKey(e: KeyboardEvent) {
  const top = open[open.length - 1];
  if (!top) return;
  if (e.key === 'Tab') {
    const list = focusables(top);
    if (!list.length) return e.preventDefault();
    const first = list[0];
    const last = list[list.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === top || !top.contains(at))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (at === last || !top.contains(at))) {
      e.preventDefault();
      first.focus();
    }
  } else if (e.key === 'Escape' && !e.defaultPrevented) {
    const backdrop = top.closest<HTMLElement>('.results-backdrop');
    if (backdrop) {
      e.preventDefault();
      backdrop.click();
    }
  }
}

let watching = false;
export function watchDialogs() {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', onKey, true);
}
