import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for the browser's AudioContext whose resume() can be made to fail, like iOS does
// with "Failed to start the audio device" after an interruption.
class FakeContext {
  static made: FakeContext[] = [];
  static failResume = false;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  resumes = 0;
  constructor() {
    FakeContext.made.push(this);
  }
  resume() {
    this.resumes++;
    if (FakeContext.failResume) return Promise.reject(new Error('Failed to start the audio device'));
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

const listeners: Record<string, Array<() => void>> = {};
const doc = {
  visibilityState: 'visible',
  addEventListener: (type: string, fn: () => void) => (listeners[type] ??= []).push(fn),
};
const tap = () => listeners.pointerdown?.forEach((fn) => fn());
const flush = () => new Promise((r) => setTimeout(r, 0));

async function load() {
  vi.resetModules();
  return import('./feedback');
}

beforeEach(() => {
  FakeContext.made = [];
  FakeContext.failResume = false;
  doc.visibilityState = 'visible';
  for (const k of Object.keys(listeners)) delete listeners[k];
  vi.stubGlobal('window', { AudioContext: FakeContext });
  vi.stubGlobal('document', doc);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shared audio', () => {
  it('starts the audio device', async () => {
    const { sharedAudio } = await load();
    const a = sharedAudio() as unknown as FakeContext;
    await flush();
    expect(a.state).toBe('running');
  });

  it('swallows a failed start and keeps the game going', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    FakeContext.failResume = true;
    const { sharedAudio } = await load();
    expect(() => sharedAudio()).not.toThrow();
    await flush();
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('tries again on the next tap and works once the device is free', async () => {
    FakeContext.failResume = true;
    const { sharedAudio } = await load();
    const a = sharedAudio() as unknown as FakeContext;
    await flush();
    expect(a.state).toBe('suspended');
    FakeContext.failResume = false;
    tap();
    await flush();
    expect(a.state).toBe('running');
  });

  it('does not try to start while the app is in the background', async () => {
    const { sharedAudio } = await load();
    doc.visibilityState = 'hidden';
    const a = sharedAudio() as unknown as FakeContext;
    await flush();
    expect(a.resumes).toBe(0);
  });

  it('only runs one start at a time', async () => {
    const { sharedAudio } = await load();
    const a = sharedAudio() as unknown as FakeContext;
    sharedAudio();
    sharedAudio();
    await flush();
    expect(a.resumes).toBe(1);
  });

  it('replaces a context that keeps failing and tells music to rebuild', async () => {
    FakeContext.failResume = true;
    const { sharedAudio, onAudioReset } = await load();
    const reset = vi.fn();
    onAudioReset(reset);
    const first = sharedAudio() as unknown as FakeContext;
    await flush();
    tap();
    await flush();
    tap();
    await flush();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(first.state).toBe('closed');
    FakeContext.failResume = false;
    const next = sharedAudio() as unknown as FakeContext;
    expect(next).not.toBe(first);
    await flush();
    expect(next.state).toBe('running');
  });
});
