/**
 * Can this device's WebGL draw into an off-screen texture? Phaser's WebGL renderer needs that
 * (it builds render targets as it starts), and a few phone GPUs refuse with "Framebuffer status:
 * Incomplete Attachment". Phaser starts its renderer after the game is created, so a try/catch
 * around `new Phaser.Game` can't catch it: we ask the GPU the same question first, and use the
 * Canvas renderer when the answer is no. The board is plain 2D shapes, so Canvas draws it fine.
 */
let cached: boolean | null = null;

export function webglRenderTargetsWork(width = 360, height = 300): boolean {
  if (cached !== null) return cached;
  let gl: WebGLRenderingContext | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    gl = (canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return (cached = false);
    const w = Math.max(1, Math.min(Math.round(width), gl.getParameter(gl.MAX_TEXTURE_SIZE) as number));
    const h = Math.max(1, Math.min(Math.round(height), gl.getParameter(gl.MAX_TEXTURE_SIZE) as number));
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    cached = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(tex);
  } catch {
    cached = false;
  } finally {
    // Phones cap how many WebGL contexts a page may hold, so hand this one back at once.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return cached;
}

/** Tests only: forget the cached answer. */
export function resetWebglProbe() {
  cached = null;
}
