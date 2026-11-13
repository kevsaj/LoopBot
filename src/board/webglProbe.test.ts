import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetWebglProbe, webglRenderTargetsWork } from './webglProbe';

function fakeGl(status: number) {
  const lose = vi.fn();
  return {
    lose,
    gl: {
      FRAMEBUFFER_COMPLETE: 0x8cd5,
      MAX_TEXTURE_SIZE: 1,
      getParameter: () => 4096,
      createTexture: () => ({}),
      bindTexture() {},
      texParameteri() {},
      texImage2D() {},
      createFramebuffer: () => ({}),
      bindFramebuffer() {},
      framebufferTexture2D() {},
      checkFramebufferStatus: () => status,
      deleteFramebuffer() {},
      deleteTexture() {},
      getExtension: () => ({ loseContext: lose }),
    },
  };
}

function withCanvas(gl: unknown) {
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => gl }) });
}

afterEach(() => {
  resetWebglProbe();
  vi.unstubAllGlobals();
});

describe('webglRenderTargetsWork', () => {
  it('says yes when the GPU can draw into a texture, and frees the context', () => {
    const { gl, lose } = fakeGl(0x8cd5);
    withCanvas(gl);
    expect(webglRenderTargetsWork()).toBe(true);
    expect(lose).toHaveBeenCalled();
  });

  it('says no on "Incomplete Attachment" so the board uses Canvas', () => {
    withCanvas(fakeGl(0x8cd6).gl);
    expect(webglRenderTargetsWork()).toBe(false);
  });

  it('says no without WebGL, or when asking throws', () => {
    withCanvas(null);
    expect(webglRenderTargetsWork()).toBe(false);
    resetWebglProbe();
    vi.stubGlobal('document', { createElement: () => { throw new Error('nope'); } });
    expect(webglRenderTargetsWork()).toBe(false);
  });
});
