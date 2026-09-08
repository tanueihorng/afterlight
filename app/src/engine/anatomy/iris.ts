// The iris, generated rather than photographed.
//
// This is where a rendered eye is won or lost. A stock texture reads as a stock texture; what
// makes an iris look real is structure — radial stromal fibres, the collarette ridge dividing
// pupillary from ciliary zone, crypts, furrows, a pigmented ruff at the margin, and a limbal ring.
//
// Colour comes from a two-layer melanin model rather than four swapped images: anterior stromal
// melanin scatters short wavelengths (which is why low-melanin irises read blue without any blue
// pigment), and posterior epithelium is dark in everyone.

export interface IrisParams {
  /** Anterior stromal melanin, 0 (blue) to 1 (deep brown). */
  melanin: number;
  /** Warmth of that melanin: 0 is ashen/grey-green, 1 is golden/amber. */
  warmth: number;
  /** Density of the radial fibre structure. */
  fibreDensity: number;
  /** How pronounced the collarette ridge is. */
  collarette: number;
  /** Number and size of Fuchs' crypts. */
  crypts: number;
  /** Darkness of the limbal ring. */
  limbalRing: number;
  /** Pupil diameter in millimetres. */
  pupilMm: number;
}

export const DEFAULT_IRIS: IrisParams = {
  melanin: 0.55,
  warmth: 0.6,
  fibreDensity: 0.7,
  collarette: 0.7,
  crypts: 0.5,
  limbalRing: 0.6,
  pupilMm: 4,
};

/** Named starting points. The parameters remain continuous; these are just familiar values. */
export const IRIS_PRESETS: { id: string; label: string; params: Partial<IrisParams> }[] = [
  { id: "brown", label: "Brown", params: { melanin: 0.85, warmth: 0.7 } },
  { id: "hazel", label: "Hazel", params: { melanin: 0.55, warmth: 0.8 } },
  { id: "green", label: "Green", params: { melanin: 0.3, warmth: 0.55 } },
  { id: "blue", label: "Blue", params: { melanin: 0.1, warmth: 0.3 } },
  { id: "grey", label: "Grey", params: { melanin: 0.16, warmth: 0.12 } },
];

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Base iris colour from the melanin model.
 *
 * Low melanin: little long-wavelength absorption, and Tyndall scattering in the stroma returns
 * short wavelengths — blue. High melanin: broad absorption with the residual warm — brown.
 */
export function irisBaseColour({ melanin, warmth }: Pick<IrisParams, "melanin" | "warmth">): RGB {
  const m = clamp01(melanin);
  const w = clamp01(warmth);

  // Scattered short-wavelength component, strongest when there is little melanin to absorb it.
  const scatter = (1 - m) ** 1.6;
  const blue = { r: 0.26, g: 0.42, b: 0.62 };
  // Pigment component, warmer as `warmth` rises.
  const pigment = {
    r: 0.13 + 0.42 * w,
    g: 0.09 + 0.24 * w,
    b: 0.05 + 0.07 * w,
  };

  return {
    r: mix(pigment.r, blue.r, scatter),
    g: mix(pigment.g, blue.g, scatter),
    b: mix(pigment.b, blue.b, scatter),
  };
}

/** The pupillary zone is usually a shade different from the ciliary zone. */
export function pupillaryZoneColour(params: IrisParams): RGB {
  const base = irisBaseColour(params);
  const shift = 0.12 + 0.2 * params.warmth;
  return {
    r: clamp01(base.r * (1 + shift)),
    g: clamp01(base.g * (1 + shift * 0.7)),
    b: clamp01(base.b * (1 - shift * 0.35)),
  };
}

export function pupilRadiusMm(params: IrisParams): number {
  return clamp(params.pupilMm, 2, 8) / 2;
}

/**
 * Pupil size for a given light level, 0 (dark) to 1 (bright).
 * The response is nonlinear: most of the constriction happens early.
 */
export function pupilForLight(light: number): number {
  const l = clamp01(light);
  return 8 - 6 * l ** 0.55;
}

export function toHex({ r, g, b }: RGB): number {
  const to255 = (v: number) => Math.round(clamp01(v) * 255);
  return (to255(r) << 16) | (to255(g) << 8) | to255(b);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}
