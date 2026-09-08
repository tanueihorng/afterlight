// The retinal vessel tree, grown rather than drawn.
//
// A fundus is recognisable almost entirely by its vessels: four arcades leaving the optic disc,
// arching above and below the macula and never crossing it, arteries paler and narrower than the
// veins they accompany. Getting that pattern right matters more than any amount of texture detail.
//
// This grows the tree from the disc with a branching rule, so Phase 07 can change calibre,
// tortuosity and density as parameters rather than needing new artwork per condition.

export interface Point {
  x: number;
  y: number;
}

export type VesselKind = "artery" | "vein";

export interface VesselSegment {
  kind: VesselKind;
  points: Point[];
  /** Width in normalised fundus units (1 = full fundus width). */
  width: number;
  depth: number;
}

export interface VesselParams {
  /** Random seed, so one person's render is stable across sessions. */
  seed: number;
  /** Overall calibre multiplier. */
  calibre: number;
  /** How much the vessels wander; raised in several conditions. */
  tortuosity: number;
  /** How many generations of branching. */
  generations: number;
  /** Position of the optic disc in normalised fundus coordinates. */
  disc: Point;
  /** Position of the fovea; the tree must arch around it. */
  fovea: Point;
  /** Radius of the avascular zone, which no vessel may enter. */
  favRadius: number;
}

export const DEFAULT_VESSELS: VesselParams = {
  seed: 1,
  calibre: 1,
  tortuosity: 1,
  generations: 4,
  disc: { x: 0.68, y: 0.5 },
  fovea: { x: 0.5, y: 0.5 },
  favRadius: 0.045,
};

/** Deterministic PRNG: the same seed must always produce the same eye. */
function rng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The four arcades. Each leaves the disc heading temporally and arcs around the macula — this is
 * the shape a clinician recognises instantly, and getting it wrong makes everything else look
 * wrong too.
 */
function arcadeTargets(p: VesselParams): { angle: number; sweep: number }[] {
  // Temporal is towards the fovea; the vessels leave the disc that way and curve above and below.
  const towardsFovea = Math.atan2(p.fovea.y - p.disc.y, p.fovea.x - p.disc.x);
  return [
    { angle: towardsFovea - 0.75, sweep: -0.55 }, // superotemporal
    { angle: towardsFovea + 0.75, sweep: 0.55 }, // inferotemporal
    { angle: towardsFovea + Math.PI - 0.6, sweep: 0.5 }, // superonasal
    { angle: towardsFovea + Math.PI + 0.6, sweep: -0.5 }, // inferonasal
  ];
}

export function growVessels(params: VesselParams = DEFAULT_VESSELS): VesselSegment[] {
  const p = { ...DEFAULT_VESSELS, ...params };
  const random = rng(p.seed);
  const segments: VesselSegment[] = [];

  const grow = (
    start: Point,
    angle: number,
    sweep: number,
    length: number,
    width: number,
    kind: VesselKind,
    generation: number,
  ) => {
    const steps = 14;
    const points: Point[] = [start];
    let current = { ...start };
    let heading = angle;

    for (let i = 0; i < steps; i++) {
      heading += sweep / steps + (random() - 0.5) * 0.06 * p.tortuosity;
      const step = length / steps;
      const next = {
        x: current.x + Math.cos(heading) * step,
        y: current.y + Math.sin(heading) * step,
      };

      // The fovea is avascular. A vessel that reaches it is bent away rather than drawn through.
      if (distance(next, p.fovea) < p.favRadius) {
        const away = Math.atan2(next.y - p.fovea.y, next.x - p.fovea.x);
        heading = away + (sweep > 0 ? 0.5 : -0.5);
        continue;
      }
      if (next.x < 0.02 || next.x > 0.98 || next.y < 0.02 || next.y > 0.98) break;

      current = next;
      points.push(current);
    }

    if (points.length < 2) return;
    segments.push({ kind, points, width: width * p.calibre, depth: generation });

    if (generation >= p.generations) return;
    // Branch: each child is narrower, and the pair diverges around the parent's heading.
    const children = generation === 0 ? 2 : random() > 0.45 ? 2 : 1;
    for (let c = 0; c < children; c++) {
      const branchAt = Math.floor(points.length * (0.5 + random() * 0.4));
      const origin = points[Math.min(branchAt, points.length - 1)];
      const divergence = (c === 0 ? 1 : -1) * (0.4 + random() * 0.5);
      grow(
        origin,
        heading + divergence,
        sweep * 0.5 + (random() - 0.5) * 0.3,
        length * (0.55 + random() * 0.2),
        width * 0.68,
        kind,
        generation + 1,
      );
    }
  };

  for (const arcade of arcadeTargets(p)) {
    // Arteries and veins run in pairs; the vein is the wider of the two.
    grow(p.disc, arcade.angle, arcade.sweep, 0.42, 0.011, "artery", 0);
    grow(
      { x: p.disc.x, y: p.disc.y + 0.012 },
      arcade.angle + 0.12,
      arcade.sweep,
      0.4,
      0.016,
      "vein",
      0,
    );
  }

  return segments;
}

/** Vein-to-artery calibre ratio, about 3:2 in health. Used as a check, never as a diagnosis. */
export function calibreRatio(segments: VesselSegment[]): number | null {
  const arteries = segments.filter((s) => s.kind === "artery" && s.depth === 0);
  const veins = segments.filter((s) => s.kind === "vein" && s.depth === 0);
  if (!arteries.length || !veins.length) return null;
  const mean = (list: VesselSegment[]) => list.reduce((n, s) => n + s.width, 0) / list.length;
  return mean(veins) / mean(arteries);
}

/** Whether any vessel entered the avascular zone — the property that must never break. */
export function violatesFAV(segments: VesselSegment[], params = DEFAULT_VESSELS): boolean {
  return segments.some((s) =>
    s.points.some((point) => distance(point, params.fovea) < params.favRadius * 0.9),
  );
}
