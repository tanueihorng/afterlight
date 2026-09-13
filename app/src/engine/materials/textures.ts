// Textures generated on the device, never fetched.
//
// Non-negotiable #1 applies to bytes as much as to data: nothing is downloaded at runtime, so
// every surface here is painted into a canvas at load and cached by its parameters.

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { irisBaseColour, pupillaryZoneColour, type IrisParams } from "../anatomy/iris";
import { withIrisRelief, paintIrisDetail } from "./iris-detail";
import { paintFundus, type FundusParams } from "../anatomy/fundus";

const cache = new Map<string, Texture>();
const cancelDetailLoads: (() => void)[] = [];

function canvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const el = document.createElement("canvas");
  el.width = size;
  el.height = size;
  const ctx = el.getContext("2d");
  return ctx ? { canvas: el, ctx } : null;
}

function rgbString({ r, g, b }: { r: number; g: number; b: number }, alpha = 1): string {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

/**
 * The iris, painted in polar coordinates: angle across, radius down. Wrapping the angle axis makes
 * the fibres continuous all the way round.
 */
export function irisTexture(params: IrisParams, size = 1024, onReady?: () => void): Texture | null {
  const key = `iris:${size}:${JSON.stringify(params)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const surface = canvas(size);
  if (!surface) return null;
  const { ctx } = surface;

  const base = irisBaseColour(params);
  const pupillary = pupillaryZoneColour(params);
  surface.canvas.height = Math.max(128, size / 4);
  ctx.fillStyle = rgbString(base);
  ctx.fillRect(0, 0, size, surface.canvas.height);
  const texture = new CanvasTexture(surface.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.anisotropy = 8;
  cancelDetailLoads.push(
    withIrisRelief(() => {
      // the model's geometric aperture is fixed at 0.7 mm; paint the live pupil out to its
      // radius as a fraction of the annulus (0.7 → limbus 5.85 mm)
      // +0.08 annulus fraction (≈0.4 mm): the paint edge sits outside the geometric pupil disc
      // so refraction never separates the two edges at oblique angles
      const pupilZone = Math.max(0, Math.min(0.95, (params.pupilMm / 2 - 0.7) / (5.85 - 0.7) + 0.08));
      paintIrisDetail(ctx, size, base, pupillary, params.limbalRing, params, pupilZone);
      texture.needsUpdate = true;
      onReady?.();
    }),
  );
  cache.set(key, texture);
  return texture;
}

/** Sclera: warm white with episcleral vessels, denser towards the corners. */
export function scleraTexture(vesselDensity = 0.5, size = 1024): Texture | null {
  const key = `sclera:${size}:${vesselDensity.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const surface = canvas(size);
  if (!surface) return null;
  const { ctx } = surface;

  ctx.fillStyle = "rgb(243, 240, 236)";
  ctx.fillRect(0, 0, size, size);

  // A faint yellow cast towards the periphery, as in a real sclera.
  const cast = ctx.createLinearGradient(0, 0, size, 0);
  cast.addColorStop(0, "rgba(226, 210, 176, 0.55)");
  cast.addColorStop(0.5, "rgba(255, 255, 255, 0)");
  cast.addColorStop(1, "rgba(226, 210, 176, 0.55)");
  ctx.fillStyle = cast;
  ctx.fillRect(0, 0, size, size);

  // Episcleral vessels: a branching network, thicker away from the limbus.
  const branches = Math.round(90 * vesselDensity);
  for (let i = 0; i < branches; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    const width = 0.6 + Math.random() * 1.6;
    ctx.strokeStyle = `rgba(196, 92, 84, ${0.18 + Math.random() * 0.22})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    let angle = Math.random() * Math.PI * 2;
    for (let step = 0; step < 12; step++) {
      angle += (Math.random() - 0.5) * 0.7;
      x += Math.cos(angle) * size * 0.02;
      y += Math.sin(angle) * size * 0.02;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const texture = new CanvasTexture(surface.canvas);
  texture.colorSpace = SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

/**
 * Muscle fibre striations: fine lines along the texture's v axis, which the muscle grid runs
 * along its length, so the bump reads as directional fibres rather than noise.
 */
export function muscleFibreTexture(size = 256): Texture | null {
  const key = `muscle-fibre:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const surface = canvas(size);
  if (!surface) return null;
  const { ctx } = surface;
  ctx.fillStyle = "rgb(128, 128, 128)";
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 2) {
    const shade = 108 + Math.round(Math.random() * 48);
    ctx.strokeStyle = `rgb(${shade}, ${shade}, ${shade})`;
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x + (Math.random() - 0.5), 0);
    ctx.lineTo(x + (Math.random() - 0.5), size);
    ctx.stroke();
  }
  const texture = new CanvasTexture(surface.canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(3, 6);
  cache.set(key, texture);
  return texture;
}

export function fundusTexture(params: FundusParams, size = 1024): Texture | null {
  const key = `fundus:${size}:${JSON.stringify(params)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const surface = canvas(size);
  if (!surface) return null;
  paintFundus(surface.ctx, size, params);

  const texture = new CanvasTexture(surface.canvas);
  texture.colorSpace = SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

/** Release every cached texture. Called on teardown so the GPU does not hold them forever. */
export function disposeTextureCache(): void {
  cancelDetailLoads.splice(0).forEach((cancel) => cancel());
  for (const texture of cache.values()) texture.dispose();
  cache.clear();
}

export function cachedTextureCount(): number {
  return cache.size;
}
