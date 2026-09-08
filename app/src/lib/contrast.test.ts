import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, over, parseColor, parseTokens, type RGB } from "./contrast";

const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

const THEMES = [
  { selector: ":root", name: "dark", textMin: 4.5, uiMin: 3 },
  { selector: '[data-theme="light"]', name: "light", textMin: 4.5, uiMin: 3 },
  // The whole point of the high-contrast themes is that they clear AAA.
  { selector: '[data-theme="hc-dark"]', name: "high contrast dark", textMin: 7, uiMin: 4.5 },
  { selector: '[data-theme="hc-light"]', name: "high contrast light", textMin: 7, uiMin: 4.5 },
];

const base = parseTokens(css, ":root");

function tokensFor(selector: string): Record<string, string> {
  const merged = selector === ":root" ? { ...base } : { ...base, ...parseTokens(css, selector) };
  // Resolve `var(--other)` one level deep, which is what the browser paints.
  for (const [key, value] of Object.entries(merged)) {
    const ref = value.match(/^var\((--[\w-]+)\)$/);
    if (ref && merged[ref[1]]) merged[key] = merged[ref[1]];
  }
  return merged;
}

function colour(tokens: Record<string, string>, name: string, onto: RGB): RGB {
  const raw = tokens[name];
  expect(raw, `${name} is not defined`).toBeTruthy();
  const rgb = over(raw, onto);
  expect(rgb, `${name} (${raw}) is not a colour this test can read`).toBeTruthy();
  return rgb!;
}

describe("colour maths", () => {
  it("matches the WCAG reference values", () => {
    const white = parseColor("#ffffff")!;
    const black = parseColor("#000000")!;
    expect(contrastRatio(white, black)).toBeCloseTo(21, 1);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
    // #767676 on white is the canonical 4.5:1 boundary.
    expect(contrastRatio(parseColor("#767676")!, white)).toBeGreaterThanOrEqual(4.5);
  });

  it("flattens a translucent colour onto its background", () => {
    const black = parseColor("#000000")!;
    const half = over("rgba(255, 255, 255, 0.5)", black)!;
    expect(Math.round(half.r)).toBe(128);
  });
});

describe.each(THEMES)("$name theme", ({ selector, textMin, uiMin }) => {
  const tokens = tokensFor(selector);

  // Text that carries content.
  const TEXT_PAIRS: [string, string][] = [
    ["--text", "--bg"],
    ["--text", "--bg-elev"],
    ["--text-2", "--bg"],
    ["--text-2", "--bg-elev"],
    ["--text-3", "--bg"],
    ["--text-3", "--bg-elev"],
    ["--accent-strong", "--bg-elev"],
    ["--right-eye", "--bg-elev"],
    ["--left-eye", "--bg-elev"],
    ["--danger", "--bg-elev"],
    ["--ok", "--bg-elev"],
    ["--warn", "--bg-elev"],
  ];

  // Borders, focus rings, diagram strokes: non-text, so a lower bar, but still a bar.
  const UI_PAIRS: [string, string][] = [
    ["--border", "--bg"],
    ["--border", "--bg-elev"],
    ["--focus-ring", "--bg"],
    ["--focus-ring", "--bg-elev"],
    ["--diagram-alert", "--bg-elev"],
    ["--diagram-good", "--bg-elev"],
  ];

  it.each(TEXT_PAIRS)("%s on %s meets the text minimum", (fg, bg) => {
    const background = colour(tokens, bg, { r: 0, g: 0, b: 0 });
    const ratio = contrastRatio(colour(tokens, fg, background), background);
    expect(
      Number(ratio.toFixed(2)),
      `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${textMin}:1`,
    ).toBeGreaterThanOrEqual(textMin);
  });

  it.each(UI_PAIRS)("%s on %s meets the non-text minimum", (fg, bg) => {
    const background = colour(tokens, bg, { r: 0, g: 0, b: 0 });
    const ratio = contrastRatio(colour(tokens, fg, background), background);
    expect(
      Number(ratio.toFixed(2)),
      `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${uiMin}:1`,
    ).toBeGreaterThanOrEqual(uiMin);
  });

  it("keeps the accent readable as a button fill", () => {
    const fill = colour(tokens, "--accent-strong", { r: 0, g: 0, b: 0 });
    const ink = colour(tokens, "--accent-ink", fill);
    expect(contrastRatio(ink, fill)).toBeGreaterThanOrEqual(4.5);
  });
});
