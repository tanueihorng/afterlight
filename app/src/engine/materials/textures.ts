// Textures generated on the device, never fetched.
//
// Non-negotiable #1 applies to bytes as much as to data: nothing is downloaded at runtime, so
// every surface here is painted into a canvas at load and cached by its parameters.

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { irisBaseColour, pupillaryZoneColour, type IrisParams } from "../anatomy/iris";
import { paintFundus, type FundusParams } from "../anatomy/fundus";

const cache = new Map<string, Texture>();

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
export function irisTexture(params: IrisParams, size = 1024): Texture | null {
  const key = `iris:${size}:${JSON.stringify(params)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const surface = canvas(size);
  if (!surface) return null;
  const { ctx } = surface;

  const base = irisBaseColour(params);
  const pupillary = pupillaryZoneColour(params);
  const collaretteAt = 0.36;

  // Zones: pupillary (inner) then ciliary (outer), meeting at the collarette.
  const zones = ctx.createLinearGradient(0, 0, 0, size);
  zones.addColorStop(0, rgbString(pupillary));
  zones.addColorStop(collaretteAt * 0.9, rgbString(pupillary));
  zones.addColorStop(collaretteAt, rgbString(base, 1));
  zones.addColorStop(1, rgbString(base));
  ctx.fillStyle = zones;
  ctx.fillRect(0, 0, size, size);

  // Radial stromal fibres, drawn as vertical strokes in polar space.
  const fibres = Math.round(220 * params.fibreDensity + 60);
  for (let i = 0; i < fibres; i++) {
    const x = (i / fibres) * size + (Math.random() - 0.5) * 3;
    const light = Math.random() > 0.5;
    ctx.strokeStyle = light ? "rgba(255,240,215,0.22)" : "rgba(18,8,4,0.28)";
    ctx.lineWidth = 0.5 + Math.random() * 2.4;
    ctx.beginPath();
    ctx.moveTo(x, size * (0.1 + Math.random() * 0.12));
    ctx.bezierCurveTo(
      x + (Math.random() - 0.5) * 10,
      size * 0.4,
      x + (Math.random() - 0.5) * 14,
      size * 0.7,
      x + (Math.random() - 0.5) * 18,
      size,
    );
    ctx.stroke();
  }

  // The collarette: a raised ridge where the two zones meet.
  ctx.strokeStyle = `rgba(255, 226, 190, ${0.25 * params.collarette})`;
  ctx.lineWidth = size * 0.012;
  ctx.beginPath();
  for (let x = 0; x <= size; x += 4) {
    const y = size * collaretteAt + Math.sin(x * 0.06) * size * 0.012 * params.collarette;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Fuchs' crypts: irregular openings just outside the collarette.
  const crypts = Math.round(34 * params.crypts);
  ctx.fillStyle = "rgba(14, 6, 3, 0.58)";
  for (let i = 0; i < crypts; i++) {
    const x = Math.random() * size;
    const y = size * (collaretteAt + 0.02 + Math.random() * 0.22);
    ctx.beginPath();
    ctx.ellipse(x, y, size * (0.006 + Math.random() * 0.016), size * 0.02, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Radial furrows in the outer ciliary zone.
  ctx.strokeStyle = "rgba(20, 10, 5, 0.16)";
  ctx.lineWidth = size * 0.006;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, size * 0.72);
    ctx.lineTo(x + (Math.random() - 0.5) * 6, size * 0.96);
    ctx.stroke();
  }

  // Pupillary ruff: the pigmented frill at the very margin.
  ctx.fillStyle = "rgba(28, 14, 6, 0.75)";
  ctx.fillRect(0, 0, size, size * 0.055);

  // Limbal ring at the outer edge.
  const limbal = ctx.createLinearGradient(0, size * 0.86, 0, size);
  limbal.addColorStop(0, "rgba(20, 16, 22, 0)");
  limbal.addColorStop(1, `rgba(18, 14, 20, ${0.9 * params.limbalRing})`);
  ctx.fillStyle = limbal;
  ctx.fillRect(0, size * 0.86, size, size * 0.14);

  const texture = new CanvasTexture(surface.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
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
  for (const texture of cache.values()) texture.dispose();
  cache.clear();
}

export function cachedTextureCount(): number {
  return cache.size;
}
