import { describe, expect, it } from 'vitest';
import { tabletZoom, uiZoom } from './display';

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

describe('Tablet interface scale', () => {
  it('leaves phones alone, upright or sideways', () => {
    expect(tabletZoom(390, 844)).toBe(1);
    expect(tabletZoom(360, 640)).toBe(1);
    expect(tabletZoom(844, 390)).toBe(1);
  });
  it('scales portrait tablets up to fill the screen', () => {
    expect(tabletZoom(820, 1180)).toBe(1.2); // iPad Air / 11"
    expect(tabletZoom(744, 1133)).toBe(1.2); // iPad mini
    expect(tabletZoom(768, 1024)).toBe(1.1);
    expect(tabletZoom(1024, 1366)).toBe(1.4); // 12.9"
  });
  it('uses the wide layout sizing on landscape tablets', () => {
    expect(tabletZoom(1180, 820)).toBe(1);
    expect(tabletZoom(1366, 1024)).toBe(1.1);
  });
});
