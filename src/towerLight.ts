/** Each tower's own light, used for its beacon, its row in the tower picker and its tile in the Skyline Pass. */
export const TOWER_LIGHT: Record<number, string> = { 1: '#7cc4ff', 2: '#9fd8ff', 3: '#ffb466', 4: '#7fd6c8', 5: '#ffcf6e', 6: '#c9b8ff', 7: '#ff9a6a', 8: '#6aa8ff' };

/** The light as CSS variables: plain rgba rather than color-mix(), which older Android WebViews don't have. */
export function lightVars(hex: string): Record<string, string> {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return { '--tp-light': hex, '--tp-soft': `rgba(${r}, ${g}, ${b}, 0.16)`, '--tp-glow': `rgba(${r}, ${g}, ${b}, 0.45)` };
}
