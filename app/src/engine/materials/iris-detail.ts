export { anteriorSurface, cornealSag } from "../anatomy/surface";
export { EYE } from "../anatomy/dimensions";
import irisNormalUrl from "../assets/iris-normal.png?inline";
import irisReliefUrl from "../assets/iris-relief.png?inline";

export { irisNormalUrl };
export type IrisColour = { r: number; g: number; b: number };
let relief: HTMLImageElement | null = null;
let ready = false;
const waiting = new Set<() => void>();

export function withIrisRelief(callback: () => void): () => void {
  if (ready) {
    callback();
    return () => {};
  }
  waiting.add(callback);
  if (!relief) {
    relief = new Image();
    relief.onload = () => {
      ready = true;
      waiting.forEach((listener) => listener());
      waiting.clear();
    };
    relief.onerror = () => {
      waiting.clear();
      relief = null;
    };
    relief.src = irisReliefUrl;
  }
  return () => waiting.delete(callback);
}

// The baked map supplies neutral structure. These colours still come from the live iris controls.
// `pupilZone` is the pupil radius as a fraction of the iris annulus (0..1): the model's geometric
// aperture is fixed at 0.7 mm, so the visible pupil is painted dark out to the live pupil radius.
export function paintIrisDetail(
  context: CanvasRenderingContext2D,
  size: number,
  base: IrisColour,
  inner: IrisColour,
  limbal: number,
  detail = { fibreDensity: 0.7, collarette: 0.7, crypts: 0.5 },
  pupilZone = 0,
): void {
  if (!relief || !ready) return;
  const rows = context.canvas.height;
  context.drawImage(relief, 0, 0, size, rows);
  const pixels = context.getImageData(0, 0, size, rows);
  for (let y = 0; y < rows; y++) {
    const radial = 1 - y / (rows - 1);
    const innerMix = 1 / (1 + Math.exp((radial - 0.36) * 28));
    // the live pupil: dark out to the current radius, easing over ~8% of the annulus
    const pupilEdge = pupilZone > 0 ? 1 / (1 + Math.exp((radial - pupilZone) * 56)) : 0;
    const border = 1 - limbal * 0.8 * Math.exp(-(((1 - radial) / 0.065) ** 2));
    const pupilRuff = 1 - 0.78 * Math.exp(-((radial / 0.025) ** 2));
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const height = pixels.data[offset] / 255;
      const angle = (x / size) * Math.PI * 2;
      const flecks = Math.sin(angle * 139 + Math.sin(radial * 91 + angle * 13));
      const structure =
        height < 0.42
          ? detail.crypts * 2
          : radial > 0.27 && radial < 0.44
            ? detail.collarette / 0.7
            : detail.fibreDensity / 0.7;
      const shading =
        Math.max(0.18, 0.88 + (height - 0.5) * 2.8 * structure + flecks * 0.055) *
        border *
        pupilRuff;
      const zoneMix = Math.max(innerMix, pupilEdge);
      pixels.data[offset] = Math.min(
        255,
        255 * (base.r * (1 - zoneMix) + inner.r * zoneMix) * shading,
      );
      pixels.data[offset + 1] = Math.min(
        255,
        255 * (base.g * (1 - zoneMix) + inner.g * zoneMix) * shading,
      );
      pixels.data[offset + 2] = Math.min(
        255,
        255 * (base.b * (1 - zoneMix) + inner.b * zoneMix) * shading,
      );
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
}
