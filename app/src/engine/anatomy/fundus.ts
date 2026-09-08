// The fundus, painted procedurally onto a canvas that becomes a texture.
//
// Everything here is a named parameter, because Phase 07's whole disease atlas is built by
// changing these rather than by drawing forty pictures. Nothing here is anyone's actual retina.

import { growVessels, type VesselParams, type VesselSegment } from "./vessels";
import {
  drawAtrophy,
  drawBoneSpicules,
  drawCottonWool,
  drawDetachment,
  drawDotBlot,
  drawDrusen,
  drawExudates,
  drawFlame,
  drawHaze,
  drawLaserScars,
  drawMacularHole,
  drawMembrane,
  drawNeovascular,
  drawPRP,
  drawSubretinalBleed,
  drawTear,
  type LesionContext,
} from "./lesions";

/**
 * Lesions layered over the normal fundus. Every condition in the atlas is expressed as some
 * combination of these rather than as its own picture, which is what makes forty conditions
 * maintainable and severity a slider rather than a set of images.
 */
export interface FundusLesions {
  /** Dot-and-blot haemorrhages, 0–1. */
  dotBlot?: number;
  /** Flame haemorrhages, which follow the nerve fibre layer. */
  flame?: number;
  /** Hard exudates: sharp yellow deposits, often ringing an area of leakage. */
  exudates?: number;
  /** Cotton-wool spots: soft, pale, indistinct. */
  cottonWool?: number;
  /** Drusen: pale deposits at the macula. */
  drusen?: number;
  /** Geographic atrophy: sharply defined loss of pigment epithelium. */
  atrophy?: number;
  /** Subretinal haemorrhage and exudate, as in neovascular AMD. */
  subretinalBleed?: number;
  /** New vessels: fine, chaotic fronds that ignore the normal arcade pattern. */
  neovascular?: number;
  /** Laser scars: a ring or scatter of pale, pigmented spots. */
  laserScars?: number;
  /** Panretinal photocoagulation: scatter across the periphery. */
  prp?: number;
  /** Bone-spicule pigmentation, peripheral first. */
  boneSpicules?: number;
  /** A detached area, 0 (attached) to 1 (extensive). */
  detachment?: number;
  /** Whether the detachment reaches the macula. */
  maculaOff?: boolean;
  /** A retinal break. */
  tear?: number;
  /** Vessel changes: attenuation of the arterioles. */
  attenuation?: number;
  /** Venous dilation and tortuosity, as in occlusion. */
  venousEngorgement?: number;
  /** A sector or hemisphere affected, in radians from the disc. Absent means the whole fundus. */
  sector?: { from: number; to: number };
  /** Macular hole at the fovea. */
  macularHole?: number;
  /** Epiretinal membrane: a glinting sheet that puckers the surface. */
  membrane?: number;
  /** Media haze, as from vitreous haemorrhage or inflammation. */
  haze?: number;
}

export interface FundusParams {
  /** Background pigmentation, 0 (fair, choroidal vessels showing) to 1 (deeply pigmented). */
  pigmentation: number;
  /** Macular xanthophyll density. */
  macularPigment: number;
  /** Cup-to-disc ratio. Parameterised here so Phase 07 can animate it. */
  cupDisc: number;
  /** RPE granularity. */
  granularity: number;
  /** Nerve fibre layer striations near the disc. */
  striations: number;
  vessels: Partial<VesselParams>;
  lesions?: FundusLesions;
  eye: "right" | "left";
  seed: number;
}

export const DEFAULT_FUNDUS: FundusParams = {
  pigmentation: 0.55,
  macularPigment: 0.6,
  cupDisc: 0.3,
  granularity: 0.5,
  striations: 0.5,
  vessels: {},
  eye: "right",
  seed: 1,
};

function mixHex(a: [number, number, number], b: [number, number, number], t: number) {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Fundus colour runs from a pale, tessellated orange to a deep red-brown. */
export function fundusBackground(pigmentation: number): string {
  return mixHex([236, 176, 120], [128, 58, 26], Math.min(1, Math.max(0, pigmentation)));
}

export interface FundusLayout {
  disc: { x: number; y: number; rx: number; ry: number };
  fovea: { x: number; y: number };
  segments: VesselSegment[];
}

export function fundusLayout(params: FundusParams): FundusLayout {
  // The disc sits nasal to the fovea: to the right in a left eye, to the left in a right eye as
  // the clinician views it. Getting this backwards is the classic tell of a fake fundus image.
  const discX = params.eye === "right" ? 0.68 : 0.32;
  const disc = { x: discX, y: 0.485, rx: 0.075, ry: 0.08 };
  const fovea = { x: 0.5, y: 0.5 };
  const segments = growVessels({
    ...params.vessels,
    seed: params.seed,
    disc: { x: disc.x, y: disc.y },
    fovea,
  } as VesselParams);
  return { disc, fovea, segments };
}

/** Deterministic per-fundus randomness, so a condition looks the same every time it is opened. */
function seededRandom(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

function paintLesions(
  ctx: CanvasRenderingContext2D,
  size: number,
  p: FundusParams,
  layout: FundusLayout,
): void {
  const l = p.lesions ?? {};
  const c: LesionContext = {
    ctx,
    size,
    fovea: layout.fovea,
    disc: layout.disc,
    random: seededRandom(p.seed + 977),
  };

  if (l.atrophy) drawAtrophy(c, l.atrophy);
  if (l.drusen) drawDrusen(c, l.drusen);
  if (l.subretinalBleed) drawSubretinalBleed(c, l.subretinalBleed);
  if (l.prp) drawPRP(c, l.prp);
  if (l.laserScars) drawLaserScars(c, l.laserScars, { x: 0.5 + 0.26, y: 0.5 - 0.24 });
  if (l.boneSpicules) drawBoneSpicules(c, l.boneSpicules);
  if (l.dotBlot) drawDotBlot(c, l.dotBlot, l.sector);
  if (l.flame) drawFlame(c, l.flame, l.sector);
  if (l.cottonWool) drawCottonWool(c, l.cottonWool);
  if (l.exudates) drawExudates(c, l.exudates);
  if (l.neovascular) drawNeovascular(c, l.neovascular);
  if (l.detachment) drawDetachment(c, l.detachment, l.maculaOff ?? false, l.sector);
  if (l.tear) drawTear(c, l.tear);
  if (l.macularHole) drawMacularHole(c, l.macularHole);
  if (l.membrane) drawMembrane(c, l.membrane);
  if (l.haze) drawHaze(c, l.haze);
}

/**
 * Paint a fundus. Works with any 2D context, so the same code produces the WebGL texture, the
 * 2D fallback, and the still images in the docs.
 */
export function paintFundus(
  ctx: CanvasRenderingContext2D,
  size: number,
  params: FundusParams = DEFAULT_FUNDUS,
): FundusLayout {
  const p = { ...DEFAULT_FUNDUS, ...params };
  const layout = fundusLayout(p);
  const px = (v: number) => v * size;

  // Background and choroidal tessellation.
  ctx.fillStyle = fundusBackground(p.pigmentation);
  ctx.fillRect(0, 0, size, size);

  // Choroidal tessellation: in a lightly pigmented fundus the choroidal vessels show through as
  // an irregular mottling. It must not radiate from the centre — that reads as a sunburst, not a
  // retina.
  const tessellation = 1 - p.pigmentation;
  if (tessellation > 0.12) {
    ctx.globalAlpha = 0.13 * tessellation;
    ctx.strokeStyle = "rgb(150, 62, 44)";
    for (let i = 0; i < 130; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * size * 0.52;
      let x = size / 2 + Math.cos(a) * r;
      let y = size / 2 + Math.sin(a) * r;
      let heading = Math.random() * Math.PI * 2;
      ctx.lineWidth = size * (0.003 + Math.random() * 0.005);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let step = 0; step < 7; step++) {
        heading += (Math.random() - 0.5) * 1.1;
        x += Math.cos(heading) * size * 0.035;
        y += Math.sin(heading) * size * 0.035;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // RPE granularity.
  if (p.granularity > 0) {
    ctx.globalAlpha = 0.05 * p.granularity;
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
      ctx.fillRect(x, y, size * 0.002, size * 0.002);
    }
    ctx.globalAlpha = 1;
  }

  // Macula: a broad xanthophyll darkening with a foveal reflex at its centre.
  const macula = ctx.createRadialGradient(
    px(layout.fovea.x),
    px(layout.fovea.y),
    0,
    px(layout.fovea.x),
    px(layout.fovea.y),
    size * 0.17,
  );
  macula.addColorStop(0, `rgba(78, 30, 14, ${0.62 * p.macularPigment})`);
  macula.addColorStop(0.55, `rgba(88, 38, 18, ${0.3 * p.macularPigment})`);
  macula.addColorStop(1, "rgba(90, 40, 20, 0)");
  ctx.fillStyle = macula;
  ctx.fillRect(0, 0, size, size);

  // Foveal reflex: the pinpoint highlight at the very centre.
  const reflex = ctx.createRadialGradient(
    px(layout.fovea.x),
    px(layout.fovea.y),
    0,
    px(layout.fovea.x),
    px(layout.fovea.y),
    size * 0.012,
  );
  reflex.addColorStop(0, "rgba(255, 226, 196, 0.55)");
  reflex.addColorStop(1, "rgba(255, 226, 196, 0)");
  ctx.fillStyle = reflex;
  ctx.fillRect(0, 0, size, size);

  // Vessels, veins under arteries so the crossings look right. Each vessel tapers along its
  // length: a constant-width stroke is the clearest sign of a drawn rather than a grown tree.
  const draw = (segment: VesselSegment) => {
    const base = Math.max(0.8, px(segment.width));
    const colour =
      segment.kind === "artery" ? [188, 72, 52] : [138, 44, 46];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 1; i < segment.points.length; i++) {
      const t = i / (segment.points.length - 1);
      const width = base * (1 - 0.55 * t);
      // Blood is darker where the vessel is thicker.
      const shade = 1 + 0.18 * t;
      ctx.strokeStyle = `rgb(${Math.min(255, colour[0] * shade)}, ${Math.min(255, colour[1] * shade)}, ${Math.min(255, colour[2] * shade)})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(px(segment.points[i - 1].x), px(segment.points[i - 1].y));
      ctx.lineTo(px(segment.points[i].x), px(segment.points[i].y));
      ctx.stroke();

      // Arterioles carry a light reflex down their centre; veins do not.
      if (segment.kind === "artery" && segment.depth < 2 && width > 1.5) {
        ctx.strokeStyle = "rgba(255, 200, 180, 0.45)";
        ctx.lineWidth = width * 0.28;
        ctx.stroke();
      }
    }
  };
  layout.segments.filter((s) => s.kind === "vein").forEach(draw);
  layout.segments.filter((s) => s.kind === "artery").forEach(draw);

  // Optic disc: warm rim tissue with a paler cup, sized by the cup-to-disc ratio.
  const { disc } = layout;
  const rim = ctx.createRadialGradient(
    px(disc.x),
    px(disc.y),
    px(disc.rx) * 0.2,
    px(disc.x),
    px(disc.y),
    px(disc.rx),
  );
  rim.addColorStop(0, "rgb(240, 196, 158)");
  rim.addColorStop(0.75, "rgb(226, 162, 120)");
  rim.addColorStop(1, "rgb(198, 128, 92)");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(px(disc.x), px(disc.y), px(disc.rx), px(disc.ry), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgb(250, 234, 216)";
  ctx.beginPath();
  ctx.ellipse(
    px(disc.x),
    px(disc.y),
    px(disc.rx * p.cupDisc),
    px(disc.ry * p.cupDisc),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.strokeStyle = "rgba(150, 90, 60, 0.6)";
  ctx.lineWidth = size * 0.003;
  ctx.beginPath();
  ctx.ellipse(px(disc.x), px(disc.y), px(disc.rx), px(disc.ry), 0, 0, Math.PI * 2);
  ctx.stroke();

  // Nerve fibre striations: a fine sheen close to the disc only. Drawn across the whole fundus
  // they produce a spoked, synthetic look that no retina has.
  if (p.striations > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(px(disc.x), px(disc.y), size * 0.2, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.055 * p.striations;
    ctx.strokeStyle = "rgba(255, 244, 226, 0.7)";
    ctx.lineWidth = size * 0.0018;
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + Math.sin(i) * 0.05;
      ctx.beginPath();
      ctx.moveTo(px(disc.x) + Math.cos(a) * px(disc.rx) * 1.1, px(disc.y) + Math.sin(a) * px(disc.ry) * 1.1);
      ctx.lineTo(px(disc.x) + Math.cos(a) * size * 0.2, px(disc.y) + Math.sin(a) * size * 0.2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Lesions, painted over the healthy fundus in the order they sit in the eye: deep first,
  // then the retinal layers, then anything on the surface.
  if (p.lesions) paintLesions(ctx, size, p, layout);

  // Vignette: an ophthalmoscope view falls off at the edges.
  const vignette = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.3,
    size / 2,
    size / 2,
    size * 0.62,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(20, 4, 0, 0.75)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  return layout;
}
