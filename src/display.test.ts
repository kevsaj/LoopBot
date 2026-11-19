import { describe, expect, it } from 'vitest';
import { uiZoom } from './display';

describe('PC interface scale', () => {
  it('stays at 1 for windows the layout is designed for, or smaller', () => {
    expect(uiZoom(1180, 720)).toBe(1);
    expect(uiZoom(1280, 720)).toBe(1);
    expect(uiZoom(900, 600)).toBe(1);
  });
  it('grows with big windows, limited by the shorter side', () => {
    expect(uiZoom(1920, 1080)).toBe(1.5);
    expect(uiZoom(2560, 1440)).toBe(2);
    expect(uiZoom(2560, 1080)).toBe(1.5); // ultrawide: height decides
  });
  it('never passes 2.5', () => {
    expect(uiZoom(7680, 4320)).toBe(2.5);
  });
});
