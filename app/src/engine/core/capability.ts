// What this device can actually do.
//
// Quality is chosen from a probe rather than from a user agent string, and the answer is always
// overridable. If WebGL2 is missing we say so and fall back to the 2D diagrams rather than
// showing a black rectangle.

export type QualityTier = "low" | "medium" | "high";

export interface Capability {
  webgl2: boolean;
  maxTextureSize: number;
  /** Rough device class, from memory and core count where the browser reports them. */
  tier: QualityTier;
  reason: string;
}

export function probeCapability(): Capability {
  if (typeof document === "undefined") {
    return { webgl2: false, maxTextureSize: 0, tier: "low", reason: "no document" };
  }

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    return {
      webgl2: false,
      maxTextureSize: 0,
      tier: "low",
      reason: "This browser does not support WebGL2, so the 3D view is unavailable.",
    };
  }

  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;

  let tier: QualityTier = "medium";
  if (memory >= 8 && cores >= 8 && maxTextureSize >= 8192) tier = "high";
  else if (memory <= 2 || cores <= 2 || maxTextureSize < 4096) tier = "low";

  // Free the probe context immediately; contexts are a limited resource.
  gl.getExtension("WEBGL_lose_context")?.loseContext();

  return { webgl2: true, maxTextureSize, tier, reason: `${memory}GB, ${cores} cores` };
}

export interface TierSettings {
  textureSize: number;
  irisSegments: number;
  globeSegments: number;
  pixelRatioCap: number;
  postProcessing: boolean;
}

export const TIERS: Record<QualityTier, TierSettings> = {
  low: { textureSize: 512, irisSegments: 64, globeSegments: 48, pixelRatioCap: 1, postProcessing: false },
  medium: { textureSize: 1024, irisSegments: 128, globeSegments: 72, pixelRatioCap: 1.5, postProcessing: true },
  high: { textureSize: 2048, irisSegments: 192, globeSegments: 96, pixelRatioCap: 2, postProcessing: true },
};
