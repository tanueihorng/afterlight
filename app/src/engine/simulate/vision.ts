// "What this looks like from inside."
//
// This is the view a patient cannot get anywhere else, and the one most often drawn wrong.
// Two rules matter more than any amount of visual polish:
//
//  1. FIELD LOSS HAS SOFT EDGES. The hard black tunnel in every stock illustration is wrong.
//     Scotomas do not have crisp borders, they are not black, and the visual system fills in
//     around them — which is exactly why people do not notice them until they are large.
//
//  2. THE GEOMETRY IS INVERTED. A detachment in the superior retina is experienced as a shadow
//     in the LOWER field, because the eye's optics flip the image. Getting this backwards would
//     teach a patient the opposite of what to report.
//
// Everything here is an illustration of how an experience is described. It is not a measurement
// of anyone's vision, and it cannot show what any particular person sees.

export type SimulationKind =
  | "none"
  | "central_scotoma"
  | "metamorphopsia"
  | "arcuate_loss"
  | "peripheral_loss"
  | "curtain"
  | "floaters"
  | "glare"
  | "halos"
  | "contrast_loss"
  | "colour_desaturation"
  | "diplopia"
  | "blur"
  | "photophobia";

export interface SimulationSpec {
  kind: SimulationKind;
  /** 0–1. Severity is how the condition is described, never a prediction about anyone. */
  severity: number;
  /**
   * Where the underlying problem is, in RETINAL terms. The simulator inverts it, because that is
   * what the eye does.
   */
  retinalQuadrant?: "superior" | "inferior" | "nasal" | "temporal";
  eye?: "right" | "left";
}

export const SIMULATION_LABELS: Record<SimulationKind, string> = {
  none: "No change",
  central_scotoma: "A missing or smudged patch in the centre",
  metamorphopsia: "Straight lines looking bent or wavy",
  arcuate_loss: "An arc of vision missing to one side",
  peripheral_loss: "Vision narrowing from the edges",
  curtain: "A shadow or curtain across part of the view",
  floaters: "Drifting shapes that move with the eye",
  glare: "Scattered light and starbursts",
  halos: "Rings around lights",
  contrast_loss: "Everything looking washed out",
  colour_desaturation: "Colours looking faded, especially red",
  diplopia: "Seeing double",
  blur: "General blurring",
  photophobia: "Light feeling uncomfortably bright",
};

/**
 * A retinal location, converted to where it is experienced in the visual field.
 * The eye's optics invert both axes: superior retina → inferior field, nasal retina → temporal
 * field. This function exists so that inversion is stated once and tested.
 */
export function retinalToField(quadrant: NonNullable<SimulationSpec["retinalQuadrant"]>): {
  x: number;
  y: number;
} {
  switch (quadrant) {
    // Superior retina sees the lower field.
    case "superior":
      return { x: 0.5, y: 0.78 };
    case "inferior":
      return { x: 0.5, y: 0.22 };
    // Nasal retina sees the temporal field, and vice versa. Rendered for a right eye; the caller
    // mirrors for a left one.
    case "nasal":
      return { x: 0.8, y: 0.5 };
    case "temporal":
      return { x: 0.2, y: 0.5 };
  }
}

/** Soft-edged falloff. There is no such thing as a hard-edged scotoma. */
function softMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centre: { x: number; y: number },
  radius: number,
  strength: number,
  colourStops: [number, string][],
) {
  const gradient = ctx.createRadialGradient(
    centre.x * width,
    centre.y * height,
    0,
    centre.x * width,
    centre.y * height,
    radius * Math.max(width, height),
  );
  for (const [stop, colour] of colourStops) gradient.addColorStop(stop, colour);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Apply a simulation over whatever is already on the canvas.
 * The canvas may hold a photograph the person chose, or a neutral scene.
 */
export function simulate(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spec: SimulationSpec,
): void {
  const s = Math.min(1, Math.max(0, spec.severity));
  if (spec.kind === "none" || s === 0) return;
  const mirror = spec.eye === "left" ? -1 : 1;

  switch (spec.kind) {
    case "central_scotoma": {
      // Not black, and not sharply edged: a soft, desaturated smudge that the brain partly fills
      // in. People describe missing letters in the middle of a word, not a dot of darkness.
      const radius = 0.06 + 0.16 * s;
      softMask(ctx, width, height, { x: 0.5, y: 0.5 }, radius, 0.92, [
        [0, `rgba(126, 118, 112, ${0.55 + 0.4 * s})`],
        [0.55, `rgba(128, 122, 118, ${0.35 * s})`],
        [1, "rgba(128, 122, 118, 0)"],
      ]);
      break;
    }

    case "metamorphopsia": {
      // Distortion, not blur: straight lines bend. Implemented as a local warp of the image.
      const image = ctx.getImageData(0, 0, width, height);
      const output = ctx.createImageData(width, height);
      const amplitude = 0.02 * s * Math.min(width, height);
      const centreX = width / 2;
      const centreY = height / 2;
      const reach = Math.min(width, height) * 0.34;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - centreX;
          const dy = y - centreY;
          const distance = Math.hypot(dx, dy);
          const falloff = Math.max(0, 1 - distance / reach);
          const warp = falloff ** 2 * amplitude;
          const sx = Math.round(x + Math.sin(y * 0.06) * warp);
          const sy = Math.round(y + Math.cos(x * 0.055) * warp);
          const from = (Math.min(height - 1, Math.max(0, sy)) * width + Math.min(width - 1, Math.max(0, sx))) * 4;
          const to = (y * width + x) * 4;
          output.data[to] = image.data[from];
          output.data[to + 1] = image.data[from + 1];
          output.data[to + 2] = image.data[from + 2];
          output.data[to + 3] = 255;
        }
      }
      ctx.putImageData(output, 0, 0);
      break;
    }

    case "arcuate_loss": {
      // An arc sweeping from the blind spot towards the centre, dense in the middle of the arc and
      // fading at both ends — never a wedge with a straight border.
      const steps = 26;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const angle = (-0.25 + t * 1.1) * Math.PI * mirror;
        const radius = 0.28 + Math.sin(t * Math.PI) * 0.06;
        const centre = { x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius };
        const density = Math.sin(t * Math.PI) ** 0.7;
        softMask(ctx, width, height, centre, 0.1 + 0.05 * s, 0.5 * s * density, [
          [0, "rgba(120, 116, 112, 0.85)"],
          [1, "rgba(120, 116, 112, 0)"],
        ]);
      }
      break;
    }

    case "peripheral_loss": {
      // Constriction, with a gradual edge. The "tunnel with black walls" picture is the single
      // most misleading image in this whole subject.
      const open = 0.52 - 0.32 * s;
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.max(width, height) * open * 0.55,
        width / 2,
        height / 2,
        Math.max(width, height) * (open + 0.34),
      );
      gradient.addColorStop(0, "rgba(120, 116, 112, 0)");
      gradient.addColorStop(0.55, `rgba(120, 116, 112, ${0.45 * s})`);
      gradient.addColorStop(1, `rgba(116, 112, 108, ${0.86 * s})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case "curtain": {
      // A detachment is experienced on the OPPOSITE side of the field from the affected retina.
      // Superior retina → shadow rising from below; nasal retina → shadow from the temporal side.
      const field = retinalToField(spec.retinalQuadrant ?? "superior");
      const horizontal = field.x !== 0.5;
      const x = horizontal ? 0.5 + (field.x - 0.5) * mirror : 0.5;
      const edge: "top" | "bottom" | "left" | "right" = horizontal
        ? x > 0.5
          ? "right"
          : "left"
        : field.y > 0.5
          ? "bottom"
          : "top";

      // How far across the field it reaches.
      const extent = 0.22 + 0.5 * s;
      const from = { top: [0, 0], bottom: [0, height], left: [0, 0], right: [width, 0] }[edge];
      const to = {
        top: [0, height * extent],
        bottom: [0, height * (1 - extent)],
        left: [width * extent, 0],
        right: [width * (1 - extent), 0],
      }[edge];

      const gradient = ctx.createLinearGradient(from[0], from[1], to[0], to[1]);
      // Grey and soft-edged, never black and never a straight line: a curtain has a vague border
      // and the vision behind it is absent rather than dark.
      gradient.addColorStop(0, `rgba(96, 94, 96, ${0.62 + 0.3 * s})`);
      gradient.addColorStop(0.55, `rgba(104, 102, 104, ${0.45 * s + 0.15})`);
      gradient.addColorStop(1, "rgba(110, 108, 110, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case "floaters": {
      // Drifting, translucent, and always slightly behind the eye's movement.
      const count = Math.round(3 + 9 * s);
      ctx.save();
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + i;
        const radius = 0.1 + ((i * 37) % 100) / 320;
        const x = (0.5 + Math.cos(angle) * radius) * width;
        const y = (0.5 + Math.sin(angle) * radius) * height;
        const size = (4 + ((i * 13) % 11)) * (0.6 + s);
        ctx.globalAlpha = 0.18 + 0.3 * s;
        ctx.fillStyle = "rgba(58, 54, 52, 1)";
        ctx.beginPath();
        if (i % 3 === 0) {
          ctx.ellipse(x, y, size * 1.6, size * 0.5, angle, 0, Math.PI * 2);
        } else if (i % 3 === 1) {
          ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
        } else {
          ctx.ellipse(x, y, size, size * 0.85, angle, 0, Math.PI * 1.6);
        }
        ctx.fill();
      }
      ctx.restore();
      break;
    }

    case "glare": {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.35 * s;
      const spread = ctx.createRadialGradient(
        width * 0.5,
        height * 0.42,
        0,
        width * 0.5,
        height * 0.42,
        Math.max(width, height) * 0.6,
      );
      spread.addColorStop(0, "rgba(255, 248, 232, 0.9)");
      spread.addColorStop(1, "rgba(255, 248, 232, 0)");
      ctx.fillStyle = spread;
      ctx.fillRect(0, 0, width, height);

      // Starburst spikes, which is what people actually describe at night.
      ctx.strokeStyle = `rgba(255, 250, 236, ${0.5 * s})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(width * 0.5, height * 0.42);
        ctx.lineTo(
          width * 0.5 + Math.cos(a) * width * 0.35 * s,
          height * 0.42 + Math.sin(a) * width * 0.35 * s,
        );
        ctx.stroke();
      }
      ctx.restore();
      break;
    }

    case "halos": {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const ring of [0.08, 0.12, 0.16]) {
        ctx.strokeStyle = `rgba(255, 244, 220, ${0.3 * s})`;
        ctx.lineWidth = Math.max(2, width * 0.012);
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.42, width * ring * (0.6 + s), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }

    case "contrast_loss": {
      const image = ctx.getImageData(0, 0, width, height);
      const factor = 1 - 0.7 * s;
      for (let i = 0; i < image.data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          image.data[i + c] = 128 + (image.data[i + c] - 128) * factor;
        }
      }
      ctx.putImageData(image, 0, 0);
      break;
    }

    case "colour_desaturation": {
      // Red desaturates first and most, which is what people report with optic nerve problems.
      const image = ctx.getImageData(0, 0, width, height);
      for (let i = 0; i < image.data.length; i += 4) {
        const r = image.data[i];
        const g = image.data[i + 1];
        const b = image.data[i + 2];
        const grey = 0.299 * r + 0.587 * g + 0.114 * b;
        image.data[i] = r + (grey - r) * Math.min(1, s * 1.2);
        image.data[i + 1] = g + (grey - g) * s * 0.7;
        image.data[i + 2] = b + (grey - b) * s * 0.6;
      }
      ctx.putImageData(image, 0, 0);
      break;
    }

    case "diplopia": {
      const offsetX = Math.round(width * 0.02 * s) * mirror;
      const offsetY = Math.round(height * 0.012 * s);
      const copy = ctx.getImageData(0, 0, width, height);
      ctx.save();
      ctx.globalAlpha = 0.45;
      const temp = document.createElement("canvas");
      temp.width = width;
      temp.height = height;
      temp.getContext("2d")?.putImageData(copy, 0, 0);
      ctx.drawImage(temp, offsetX, offsetY);
      ctx.restore();
      break;
    }

    case "blur": {
      ctx.save();
      ctx.filter = `blur(${(1 + 7 * s).toFixed(1)}px)`;
      const temp = document.createElement("canvas");
      temp.width = width;
      temp.height = height;
      temp.getContext("2d")?.drawImage(ctx.canvas, 0, 0);
      ctx.drawImage(temp, 0, 0);
      ctx.restore();
      break;
    }

    case "photophobia": {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255, 252, 244, ${0.4 * s})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      break;
    }
  }
}

/** The wording every simulation must carry, held in one place so it cannot drift. */
export const SIMULATION_BOUNDARY =
  "An illustration of how this experience is often described. It is not a measurement of anyone's vision, and it cannot show what you or anyone else actually sees.";
