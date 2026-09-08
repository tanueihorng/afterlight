// WCAG contrast maths, used by a test that reads the real design tokens.
//
// Contrast here is a product requirement, not a preference: it is checked, not eyeballed.

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function parseColor(value: string): RGB | null {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const rgba = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3] };
  return null;
}

/** Flatten a translucent colour onto a background, since that is what the eye actually sees. */
export function over(fg: string, bg: RGB): RGB | null {
  const alpha = fg.match(/^rgba\([^)]*,\s*([\d.]+)\s*\)$/i);
  const base = parseColor(fg);
  if (!base) return null;
  if (!alpha) return base;
  const a = Number(alpha[1]);
  return {
    r: base.r * a + bg.r * (1 - a),
    g: base.g * a + bg.g * (1 - a),
    b: base.b * a + bg.b * (1 - a),
  };
}

export function relativeLuminance({ r, g, b }: RGB): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Parse `--token: value;` declarations out of one CSS block. */
export function parseTokens(css: string, selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!block) return {};
  const out: Record<string, string> = {};
  for (const line of block[1].split(";")) {
    const m = line.match(/\s*(--[\w-]+)\s*:\s*(.+)\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
