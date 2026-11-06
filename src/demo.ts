// The free web demo (itch.io): `npm run build:demo` builds with VITE_DEMO=1.
// The demo plays the Lobby only and ends with a "more floors coming" card.

export const DEMO = import.meta.env.VITE_DEMO === '1';
/** Floors the demo plays. */
export const DEMO_FLOORS = 10;
