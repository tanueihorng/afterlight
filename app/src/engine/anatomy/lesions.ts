// Painting lesions onto a fundus.
//
// Each function draws one finding, taking a 0–1 severity so a condition's whole progression is a
// number rather than a set of pictures. They compose: proliferative retinopathy with macular
// oedema after laser is three of these on the same canvas, which is how it looks in life.
//
// These are illustrations of how findings are described. They are not derived from anyone's
// imaging and they do not depict any individual's eye.

import type { FundusLesions } from "./fundus";

export interface LesionContext {
  ctx: CanvasRenderingContext2D;
  size: number;
  fovea: { x: number; y: number };
  disc: { x: number; y: number; rx: number; ry: number };
  random: () => number;
}

const px = (v: number, size: number) => v * size;

/** Scatter points across the fundus, avoiding the disc, optionally limited to one sector. */
function scatter(
  c: LesionContext,
  count: number,
  opts: { centreBias?: number; sector?: { from: number; to: number }; minRadius?: number; maxRadius?: number } = {},
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const min = opts.minRadius ?? 0.04;
  const max = opts.maxRadius ?? 0.48;
  for (let i = 0; i < count; i++) {
    const angle = opts.sector
      ? opts.sector.from + c.random() * (opts.sector.to - opts.sector.from)
      : c.random() * Math.PI * 2;
    const bias = opts.centreBias ?? 0;
    const t = bias > 0 ? c.random() ** (1 + bias * 3) : Math.sqrt(c.random());
    const radius = min + t * (max - min);
    const x = 0.5 + Math.cos(angle) * radius;
    const y = 0.5 + Math.sin(angle) * radius;
    // Nothing sits on the optic disc itself.
    if (Math.hypot(x - c.disc.x, y - c.disc.y) < c.disc.rx * 1.1) continue;
    points.push({ x, y });
  }
  return points;
}

export function drawDotBlot(c: LesionContext, severity: number, sector?: FundusLesions["sector"]) {
  const { ctx, size } = c;
  for (const p of scatter(c, Math.round(90 * severity), { sector })) {
    const r = px(0.004 + c.random() * 0.008, size);
    ctx.fillStyle = `rgba(120, 20, 24, ${0.6 + c.random() * 0.35})`;
    ctx.beginPath();
    ctx.arc(px(p.x, size), px(p.y, size), r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawFlame(c: LesionContext, severity: number, sector?: FundusLesions["sector"]) {
  const { ctx, size } = c;
  for (const p of scatter(c, Math.round(40 * severity), { sector })) {
    // Flame haemorrhages follow the nerve fibre layer, so they streak towards the disc.
    const towardsDisc = Math.atan2(c.disc.y - p.y, c.disc.x - p.x);
    ctx.save();
    ctx.translate(px(p.x, size), px(p.y, size));
    ctx.rotate(towardsDisc);
    ctx.fillStyle = `rgba(142, 22, 26, ${0.55 + c.random() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, px(0.022 + c.random() * 0.02, size), px(0.005, size), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawExudates(c: LesionContext, severity: number) {
  const { ctx, size } = c;
  // Hard exudates cluster around the macula, often in an incomplete ring.
  for (const p of scatter(c, Math.round(70 * severity), { centreBias: 1.4, maxRadius: 0.22 })) {
    ctx.fillStyle = `rgba(248, 226, 150, ${0.7 + c.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(px(p.x, size), px(p.y, size), px(0.003 + c.random() * 0.006, size), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCottonWool(c: LesionContext, severity: number) {
  const { ctx, size } = c;
  for (const p of scatter(c, Math.round(14 * severity), { maxRadius: 0.3 })) {
    const r = px(0.012 + c.random() * 0.012, size);
    const g = ctx.createRadialGradient(px(p.x, size), px(p.y, size), 0, px(p.x, size), px(p.y, size), r);
    g.addColorStop(0, "rgba(250, 248, 240, 0.85)");
    g.addColorStop(1, "rgba(250, 248, 240, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px(p.x, size), px(p.y, size), r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawDrusen(c: LesionContext, severity: number) {
  const { ctx, size } = c;
  // Drusen sit at the macula and grow and coalesce as they progress.
  const count = Math.round(160 * severity);
  for (let i = 0; i < count; i++) {
    const angle = c.random() * Math.PI * 2;
    const radius = c.random() ** 0.6 * 0.16;
    const x = c.fovea.x + Math.cos(angle) * radius;
    const y = c.fovea.y + Math.sin(angle) * radius;
    const r = px(0.004 + c.random() * 0.008 * (0.5 + severity), size);
    ctx.fillStyle = `rgba(244, 226, 176, ${0.4 + c.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(px(x, size), px(y, size), r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawAtrophy(c: LesionContext, severity: number) {
  const { ctx, size } = c;
  // Geographic atrophy: sharply edged, pale, and the choroidal vessels show through it.
  const radius = px(0.05 + 0.11 * severity, size);
  ctx.save();
  ctx.beginPath();
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wobble = 1 + Math.sin(a * 3 + severity * 4) * 0.16;
    const x = px(c.fovea.x, size) + Math.cos(a) * radius * wobble;
    const y = px(c.fovea.y, size) + Math.sin(a) * radius * wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "rgba(228, 196, 168, 0.92)";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(150, 82, 54, 0.5)";
  ctx.lineWidth = size * 0.004;
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    ctx.moveTo(c.random() * size, c.random() * size);
    ctx.lineTo(c.random() * size, c.random() * size);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSubretinalBleed(c: LesionContext, severity: number) {
  const { ctx, size } = c;
  const radius = px(0.06 + 0.1 * severity, size);
  const g = ctx.createRadialGradient(
    px(c.fovea.x, size),
    px(c.fovea.y, size),
    radius * 0.2,
    px(c.fovea.x, size),
    px(c.fovea.y, size),
    radius,
  );
  g.addColorStop(0, `rgba(110, 24, 26, ${0.75 * severity + 0.2})`);
  g.addColorStop(0.7, `rgba(140, 44, 34, ${0.5 * severity})`);
  g.addColorStop(1, "rgba(150, 60, 40, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px(c.fovea.x, size), px(c.fovea.y, size), radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawNeovascular(c: LesionContext, severity: number) {
  const { ctx, size } = c;
  // New vessels are fine, chaotic and ignore the orderly arcade pattern.
  const fronds = Math.round(6 * severity) + 1;
  ctx.strokeStyle = "rgba(190, 46, 40, 0.8)";
  for (let f = 0; f < fronds; f++) {
    const originAngle = c.random() * Math.PI * 2;
    let x = c.disc.x + Math.cos(originAngle) * (c.disc.rx * 1.4 + c.random() * 0.2);
    let y = c.disc.y + Math.sin(originAngle) * (c.disc.ry * 1.4 + c.random() * 0.2);
    for (let branch = 0; branch < 12; branch++) {
      let heading = c.random() * Math.PI * 2;
      ctx.lineWidth = Math.max(0.6, size * 0.0016);
      ctx.beginPath();
      ctx.moveTo(px(x, size), px(y, size));
      let bx = x;
      let by = y;
      for (let step = 0; step < 5; step++) {
        heading += (c.random() - 0.5) * 1.6;
        bx += Math.cos(heading) * 0.012;
        by += Math.sin(heading) * 0.012;
        ctx.lineTo(px(bx, size), px(by, size));
      }
      ctx.stroke();
      x += (c.random() - 0.5) * 0.02;
      y += (c.random() - 0.5) * 0.02;
    }
  }
}

export function drawLaserScars(c: LesionContext, severity: number, around: { x: number; y: number }) {
  const { ctx, size } = c;
  const rings = 2;
  for (let ring = 0; ring < rings; ring++) {
    const radius = 0.035 + ring * 0.018;
    const count = Math.round(14 * severity) + 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = around.x + Math.cos(a) * radius;
      const y = around.y + Math.sin(a) * radius;
      ctx.fillStyle = "rgba(238, 214, 190, 0.85)";
      ctx.beginPath();
      ctx.arc(px(x, size), px(y, size), px(0.006, size), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(92, 46, 26, 0.7)";
      ctx.lineWidth = size * 0.0022;
      ctx.stroke();
    }
  }
}

export function drawPRP(c: LesionContext, severity: number) {
  const { ctx, size } = c;
  for (const p of scatter(c, Math.round(320 * severity), { minRadius: 0.2, maxRadius: 0.49 })) {
    ctx.fillStyle = "rgba(236, 212, 188, 0.75)";
    ctx.beginPath();
    ctx.arc(px(p.x, size), px(p.y, size), px(0.007, size), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(88, 44, 26, 0.55)";
    ctx.lineWidth = size * 0.002;
    ctx.stroke();
  }
}

export function drawBoneSpicules(c: LesionContext, severity: number) {
  const { ctx, size } = c;
  // Bone-spicule pigmentation starts in the mid-periphery and moves inwards.
  const inner = 0.42 - 0.2 * severity;
  for (const p of scatter(c, Math.round(260 * severity), { minRadius: inner, maxRadius: 0.5 })) {
    ctx.save();
    ctx.translate(px(p.x, size), px(p.y, size));
    ctx.rotate(c.random() * Math.PI);
    ctx.fillStyle = "rgba(28, 16, 12, 0.85)";
    for (let arm = 0; arm < 3; arm++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.fillRect(0, 0, px(0.012, size), px(0.003, size));
    }
    ctx.restore();
  }
}

export function drawDetachment(
  c: LesionContext,
  severity: number,
  maculaOff: boolean,
  sector?: FundusLesions["sector"],
) {
  const { ctx, size } = c;
  // A detached retina billows forward in a convex dome with folds in it. A pie-slice with straight
  // radial edges is the classic wrong drawing: the boundary is curved and its edge is not sharp.
  const from = sector?.from ?? -Math.PI * 0.95;
  const to = sector?.to ?? -Math.PI * 0.05;
  const reach = 0.5 * (0.4 + 0.6 * severity);
  const inner = maculaOff ? 0.03 : 0.19;

  const boundary: { x: number; y: number }[] = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = from + (to - from) * t;
    // Billowing: the dome reaches furthest in the middle of the affected sector.
    const bulge = Math.sin(t * Math.PI) ** 0.6;
    const r = inner + (reach - inner) * bulge;
    boundary.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r });
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px(0.5 + Math.cos(from) * inner, size), px(0.5 + Math.sin(from) * inner, size));
  for (const point of boundary) ctx.lineTo(px(point.x, size), px(point.y, size));
  ctx.closePath();
  ctx.clip();

  // Pale, slightly out of focus, and lighter towards its leading edge.
  const shade = ctx.createRadialGradient(
    px(0.5, size),
    px(0.5, size),
    px(inner, size),
    px(0.5, size),
    px(0.5, size),
    px(reach, size),
  );
  shade.addColorStop(0, `rgba(214, 178, 168, ${0.35 + 0.25 * severity})`);
  shade.addColorStop(0.7, `rgba(228, 200, 192, ${0.6 + 0.25 * severity})`);
  shade.addColorStop(1, `rgba(236, 214, 208, ${0.45 + 0.2 * severity})`);
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);

  // Folds in the detached tissue, running along the direction it billows.
  ctx.strokeStyle = "rgba(176, 136, 128, 0.42)";
  ctx.lineWidth = size * 0.008;
  for (let i = 1; i < 7; i++) {
    const a = from + ((to - from) * i) / 7;
    ctx.beginPath();
    ctx.moveTo(px(0.5 + Math.cos(a) * inner, size), px(0.5 + Math.sin(a) * inner, size));
    ctx.quadraticCurveTo(
      px(0.5 + Math.cos(a + 0.16) * reach * 0.65, size),
      px(0.5 + Math.sin(a + 0.16) * reach * 0.65, size),
      px(0.5 + Math.cos(a) * reach * 0.94, size),
      px(0.5 + Math.sin(a) * reach * 0.94, size),
    );
    ctx.stroke();
  }
  ctx.restore();

  // Soften the leading edge, so the boundary is a transition rather than a cut.
  ctx.save();
  ctx.strokeStyle = `rgba(224, 196, 188, ${0.5})`;
  ctx.lineWidth = size * 0.03;
  ctx.filter = "blur(6px)";
  ctx.beginPath();
  boundary.forEach((point, i) => {
    const X = px(point.x, size);
    const Y = px(point.y, size);
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  });
  ctx.stroke();
  ctx.restore();
}

export function drawTear(c: LesionContext, severity: number) {
  const { ctx, size } = c;
  // A horseshoe tear: a flap with a darker window of bare choroid behind it.
  const angle = -Math.PI * 0.72;
  const radius = 0.36;
  const x = 0.5 + Math.cos(angle) * radius;
  const y = 0.5 + Math.sin(angle) * radius;
  const scale = 0.02 + 0.02 * severity;

  ctx.fillStyle = "rgba(150, 40, 30, 0.9)";
  ctx.beginPath();
  ctx.moveTo(px(x - scale, size), px(y + scale, size));
  ctx.quadraticCurveTo(px(x, size), px(y - scale * 1.6, size), px(x + scale, size), px(y + scale, size));
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(90, 30, 20, 0.9)";
  ctx.lineWidth = size * 0.003;
  ctx.stroke();
}

export function drawMacularHole(c: LesionContext, severity: number) {
  const { ctx, size } = c;
  const r = px(0.012 + 0.014 * severity, size);
  const g = ctx.createRadialGradient(
    px(c.fovea.x, size),
    px(c.fovea.y, size),
    0,
    px(c.fovea.x, size),
    px(c.fovea.y, size),
    r * 2.2,
  );
  g.addColorStop(0, "rgba(150, 36, 24, 0.95)");
  g.addColorStop(0.45, "rgba(190, 120, 90, 0.6)");
  g.addColorStop(1, "rgba(200, 150, 120, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px(c.fovea.x, size), px(c.fovea.y, size), r * 2.2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawMembrane(c: LesionContext, severity: number) {
  const { ctx, size } = c;
  // An epiretinal membrane glints, and drags the surrounding surface into fine folds.
  ctx.save();
  ctx.globalAlpha = 0.25 * severity;
  const g = ctx.createRadialGradient(
    px(c.fovea.x, size),
    px(c.fovea.y, size),
    0,
    px(c.fovea.x, size),
    px(c.fovea.y, size),
    px(0.2, size),
  );
  g.addColorStop(0, "rgba(255, 246, 226, 0.9)");
  g.addColorStop(1, "rgba(255, 246, 226, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(255, 240, 220, 0.5)";
  ctx.lineWidth = size * 0.002;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(px(c.fovea.x, size), px(c.fovea.y, size));
    ctx.quadraticCurveTo(
      px(c.fovea.x + Math.cos(a) * 0.08, size),
      px(c.fovea.y + Math.sin(a) * 0.08, size),
      px(c.fovea.x + Math.cos(a + 0.3) * 0.19, size),
      px(c.fovea.y + Math.sin(a + 0.3) * 0.19, size),
    );
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHaze(c: LesionContext, severity: number) {
  const { ctx, size } = c;
  ctx.fillStyle = `rgba(120, 92, 70, ${0.55 * severity})`;
  ctx.fillRect(0, 0, size, size);
}
