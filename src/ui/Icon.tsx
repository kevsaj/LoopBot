// LoopBot's one icon set: every button and menu row draws its icon from here, so the chrome looks
// the same on Android, iPhone and PC (emoji and text symbols are drawn differently by each system).
// Drawn on a 24-unit grid with 2-unit rounded strokes in the current text colour, so an icon takes
// its button's colour (Colourful mode, disabled states and focus included).

import type { CSSProperties } from 'react';

const PATHS = {
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" />
      <circle cx="12" cy="12" r="6.6" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.8 4M17 6h2.5a2.5 2.5 0 0 1-2.8 4M12 14v3.5M8.5 20.5h7M9.5 17.5h5v3h-5z" />
    </>
  ),
  candy: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M12 9a1.6 1.6 0 1 1 1.6 1.6A3.2 3.2 0 1 1 10.4 6" />
      <path d="M12 15v6.5" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />
      <path d="M8.5 9.5h.01M12 9.5h.01M15.5 9.5h.01" strokeWidth="2.6" />
    </>
  ),
  hint: (
    <>
      <path d="M9 17.5h6M10 20.5h4" />
      <path d="M8.2 14.2A6 6 0 1 1 15.8 14.2c-.6.5-.8 1.1-.8 1.8v1.5H9V16c0-.7-.2-1.3-.8-1.8z" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
  reset: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4.5h4.5" />
    </>
  ),
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" />,
  pause: <path d="M8 5v14M16 5v14" strokeWidth="3.2" />,
  step: (
    <>
      <path d="M5 5v14l9-7z" fill="currentColor" />
      <path d="M18 5v14" strokeWidth="2.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  maker: (
    <>
      <path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z" />
      <path d="M14.5 6.5L17 4l3 3-2.5 2.5" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-1 .8-1.7 1.8-1.7h2.2a3.7 3.7 0 0 0 3.7-3.7C20.5 6.7 16.7 3.5 12 3.5z" />
      <path d="M7.5 11.5h.01M9.5 7.8h.01M14 7h.01" strokeWidth="2.8" />
    </>
  ),
  play_controller: (
    <>
      <path d="M7 7.5h10a4.5 4.5 0 0 1 4.4 5.4l-.8 4a2.6 2.6 0 0 1-4.5 1.2L14.5 16h-5l-1.6 2.1a2.6 2.6 0 0 1-4.5-1.2l-.8-4A4.5 4.5 0 0 1 7 7.5z" />
      <path d="M8 10.5v3M6.5 12h3M15.5 11h.01M17.5 13h.01" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  save: (
    <>
      <path d="M12 4v10M8 10.5l4 4 4-4" />
      <path d="M4.5 15v2.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V15" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 17h.01" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cloud_off: (
    <>
      <path d="M7.5 18.5h9.5a4 4 0 0 0 1.2-7.8 6 6 0 0 0-10-2.7M5.4 9.6A4.5 4.5 0 0 0 7.5 18.5" />
      <path d="M4 4l16 16" />
    </>
  ),
  share: (
    <>
      <path d="M12 3.5v11M8 7.5l4-4 4 4" />
      <path d="M6 11H5.5A1.5 1.5 0 0 0 4 12.5v6A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H18" />
    </>
  ),
  next: <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />,
  blocks: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.8" />
      <path d="M16.5 13.5v6M13.5 16.5h6" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="2" />
      <path d="M3 9h18M12 9v11" />
      <path d="M12 9c-1.5-3.5-5.5-4.5-6-2s3.5 2 6 2c2.5 0 6.5.5 6-2s-4.5-1.5-6 2" />
    </>
  ),
  radio: (
    <>
      <rect x="3.5" y="9" width="17" height="11" rx="2.5" />
      <path d="M7 9l9-5M7.5 16.5h4M7.5 13h4" />
      <circle cx="16" cy="14.5" r="2" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {PATHS[name]}
    </svg>
  );
}

/** The round back button every screen's header starts with: a chevron, named for screen readers. */
export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="icon-btn back-round" aria-label={label} onClick={onClick}>
      <Icon name="back" />
    </button>
  );
}
